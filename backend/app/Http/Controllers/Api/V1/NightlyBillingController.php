<?php

namespace App\Http\Controllers\Api\V1;

use App\Domains\Folio\Services\NightlyBillingService;
use Illuminate\Http\Request;

class NightlyBillingController
{
    /** POST /billing/nightly {date?} — post room charges for all in-house stays. */
    public function run(Request $request, NightlyBillingService $billing)
    {
        $request->validate([
            'date' => ['nullable', 'date'],
        ]);

        $result = $billing->postNightlyCharges($request->input('date'));

        return response()->json(['data' => $result]);
    }
}
