<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

class UpdateRoomRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        $hotelId = $this->user('api')->hotel_id;
        $id = $this->route('room')->id;
        return [
            'floor_id' => ['nullable', 'integer', 'exists:floors,id'],
            'room_type_id' => ['sometimes', 'integer', 'exists:room_types,id'],
            'number' => ['sometimes', 'string', 'max:20', "unique:rooms,number,{$id},id,hotel_id,{$hotelId}"],
            'features' => ['nullable', 'array'],
            'features.*' => ['string', 'max:60'],
            'notes' => ['nullable', 'string', 'max:500'],
        ];
    }
}
