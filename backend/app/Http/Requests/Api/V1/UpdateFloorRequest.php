<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

class UpdateFloorRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        $hotelId = $this->user('api')->hotel_id;
        $id = $this->route('floor')->id;
        return [
            'number' => ['sometimes', 'integer', 'min:0', "unique:floors,number,{$id},id,hotel_id,{$hotelId}"],
            'name' => ['nullable', 'string', 'max:80'],
        ];
    }
}
