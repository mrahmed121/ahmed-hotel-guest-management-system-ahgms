<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

class StoreAmenityRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        $hotelId = $this->user('api')->hotel_id;
        return [
            'name' => ['required', 'string', 'max:80', "unique:amenities,name,NULL,id,hotel_id,{$hotelId}"],
            'icon' => ['nullable', 'string', 'max:40'],
        ];
    }
}
