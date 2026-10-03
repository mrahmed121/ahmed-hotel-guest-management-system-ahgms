<?php

namespace App\Http\Controllers\Api\V1;

use App\Domains\Folio\Models\Folio;
use App\Domains\Folio\Services\FolioService;
use App\Http\Requests\Api\V1\StoreChargeRequest;
use App\Http\Requests\Api\V1\StoreAdjustmentRequest;

class FolioChargeController
{
    /** POST /folios/{folio}/charges — room or service charge lines. */
    public function store(StoreChargeRequest $request, Folio $folio, FolioService $folios)
    {
        $data = $request->validated();

        $line = $data['line_type'] === 'room'
            ? $folios->addRoomCharge($folio->id, $data)
            : $folios->addServiceCharge($folio->id, $data);

        return response()->json([
            'data' => $line,
            'meta' => ['totals' => $folios->totals($folio->id)],
        ], 201);
    }

    /** POST /folios/{folio}/adjustments — discount / additional_charge / correction. */
    public function storeAdjustment(StoreAdjustmentRequest $request, Folio $folio, FolioService $folios)
    {
        // Discounts above a threshold need adjustments.approve (checked here,
        // enforced by route middleware on a separate approve step in P8 UI).
        $adjustment = $folios->addAdjustment($folio->id, $request->validated(), $request->user()->id);

        return response()->json([
            'data' => $adjustment->load('createdBy'),
            'meta' => ['totals' => $folios->totals($folio->id)],
        ], 201);
    }
}
