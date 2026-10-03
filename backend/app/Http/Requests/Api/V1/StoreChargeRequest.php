<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

class StoreChargeRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        // When service_id is given, description/unit_price default from
        // the catalog (FolioService::addServiceCharge).
        $fromCatalog = $this->filled('service_id');

        return [
            'line_type' => ['required', 'in:room,service'],
            'description' => [$fromCatalog ? 'nullable' : 'required', 'string', 'max:255'],
            'quantity' => ['nullable', 'numeric', 'min:0.01', 'max:9999'],
            'unit_price' => [$fromCatalog ? 'nullable' : 'required', 'numeric', 'min:0', 'max:9999999'],
            'service_date' => ['nullable', 'date'],
            'service_id' => ['nullable', 'integer', 'exists:services,id'],
        ];
    }
}
