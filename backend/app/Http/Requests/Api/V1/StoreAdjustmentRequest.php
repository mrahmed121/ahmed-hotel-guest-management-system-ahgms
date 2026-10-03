<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

class StoreAdjustmentRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'type' => ['required', 'in:discount,additional_charge,correction'],
            'amount' => ['required', 'numeric', 'min:0.01', 'max:9999999'],
            'reason' => ['required', 'string', 'min:3', 'max:2000'],
            'service_date' => ['nullable', 'date'],
        ];
    }
}
