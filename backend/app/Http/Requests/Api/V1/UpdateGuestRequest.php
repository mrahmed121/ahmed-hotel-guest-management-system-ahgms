<?php

namespace App\Http\Requests\Api\V1;

use App\Domains\Guests\Models\Guest;
use Illuminate\Foundation\Http\FormRequest;

class UpdateGuestRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'first_name' => ['sometimes', 'string', 'max:60'],
            'last_name' => ['sometimes', 'string', 'max:60'],
            'email' => ['nullable', 'email', 'max:120'],
            'phone' => ['sometimes', 'string', 'max:30'],
            'country' => ['nullable', 'string', 'max:60'],
            'id_type' => ['nullable', 'string', 'in:' . implode(',', Guest::ID_TYPES)],
            'id_number' => ['nullable', 'string', 'max:60'],
            'address' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'vip' => ['sometimes', 'boolean'],
        ];
    }
}
