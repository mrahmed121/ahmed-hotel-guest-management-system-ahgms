<?php

namespace App\Http\Requests\Api\V1;

use App\Domains\Inventory\Models\Room;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SetRoomStatusRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'status' => ['required', 'string', Rule::in(Room::STATUSES)],
            'reason' => ['nullable', 'string', 'max:255'],
        ];
    }
}
