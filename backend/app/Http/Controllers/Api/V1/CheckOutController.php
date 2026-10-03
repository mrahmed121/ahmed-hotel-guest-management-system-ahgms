<?php

namespace App\Http\Controllers\Api\V1;

use App\Domains\FrontDesk\Models\Stay;
use App\Domains\FrontDesk\Services\CheckOutService;
use App\Http\Requests\Api\V1\CheckOutRequest;

class CheckOutController
{
    public function checkOut(CheckOutRequest $request, Stay $stay, CheckOutService $service)
    {
        // Forced checkout over an unsettled folio is a manager override.
        if ($request->boolean('force') && ! $request->user()->hasPermission('stays.manage')) {
            abort(403, 'Forced check-out requires stays.manage permission.');
        }

        $result = $service->checkOut($stay->id, $request->only(['notes', 'force']));

        return response()->json([
            'data' => $result['stay'],
            'meta' => [
                'outstanding_balance' => $result['outstanding_balance'],
                'folio_checked' => $result['folio_checked'],
                'folio_closed' => $result['folio_closed'] ?? false,
                'forced' => $result['forced'],
            ],
        ]);
    }
}
