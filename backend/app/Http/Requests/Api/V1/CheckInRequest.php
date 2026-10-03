<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

class CheckInRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'reservation_id' => ['required', 'integer', 'exists:reservations,id'],
            'room_id' => ['nullable', 'integer', 'exists:rooms,id'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
