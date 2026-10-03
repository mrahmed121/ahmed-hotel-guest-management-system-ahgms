<?php

namespace App\Domains\Folio\Services;

use App\Domains\Folio\Models\Folio;
use App\Domains\Folio\Models\Payment;
use App\Domains\Shared\Services\AuditService;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * PaymentService — records folio payments.
 *
 * Idempotency: idempotency_key is UNIQUE. Recording with a key that already
 * exists returns the existing payment (no duplicate, no error).
 *
 * Overpayment: allowed and recorded as guest credit (balance floors at 0 in
 * FolioService::totals). The payment itself is never negative.
 */
class PaymentService
{
    public function __construct(
        private FolioService $folios,
        private AuditService $audit,
    ) {}

    public function record(int $folioId, array $data, ?int $actorId = null): Payment
    {
        return DB::transaction(function () use ($folioId, $data, $actorId) {
            $folio = Folio::lockForUpdate()->findOrFail($folioId);

            if (! $folio->isOpen()) {
                throw ValidationException::withMessages(['folio' => ['Folio is closed; no payments allowed.']]);
            }

            if (! in_array($data['method'] ?? null, Payment::METHODS, true)) {
                throw ValidationException::withMessages(['method' => ['Invalid payment method.']]);
            }

            $amount = round((float) ($data['amount'] ?? 0), 2);
            if ($amount <= 0) {
                throw ValidationException::withMessages(['amount' => ['Amount must be positive.']]);
            }

            if (empty($data['idempotency_key'])) {
                throw ValidationException::withMessages(['idempotency_key' => ['Idempotency key is required.']]);
            }

            // Idempotent replay: return the existing payment.
            $existing = Payment::where('idempotency_key', $data['idempotency_key'])->first();
            if ($existing) {
                return $existing;
            }

            $payment = Payment::create([
                'hotel_id' => $folio->hotel_id,
                'folio_id' => $folio->id,
                'receipt_number' => $this->nextReceiptNumber($folio->hotel_id),
                'method' => $data['method'],
                'amount' => $amount,
                'paid_at' => $data['paid_at'] ?? now(),
                'reference' => $data['reference'] ?? null,
                'idempotency_key' => $data['idempotency_key'],
                'received_by' => $actorId ?? Auth::id(),
                'notes' => $data['notes'] ?? null,
            ]);

            $totals = $this->folios->totals($folio->id);

            $this->audit->log('folio.payment', $folio, [
                'payment_id' => $payment->id,
                'receipt_number' => $payment->receipt_number,
                'method' => $payment->method,
                'amount' => $payment->amount,
                'balance_after' => $totals['balance'],
                'guest_credit' => $totals['guest_credit'],
            ]);

            return $payment;
        });
    }

    /**
     * Receipt data for JSON / future PDF rendering.
     */
    public function receipt(int $paymentId): array
    {
        $payment = Payment::with(['folio.stay.guest', 'folio.stay.room', 'receivedBy'])->findOrFail($paymentId);
        $folio = $payment->folio;
        $totals = $this->folios->totals($folio->id);

        return [
            'receipt_number' => $payment->receipt_number,
            'paid_at' => $payment->paid_at->toDateTimeString(),
            'method' => $payment->method,
            'amount' => (float) $payment->amount,
            'reference' => $payment->reference,
            'received_by' => $payment->receivedBy?->name,
            'folio' => [
                'folio_number' => $folio->folio_number,
                'guest' => $folio->stay->guest->full_name ?? null,
                'room' => $folio->stay->room->number ?? null,
            ],
            'totals' => $totals,
        ];
    }

    protected function nextReceiptNumber(int $hotelId): string
    {
        $year = now()->format('Y');
        $prefix = "RCPT-{$year}-";

        $last = Payment::withoutGlobalScopes()
            ->where('hotel_id', $hotelId)
            ->where('receipt_number', 'like', $prefix . '%')
            ->orderByDesc('receipt_number')
            ->value('receipt_number');

        $next = $last ? ((int) substr($last, strlen($prefix)) + 1) : 1;

        return $prefix . str_pad((string) $next, 6, '0', STR_PAD_LEFT);
    }
}
