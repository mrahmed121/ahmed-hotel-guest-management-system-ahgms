<?php

namespace App\Http\Requests\Api\V1;

use App\Domains\Guests\Models\Guest;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class WalkInRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'guest_id' => ['nullable', 'integer', 'exists:guests,id', 'required_without_all:first_name,phone'],
            'first_name' => ['required_without:guest_id', 'nullable', 'string', 'max:100'],
            'last_name' => ['nullable', 'string', 'max:100'],
            'email' => ['nullable', 'email', 'max:150'],
            'phone' => ['required_without:guest_id', 'nullable', 'string', 'max:30'],
            'country' => ['nullable', 'string', 'max:100'],
            'id_type' => ['nullable', 'string', Rule::in(Guest::ID_TYPES)],
            'id_number' => ['nullable', 'string', 'max:100'],
            'address' => ['nullable', 'string', 'max:500'],
            'guest_notes' => ['nullable', 'string', 'max:1000'],
            'room_type_id' => ['required', 'integer', 'exists:room_types,id'],
            'room_id' => ['nullable', 'integer', 'exists:rooms,id'],
            'check_in' => ['nullable', 'date'],
            'check_out' => ['nullable', 'date', 'after:check_in'],
            'adults' => ['nullable', 'integer', 'min:1', 'max:10'],
            'children' => ['nullable', 'integer', 'min:0', 'max:10'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
