<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

class UpdateAmenityRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        $hotelId = $this->user('api')->hotel_id;
        $id = $this->route('amenity')->id;
        return [
            'name' => ['sometimes', 'string', 'max:80', "unique:amenities,name,{$id},id,hotel_id,{$hotelId}"],
            'icon' => ['nullable', 'string', 'max:40'],
        ];
    }
}
