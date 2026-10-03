<?php

namespace App\Domains\FrontDesk\Services;

use App\Domains\FrontDesk\Events\GuestCheckedOut;
use App\Domains\FrontDesk\Events\RoomBecameDirty;
use App\Domains\FrontDesk\Models\Stay;
use App\Domains\Inventory\Models\Room;
use App\Domains\Shared\Services\AuditService;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CheckOutService
{
    public function __construct(
        private AuditService $audit,
        private FrontDeskBilling $billing,
    ) {}

    /**
     * Check a guest out.
     *
     * Folio rule: when the P5 folio module is present, the stay's outstanding
     * balance must be zero unless $data['force'] is true (manager override,
     * audited). When P5 is absent, checkout proceeds and the response carries
     * folio_checked=false so the UI can show the warning.
     */
    public function checkOut(int $stayId, array $data = []): array
    {
        return DB::transaction(function () use ($stayId, $data) {
            $stay = Stay::with(['room', 'reservation', 'guest'])
                ->lockForUpdate()
                ->findOrFail($stayId);

            if (! $stay->isInHouse()) {
                throw ValidationException::withMessages([
                    'stay' => ['Stay is already checked out.'],
                ]);
            }

            $folioPresent = $this->billing->folioModulePresent();
            $outstanding = $folioPresent ? $this->billing->outstandingBalance($stay) : 0.0;

            if ($outstanding > 0 && empty($data['force'])) {
                throw ValidationException::withMessages([
                    'folio' => ["Outstanding balance {$outstanding} must be settled before check-out."],
                ]);
            }
            $forced = $outstanding > 0 && ! empty($data['force']);

            $room = Room::where('id', $stay->room_id)->lockForUpdate()->firstOrFail();

            $stay->update([
                'status' => 'checked_out',
                'checked_out_at' => now(),
                'notes' => $data['notes'] ?? $stay->notes,
            ]);

            $stay->reservation->update(['status' => 'checked_out', 'checked_out_at' => now()]);

            // occupied → dirty is a legal transition; the room now needs turnover.
            $room->update(['status' => 'dirty']);

            $this->audit->log('stay.checked_out', $stay, [
                'guest' => $stay->guest->full_name,
                'room' => $room->number,
                'outstanding_balance' => $outstanding,
                'forced' => $forced,
            ]);

            // P5: close the folio when the balance is fully settled.
            // Forced check-outs (outstanding > 0) leave the folio open.
            $folioClosed = false;
            if ($folioPresent && ! $forced) {
                $folio = $this->billing->folioForStay($stay);
                if ($folio && $folio->isOpen()) {
                    app(\App\Domains\Folio\Services\FolioService::class)->close($folio->id);
                    $folioClosed = true;
                }
            }

            $stay->load(['guest', 'room', 'reservation']);
            event(new RoomBecameDirty($room, "check-out of stay #{$stay->id}"));
            event(new GuestCheckedOut($stay));

            return [
                'stay' => $stay,
                'outstanding_balance' => $outstanding,
                'folio_checked' => $folioPresent,
                'folio_closed' => $folioClosed,
                'forced' => $forced,
            ];
        });
    }
}
