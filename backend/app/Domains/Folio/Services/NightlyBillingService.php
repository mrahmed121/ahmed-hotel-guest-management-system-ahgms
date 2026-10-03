<?php

namespace App\Domains\Folio\Services;

use App\Domains\Folio\Models\Folio;
use App\Domains\Folio\Models\FolioLine;
use App\Domains\FrontDesk\Models\Stay;
use App\Domains\Shared\Services\AuditService;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * NightlyBillingService — posts one room-charge line per occupied night.
 *
 * Rate decision (documented): the nightly rate is FROZEN at the reservation's
 * nightly_rate (agreed at booking). Room moves change WHICH room is named on
 * the charge line, not the rate — the guest pays the agreed rate regardless
 * of which physical room they slept in that night.
 *
 * Idempotency: a night is skipped when a room line already exists for
 * (folio_id, service_date). The run is safe to retry and safe to run daily.
 *
 * Chargeable nights for a stay on run date $date:
 *   service_date in [check-in date, min($date, checkout date or expected_checkout) )
 * i.e. nights strictly before the run date, starting the check-in night.
 * Same-day check-in/check-out produces zero nightly charges (no night stayed).
 */
class NightlyBillingService
{
    public function __construct(
        private FolioService $folios,
        private AuditService $audit,
    ) {}

    /**
     * Post nightly charges for all in-house stays up to $date (default today).
     * Returns ['charged' => n, 'skipped' => m, 'stays' => k].
     */
    public function postNightlyCharges(?string $date = null): array
    {
        $runDate = $date ? Carbon::parse($date)->startOfDay() : now()->startOfDay();

        $charged = 0;
        $skipped = 0;
        $stays = 0;

        // withoutGlobalScopes: the billing run is a system job; hotel_id is
        // still stamped on every folio/line from the stay itself.
        $inHouse = Stay::withoutGlobalScopes()
            ->with(['reservation', 'roomHistory'])
            ->where('status', 'in_house')
            ->whereDate('checked_in_at', '<=', $runDate)
            ->get();

        foreach ($inHouse as $stay) {
            $stays++;
            $result = $this->billStay($stay, $runDate);
            $charged += $result['charged'];
            $skipped += $result['skipped'];
        }

        $this->audit->log('billing.nightly_run', null, [
            'run_date' => $runDate->toDateString(),
            'stays' => $stays,
            'charged' => $charged,
            'skipped' => $skipped,
        ]);

        return ['charged' => $charged, 'skipped' => $skipped, 'stays' => $stays];
    }

    protected function billStay(Stay $stay, Carbon $runDate): array
    {
        $charged = 0;
        $skipped = 0;

        $folio = $this->folios->openForStay($stay->id);
        if (! $folio->isOpen()) {
            return ['charged' => 0, 'skipped' => 0];
        }

        $checkIn = Carbon::parse($stay->checked_in_at)->startOfDay();

        // Last chargeable night: the night before the run date, and before
        // any actual checkout. Expected checkout bounds the range for stays
        // still in house.
        $end = $runDate->copy();
        if ($stay->checked_out_at) {
            $end = min($end, Carbon::parse($stay->checked_out_at)->startOfDay());
        } elseif ($stay->expected_checkout) {
            $end = min($end, Carbon::parse($stay->expected_checkout)->startOfDay());
        }

        $rate = (float) ($stay->reservation->nightly_rate ?? 0);
        if ($rate <= 0) {
            return ['charged' => 0, 'skipped' => 0];
        }

        for ($night = $checkIn->copy(); $night->lt($end); $night->addDay()) {
            $serviceDate = $night->toDateString();

            $exists = FolioLine::where('folio_id', $folio->id)
                ->where('line_type', 'room')
                ->whereDate('service_date', $serviceDate)
                ->exists();

            if ($exists) {
                $skipped++;
                continue;
            }

            $room = $this->roomOccupiedOn($stay, $night);

            DB::transaction(function () use ($folio, $serviceDate, $rate, $room, $stay) {
                $this->folios->addRoomCharge($folio->id, [
                    'service_date' => $serviceDate,
                    'description' => 'Room charge — ' . ($room?->number ?? 'n/a') . " ({$serviceDate})",
                    'quantity' => 1,
                    'unit_price' => $rate,
                    'ref_type' => \App\Domains\FrontDesk\Models\Stay::class,
                    'ref_id' => $stay->id,
                ]);
            });

            $charged++;
        }

        return ['charged' => $charged, 'skipped' => $skipped];
    }

    /**
     * Which room was occupied on a given night. stay->room_id is the CURRENT
     * room, so we walk moves newest-first and undo any move that happened
     * after the night in question.
     */
    protected function roomOccupiedOn(Stay $stay, Carbon $night): ?\App\Domains\Inventory\Models\Room
    {
        $roomId = $stay->room_id;

        $moves = $stay->roomHistory->sortByDesc('created_at');
        foreach ($moves as $move) {
            $moveDate = Carbon::parse($move->created_at)->startOfDay();
            if ($moveDate->gt($night)) {
                $roomId = $move->from_room_id;
            }
        }

        return $roomId
            ? \App\Domains\Inventory\Models\Room::withoutGlobalScopes()->find($roomId)
            : null;
    }
}
