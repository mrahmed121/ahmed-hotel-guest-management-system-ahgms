<?php

namespace App\Domains\Folio\Services;

use App\Domains\Folio\Models\Folio;
use App\Domains\Folio\Models\FolioAdjustment;
use App\Domains\Folio\Models\FolioLine;
use App\Domains\FrontDesk\Models\Stay;
use App\Domains\Housekeeping\Models\Service;
use App\Domains\Housekeeping\Services\ServiceCatalogService;
use App\Domains\Shared\Services\AuditService;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * FolioService — the financial core of AHGMS.
 *
 * Design decisions:
 * - One folio per stay (folio.stay_id UNIQUE). openForStay is idempotent.
 * - Folio lines are append-only: posted lines are never updated/deleted.
 *   Corrections use new adjustment/discount lines.
 * - Discounts are stored as negative amounts (both on folio_adjustments and
 *   on the corresponding folio_line with line_type=discount).
 * - balance = charges + discounts − payments. Overpayment is guest credit,
 *   not a negative balance (outstandingBalance floors at 0).
 * - Money is rounded to 2dp at every aggregation boundary.
 */
class FolioService
{
    public function __construct(private AuditService $audit) {}

    /**
     * Open a folio for a stay. Idempotent: returns the existing folio when
     * one is already open for the stay.
     */
    public function openForStay(int $stayId): Folio
    {
        return DB::transaction(function () use ($stayId) {
            $stay = Stay::lockForUpdate()->findOrFail($stayId);

            $existing = Folio::where('stay_id', $stay->id)->first();
            if ($existing) {
                return $existing;
            }

            $folio = Folio::create([
                'hotel_id' => $stay->hotel_id,
                'stay_id' => $stay->id,
                'folio_number' => $this->nextFolioNumber($stay->hotel_id),
                'status' => 'open',
                'opened_at' => now(),
            ]);

            $this->audit->log('folio.opened', $folio, [
                'stay_id' => $stay->id,
                'folio_number' => $folio->folio_number,
            ]);

            return $folio;
        });
    }

    public function folioForStay(int $stayId): ?Folio
    {
        return Folio::where('stay_id', $stayId)->first();
    }

    /**
     * Append a room charge line. Called by NightlyBillingService per night.
     */
    public function addRoomCharge(int $folioId, array $data): FolioLine
    {
        return $this->addLine($folioId, 'room', $data);
    }

    /**
     * Append a service charge line. When service_id is given it must exist
     * (hotel-scoped, active); the description defaults to the service name
     * and unit_price defaults to the service's price unless overridden.
     */
    public function addServiceCharge(int $folioId, array $data): FolioLine
    {
        if (! empty($data['service_id'])) {
            $service = app(ServiceCatalogService::class)->findActive((int) $data['service_id']);
            $data['ref_type'] = Service::class;
            $data['ref_id'] = $service->id;
            $data['description'] ??= $service->name;
            $data['unit_price'] ??= (float) $service->unit_price;
        }

        return $this->addLine($folioId, 'service', $data);
    }

    protected function addLine(int $folioId, string $lineType, array $data): FolioLine
    {
        return DB::transaction(function () use ($folioId, $lineType, $data) {
            $folio = Folio::lockForUpdate()->findOrFail($folioId);
            $this->assertOpen($folio);

            $quantity = round((float) ($data['quantity'] ?? 1), 2);
            $unitPrice = round((float) ($data['unit_price'] ?? 0), 2);

            if ($quantity <= 0) {
                throw ValidationException::withMessages(['quantity' => ['Quantity must be positive.']]);
            }

            $line = FolioLine::create([
                'folio_id' => $folio->id,
                'line_type' => $lineType,
                'description' => $data['description'] ?? ucfirst($lineType) . ' charge',
                'quantity' => $quantity,
                'unit_price' => $unitPrice,
                'amount' => round($quantity * $unitPrice, 2),
                'service_date' => $data['service_date'] ?? null,
                'ref_type' => $data['ref_type'] ?? null,
                'ref_id' => $data['ref_id'] ?? null,
                'created_by' => Auth::id(),
            ]);

            $this->audit->log("folio.{$lineType}_charge", $folio, [
                'line_id' => $line->id,
                'amount' => $line->amount,
                'description' => $line->description,
            ]);

            return $line;
        });
    }

    /**
     * Create an audited adjustment AND its traceability folio line.
     * Discounts must be passed as positive amounts; they are stored negative.
     */
    public function addAdjustment(int $folioId, array $data, ?int $actorId = null): FolioAdjustment
    {
        return DB::transaction(function () use ($folioId, $data, $actorId) {
            $folio = Folio::lockForUpdate()->findOrFail($folioId);
            $this->assertOpen($folio);

            $type = $data['type'] ?? null;
            if (! in_array($type, FolioAdjustment::TYPES, true)) {
                throw ValidationException::withMessages(['type' => ['Invalid adjustment type.']]);
            }

            $amount = round((float) ($data['amount'] ?? 0), 2);
            if ($amount <= 0) {
                throw ValidationException::withMessages(['amount' => ['Amount must be positive.']]);
            }

            if (empty($data['reason'])) {
                throw ValidationException::withMessages(['reason' => ['A reason is required.']]);
            }

            // Discounts are stored negative everywhere.
            $signed = $type === 'discount' ? -$amount : $amount;
            $lineType = $type === 'discount' ? 'discount' : 'adjustment';

            $adjustment = FolioAdjustment::create([
                'folio_id' => $folio->id,
                'type' => $type,
                'amount' => $signed,
                'reason' => $data['reason'],
                'created_by' => $actorId ?? Auth::id(),
                'approved_by' => $data['approved_by'] ?? null,
            ]);

            FolioLine::create([
                'folio_id' => $folio->id,
                'line_type' => $lineType,
                'description' => ($type === 'discount' ? 'Discount: ' : 'Adjustment: ') . $data['reason'],
                'quantity' => 1,
                'unit_price' => $signed,
                'amount' => $signed,
                'service_date' => $data['service_date'] ?? now()->toDateString(),
                'ref_type' => FolioAdjustment::class,
                'ref_id' => $adjustment->id,
                'created_by' => $actorId ?? Auth::id(),
            ]);

            $this->audit->log('folio.adjustment', $folio, [
                'adjustment_id' => $adjustment->id,
                'type' => $type,
                'amount' => $signed,
                'reason' => $data['reason'],
            ]);

            return $adjustment;
        });
    }

    /**
     * Full folio totals. All values rounded to 2dp.
     */
    public function totals(int $folioId): array
    {
        $folio = Folio::findOrFail($folioId);

        $charges = (float) $folio->lines()
            ->whereIn('line_type', FolioLine::CHARGE_TYPES)
            ->sum('amount');

        $discounts = (float) $folio->lines()
            ->where('line_type', 'discount')
            ->sum('amount'); // negative

        $adjustments = (float) $folio->lines()
            ->where('line_type', 'adjustment')
            ->sum('amount'); // signed

        $payments = (float) $folio->payments()->sum('amount');

        $balance = round($charges + $discounts + $adjustments - $payments, 2);

        return [
            'folio_id' => $folio->id,
            'folio_number' => $folio->folio_number,
            'status' => $folio->status,
            'charges' => round($charges, 2),
            'discounts' => round($discounts, 2),
            'adjustments' => round($adjustments, 2),
            'payments' => round($payments, 2),
            'balance' => $balance,
            'outstanding' => max($balance, 0.0),
            'guest_credit' => max(-$balance, 0.0),
        ];
    }

    /** Amount the guest still owes. Never negative (overpayment = credit). */
    public function outstandingBalance(int $folioId): float
    {
        return (float) $this->totals($folioId)['outstanding'];
    }

    /** Overpaid amount held as guest credit. */
    public function guestCredit(int $folioId): float
    {
        return (float) $this->totals($folioId)['guest_credit'];
    }

    /**
     * Close a folio. Only when the balance is fully settled (balance <= 0).
     * A manager override is handled by CheckOutService with $force + reason;
     * close() itself requires a clean balance.
     */
    public function close(int $folioId): Folio
    {
        return DB::transaction(function () use ($folioId) {
            $folio = Folio::lockForUpdate()->findOrFail($folioId);

            if (! $folio->isOpen()) {
                throw ValidationException::withMessages(['folio' => ['Folio is already closed.']]);
            }

            $totals = $this->totals($folio->id);
            if ($totals['balance'] > 0) {
                throw ValidationException::withMessages([
                    'folio' => ["Cannot close folio with outstanding balance {$totals['balance']}."],
                ]);
            }

            $folio->update(['status' => 'closed', 'closed_at' => now()]);

            $this->audit->log('folio.closed', $folio, [
                'folio_number' => $folio->folio_number,
                'final_balance' => $totals['balance'],
            ]);

            return $folio->fresh();
        });
    }

    protected function assertOpen(Folio $folio): void
    {
        if (! $folio->isOpen()) {
            throw ValidationException::withMessages(['folio' => ['Folio is closed; no further charges allowed.']]);
        }
    }

    protected function nextFolioNumber(int $hotelId): string
    {
        $year = now()->format('Y');
        $prefix = "FL-{$year}-";

        $last = Folio::withoutGlobalScopes()
            ->where('hotel_id', $hotelId)
            ->where('folio_number', 'like', $prefix . '%')
            ->orderByDesc('folio_number')
            ->value('folio_number');

        $next = $last ? ((int) substr($last, strlen($prefix)) + 1) : 1;

        return $prefix . str_pad((string) $next, 6, '0', STR_PAD_LEFT);
    }
}
