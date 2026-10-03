<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

class StoreReservationRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'guest_id' => ['required', 'integer', 'exists:guests,id'],
            'room_id' => ['nullable', 'integer', 'exists:rooms,id'],
            'room_type_id' => ['required', 'integer', 'exists:room_types,id'],
            'status' => ['sometimes', 'string', 'in:inquiry,reserved'],
            'check_in' => ['required', 'date', 'date_format:Y-m-d'],
            'check_out' => ['required', 'date', 'date_format:Y-m-d', 'after:check_in'],
            'adults' => ['sometimes', 'integer', 'min:1', 'max:10'],
            'children' => ['sometimes', 'integer', 'min:0', 'max:10'],
            'rate_plan_id' => ['nullable', 'integer', 'exists:rate_plans,id'],
            'source' => ['nullable', 'string', 'in:direct,phone,online,agent'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
