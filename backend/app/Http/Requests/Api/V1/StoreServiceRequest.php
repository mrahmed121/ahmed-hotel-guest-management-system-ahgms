<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

class StoreServiceRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        $hotelId = $this->user('api')->hotel_id;
        return [
            'name' => ['required', 'string', 'max:120'],
            'code' => ['required', 'string', 'max:40', "unique:services,code,NULL,id,hotel_id,{$hotelId}"],
            'description' => ['nullable', 'string', 'max:2000'],
            'unit_price' => ['required', 'numeric', 'min:0'],
            'taxable' => ['nullable', 'boolean'],
            'active' => ['nullable', 'boolean'],
        ];
    }
}
