<?php

namespace App\Domains\Reports\Services;

use App\Domains\FrontDesk\Models\Stay;
use App\Domains\Housekeeping\Models\HousekeepingTask;
use App\Domains\Housekeeping\Models\MaintenanceTicket;
use App\Domains\Reservations\Models\Reservation;
use Carbon\Carbon;

/**
 * DashboardService — aggregates the management dashboard from live queries.
 * Every figure comes from ReportService or direct queries; nothing is hardcoded.
 */
class DashboardService
{
    public function __construct(private ReportService $reports)
    {
    }

    public function snapshot(): array
    {
        $today = Carbon::today();
        $monthStart = $today->copy()->startOfMonth();

        $occ = $this->reports->occupancy($today->toDateString(), $today->toDateString());
        $mtd = $this->reports->revenue($monthStart->toDateString(), $today->toDateString());
        $fd = $this->reports->frontDeskToday();

        $hkQueue = HousekeepingTask::query()
            ->whereIn('status', ['dirty', 'assigned', 'cleaning', 'inspection'])
            ->selectRaw('status, COUNT(*) as c')
            ->groupBy('status')
            ->pluck('c', 'status')
            ->map(fn ($c) => (int) $c)
            ->all();

        $recentStays = Stay::with(['guest:id,first_name,last_name', 'room:id,number'])
            ->orderByDesc('checked_in_at')
            ->limit(5)
            ->get();

        return [
            'date' => $today->toDateString(),
            'occupancy_today' => $occ,
            'arrivals_today' => $fd['arrivals_count'],
            'departures_today' => $fd['departures_count'],
            'in_house' => $fd['in_house_count'],
            'revenue_mtd' => [
                'room' => $mtd['breakdown']['room'],
                'service' => $mtd['breakdown']['service'],
                'net_revenue' => $mtd['net_revenue'],
            ],
            'outstanding_balance' => $mtd['outstanding_balance'],
            'housekeeping_queue' => [
                'dirty' => $hkQueue['dirty'] ?? 0,
                'assigned' => $hkQueue['assigned'] ?? 0,
                'cleaning' => $hkQueue['cleaning'] ?? 0,
                'inspection' => $hkQueue['inspection'] ?? 0,
                'total' => array_sum($hkQueue),
            ],
            'maintenance_open' => (int) MaintenanceTicket::whereNotIn('status', ['closed', 'verified'])->count(),
            'reservations_confirmed_today' => (int) Reservation::where('status', 'confirmed')->count(),
            'recent_stays' => $recentStays,
        ];
    }
}
