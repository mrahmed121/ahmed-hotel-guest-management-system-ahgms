<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

class StoreFloorRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        $hotelId = $this->user('api')->hotel_id;
        return [
            'number' => ['required', 'integer', 'min:0', "unique:floors,number,NULL,id,hotel_id,{$hotelId}"],
            'name' => ['nullable', 'string', 'max:80'],
        ];
    }
}
