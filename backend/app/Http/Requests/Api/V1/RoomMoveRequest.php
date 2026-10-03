<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

class RoomMoveRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'new_room_id' => ['required', 'integer', 'exists:rooms,id'],
            'reason' => ['required', 'string', 'max:500'],
        ];
    }
}
