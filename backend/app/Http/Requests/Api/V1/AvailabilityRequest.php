<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

class AvailabilityRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'check_in' => ['required', 'date', 'date_format:Y-m-d'],
            'check_out' => ['required', 'date', 'date_format:Y-m-d', 'after:check_in'],
            'room_type_id' => ['nullable', 'integer', 'exists:room_types,id'],
            'adults' => ['nullable', 'integer', 'min:1', 'max:10'],
            'hotel_id' => ['nullable', 'integer', 'exists:hotels,id'],
        ];
    }
}
