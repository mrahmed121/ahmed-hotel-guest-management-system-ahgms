<?php

namespace App\Http\Controllers\Api\V1;

use App\Domains\Reports\Services\DashboardService;

/**
 * Thin controller — aggregation lives in DashboardService.
 */
class DashboardController
{
    public function __construct(private DashboardService $dashboard)
    {
    }

    public function show()
    {
        return response()->json(['data' => $this->dashboard->snapshot()]);
    }
}
