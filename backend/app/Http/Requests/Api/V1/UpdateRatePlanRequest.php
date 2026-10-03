<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

class UpdateRatePlanRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'room_type_id' => ['sometimes', 'integer', 'exists:room_types,id'],
            'name' => ['sometimes', 'string', 'max:80'],
            'base_rate' => ['sometimes', 'numeric', 'min:0'],
            'valid_from' => ['sometimes', 'date'],
            'valid_to' => ['sometimes', 'date'],
            'tax_percent' => ['sometimes', 'numeric', 'min:0', 'max:100'],
            'service_charge_percent' => ['sometimes', 'numeric', 'min:0', 'max:100'],
            'min_stay' => ['sometimes', 'integer', 'min:1'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }
}
