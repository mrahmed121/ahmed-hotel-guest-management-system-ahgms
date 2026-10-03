<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

class StoreHousekeepingTaskRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'room_id' => ['required', 'integer', 'exists:rooms,id'],
            'priority' => ['nullable', 'in:low,normal,high,urgent'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
