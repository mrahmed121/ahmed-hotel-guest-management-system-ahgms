<?php

namespace App\Http\Controllers\Api\V1;

use App\Domains\Reports\Services\ReportService;
use Illuminate\Http\Request;

/**
 * Thin controller — all math lives in ReportService.
 */
class ReportController
{
    public function __construct(private ReportService $reports)
    {
    }

    private function range(Request $request): array
    {
        $request->validate([
            'start_date' => 'required|date',
            'end_date' => 'required|date',
        ]);

        return [$request->string('start_date'), $request->string('end_date')];
    }

    public function occupancy(Request $request)
    {
        return response()->json(['data' => $this->reports->occupancy(...$this->range($request))]);
    }

    public function adr(Request $request)
    {
        return response()->json(['data' => $this->reports->adr(...$this->range($request))]);
    }

    public function revpar(Request $request)
    {
        return response()->json(['data' => $this->reports->revpar(...$this->range($request))]);
    }

    public function revenue(Request $request)
    {
        return response()->json(['data' => $this->reports->revenue(...$this->range($request))]);
    }

    public function reservations(Request $request)
    {
        return response()->json(['data' => $this->reports->reservationsReport(...$this->range($request))]);
    }

    public function frontDesk()
    {
        return response()->json(['data' => $this->reports->frontDeskToday()]);
    }

    public function housekeeping()
    {
        return response()->json(['data' => $this->reports->housekeepingReport()]);
    }

    public function maintenance()
    {
        return response()->json(['data' => $this->reports->maintenanceReport()]);
    }
}
