<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

class UpdateServiceRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        $hotelId = $this->user('api')->hotel_id;
        $id = $this->route('service')?->id;
        return [
            'name' => ['sometimes', 'string', 'max:120'],
            'code' => ['sometimes', 'string', 'max:40', "unique:services,code,{$id},id,hotel_id,{$hotelId}"],
            'description' => ['nullable', 'string', 'max:2000'],
            'unit_price' => ['sometimes', 'numeric', 'min:0'],
            'taxable' => ['nullable', 'boolean'],
            'active' => ['nullable', 'boolean'],
        ];
    }
}
