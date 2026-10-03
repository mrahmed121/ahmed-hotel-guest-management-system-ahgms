<?php

namespace App\Http\Controllers\Api\V1;

use App\Domains\Folio\Models\Folio;
use App\Domains\Folio\Models\Payment;
use App\Domains\Folio\Services\PaymentService;
use App\Http\Requests\Api\V1\StorePaymentRequest;

class PaymentController
{
    /** POST /folios/{folio}/payments */
    public function store(StorePaymentRequest $request, Folio $folio, PaymentService $payments)
    {
        $payment = $payments->record($folio->id, $request->validated(), $request->user()->id);

        return response()->json([
            'data' => $payment->load('receivedBy'),
            'meta' => ['receipt' => $payments->receipt($payment->id)],
        ], 201);
    }

    /** GET /folios/{folio}/receipts */
    public function index(Folio $folio)
    {
        return response()->json([
            'data' => $folio->payments()->orderByDesc('paid_at')->paginate(15),
        ]);
    }

    /** GET /payments/{payment}/receipt */
    public function receipt(Payment $payment, PaymentService $payments)
    {
        return response()->json(['data' => $payments->receipt($payment->id)]);
    }
}
