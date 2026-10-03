<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

class CheckOutRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'notes' => ['nullable', 'string', 'max:1000'],
            // Manager override for unsettled folio (P5): requires stays.manage.
            'force' => ['nullable', 'boolean'],
        ];
    }
}
