<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

class UpdateReservationRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'room_id' => ['nullable', 'integer', 'exists:rooms,id'],
            'check_in' => ['sometimes', 'date', 'date_format:Y-m-d'],
            'check_out' => ['sometimes', 'date', 'date_format:Y-m-d'],
            'adults' => ['sometimes', 'integer', 'min:1', 'max:10'],
            'children' => ['sometimes', 'integer', 'min:0', 'max:10'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
