<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

class StorePaymentRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'method' => ['required', 'in:cash,card,bank_transfer,other'],
            'amount' => ['required', 'numeric', 'min:0.01', 'max:9999999'],
            'reference' => ['nullable', 'string', 'max:255'],
            'idempotency_key' => ['required', 'string', 'max:100'],
            'paid_at' => ['nullable', 'date'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
