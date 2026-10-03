<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

class UpdateRoomTypeRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        $hotelId = $this->user('api')->hotel_id;
        $id = $this->route('room_type')->id;
        return [
            'name' => ['sometimes', 'string', 'max:80'],
            'code' => ['sometimes', 'string', 'max:20', "unique:room_types,code,{$id},id,hotel_id,{$hotelId}"],
            'description' => ['nullable', 'string'],
            'base_rate' => ['sometimes', 'numeric', 'min:0'],
            'max_occupancy' => ['sometimes', 'integer', 'min:1', 'max:12'],
            'amenities' => ['nullable', 'array'],
            'amenities.*' => ['string', 'max:60'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }
}
