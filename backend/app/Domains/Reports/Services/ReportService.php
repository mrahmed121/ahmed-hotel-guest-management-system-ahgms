<?php

namespace App\Domains\Reports\Services;

use App\Domains\Folio\Models\Folio;
use App\Domains\Folio\Models\FolioLine;
use App\Domains\Folio\Models\Payment;
use App\Domains\FrontDesk\Models\Stay;
use App\Domains\Housekeeping\Models\HousekeepingTask;
use App\Domains\Housekeeping\Models\MaintenanceTicket;
use App\Domains\Inventory\Models\Room;
use App\Domains\Reservations\Models\Reservation;
use Carbon\Carbon;

/**
 * ReportService — hotel operations reporting.
 *
 * Every method is hotel-scoped automatically: all domain models use the
 * BelongsToHotel trait, whose HotelScope global scope restricts queries to
 * the authenticated user's hotel (super admins bypass).
 *
 * Formulas (also documented in docs/REPORTS.md):
 *
 *   Occupancy rate  = occupied_room_nights / (total_rooms × nights) × 100
 *   ADR             = total_room_revenue / occupied_room_nights
 *   RevPAR          = total_room_revenue / (total_rooms × nights)
 *                   = ADR × occupancy_rate / 100
 *   Folio balance   = charges + discounts + adjustments − payments
 *   Outstanding     = max(folio balance, 0)   (overpayment → guest credit, never negative)
 *
 * Occupied nights: a stay occupies its room for every calendar date D with
 *   D >= date(checked_in_at)  AND  (checked_out_at IS NULL OR D < date(checked_out_at)).
 * This is the standard "room nights sold" definition (the checkout day is free).
 *
 * Room moves: nightly attribution uses the stay's CURRENT room. Mid-stay room
 * moves are recorded in stay_room_history; per-night room attribution across
 * moves is not split (documented simplification).
 *
 * Money is rounded to 2 decimals; rates to 2 decimals.
 */
class ReportService
{
    /** Maximum nights in one report range (protects against pathological ranges). */
    private const MAX_NIGHTS = 366;

    /**
     * Occupancy for an inclusive date range.
     *
     * @return array{start_date:string,end_date:string,nights:int,total_rooms:int,occupied_room_nights:int,available_room_nights:int,occupancy_rate:float}
     */
    public function occupancy(string $startDate, string $endDate): array
    {
        [$start, $end, $nights] = $this->range($startDate, $endDate);

        $totalRooms = Room::count();

        $stays = Stay::query()
            ->where('checked_in_at', '<', $end->copy()->addDay()->startOfDay())
            ->where(function ($q) use ($start) {
                $q->whereNull('checked_out_at')
                  ->orWhere('checked_out_at', '>', $start->copy()->startOfDay());
            })
            ->whereNotNull('room_id')
            ->whereIn('status', ['in_house', 'checked_out'])
            ->get(['id', 'room_id', 'checked_in_at', 'checked_out_at']);

        $occupied = 0;
        $cursor = $start->copy();
        while ($cursor->lte($end)) {
            // Calendar-date comparison per the documented formula:
            // a stay occupies date D iff D >= date(checked_in_at)
            // AND (no checkout OR D < date(checked_out_at)).
            $day = $cursor->toDateString();
            $rooms = [];
            foreach ($stays as $stay) {
                $inDate = Carbon::parse($stay->checked_in_at)->toDateString();
                $outDate = $stay->checked_out_at ? Carbon::parse($stay->checked_out_at)->toDateString() : null;
                if ($inDate <= $day && ($outDate === null || $day < $outDate)) {
                    $rooms[$stay->room_id] = true;
                }
            }
            $occupied += count($rooms);
            $cursor->addDay();
        }

        $capacity = $totalRooms * $nights;
        $available = max($capacity - $occupied, 0);

        return [
            'start_date' => $start->toDateString(),
            'end_date' => $end->toDateString(),
            'nights' => $nights,
            'total_rooms' => $totalRooms,
            'occupied_room_nights' => $occupied,
            'available_room_nights' => $available,
            'occupancy_rate' => $capacity > 0 ? round($occupied / $capacity * 100, 2) : 0.0,
        ];
    }

    /**
     * Average Daily Rate for a date range.
     * ADR = total_room_revenue / occupied_room_nights
     */
    public function adr(string $startDate, string $endDate): array
    {
        $occ = $this->occupancy($startDate, $endDate);
        $revenue = $this->roomRevenue($occ['start_date'], $occ['end_date']);

        return [
            'start_date' => $occ['start_date'],
            'end_date' => $occ['end_date'],
            'total_room_revenue' => $revenue,
            'occupied_room_nights' => $occ['occupied_room_nights'],
            'adr' => $occ['occupied_room_nights'] > 0
                ? round($revenue / $occ['occupied_room_nights'], 2)
                : 0.0,
        ];
    }

    /**
     * Revenue Per Available Room for a date range.
     * RevPAR = total_room_revenue / (total_rooms × nights) = ADR × occupancy_rate / 100
     */
    public function revpar(string $startDate, string $endDate): array
    {
        $occ = $this->occupancy($startDate, $endDate);
        $revenue = $this->roomRevenue($occ['start_date'], $occ['end_date']);
        $capacity = $occ['total_rooms'] * $occ['nights'];

        return [
            'start_date' => $occ['start_date'],
            'end_date' => $occ['end_date'],
            'total_room_revenue' => $revenue,
            'total_rooms' => $occ['total_rooms'],
            'nights' => $occ['nights'],
            'revpar' => $capacity > 0 ? round($revenue / $capacity, 2) : 0.0,
        ];
    }

    /**
     * Revenue breakdown by folio line type, plus payments and outstanding.
     */
    public function revenue(string $startDate, string $endDate): array
    {
        [$start, $end] = array_slice($this->range($startDate, $endDate), 0, 2);

        $byType = FolioLine::query()
            ->whereHas('folio')
            // whereDate (not whereBetween): service_date may carry a time
            // component in SQLite ('2026-10-03 00:00:00'), so a plain
            // BETWEEN '2026-10-01' AND '2026-10-03' would drop the end day.
            ->whereDate('service_date', '>=', $start->toDateString())
            ->whereDate('service_date', '<=', $end->toDateString())
            ->selectRaw('line_type, COALESCE(SUM(amount), 0) as total')
            ->groupBy('line_type')
            ->pluck('total', 'line_type');

        $types = ['room', 'service', 'tax', 'fee', 'discount', 'adjustment'];
        $breakdown = [];
        foreach ($types as $t) {
            $breakdown[$t] = round((float) ($byType[$t] ?? 0), 2);
        }

        $payments = round((float) Payment::query()
            ->whereBetween('paid_at', [$start->copy()->startOfDay(), $end->copy()->endOfDay()])
            ->sum('amount'), 2);

        $grossCharges = $breakdown['room'] + $breakdown['service'] + $breakdown['tax'] + $breakdown['fee'];
        $netRevenue = round($grossCharges + $breakdown['discount'] + $breakdown['adjustment'], 2);

        return [
            'start_date' => $start->toDateString(),
            'end_date' => $end->toDateString(),
            'breakdown' => $breakdown,
            'gross_charges' => round($grossCharges, 2),
            'net_revenue' => $netRevenue,
            'payments_total' => $payments,
            'outstanding_balance' => $this->outstandingBalance(),
        ];
    }

    /**
     * Reservation counts by status + active pipeline value.
     */
    public function reservationsReport(string $startDate, string $endDate): array
    {
        [$start, $end] = array_slice($this->range($startDate, $endDate), 0, 2);

        $counts = Reservation::query()
            ->where(function ($q) use ($start, $end) {
                // Reservations overlapping the range (by stay window).
                $q->where('check_in', '<=', $end->toDateString())
                  ->where('check_out', '>=', $start->toDateString());
            })
            ->selectRaw('status, COUNT(*) as c')
            ->groupBy('status')
            ->pluck('c', 'status');

        $activeValue = round((float) Reservation::query()
            ->where('check_in', '<=', $end->toDateString())
            ->where('check_out', '>=', $start->toDateString())
            ->whereIn('status', Reservation::ACTIVE_STATUSES)
            ->sum('total_estimate'), 2);

        return [
            'start_date' => $start->toDateString(),
            'end_date' => $end->toDateString(),
            'by_status' => $counts->map(fn ($c) => (int) $c)->all(),
            'total' => (int) $counts->sum(),
            'active_pipeline_value' => $activeValue,
        ];
    }

    /**
     * Front desk snapshot for today: arrivals, departures, in-house.
     */
    public function frontDeskToday(): array
    {
        $today = Carbon::today()->toDateString();

        $arrivals = Reservation::with(['guest:id,first_name,last_name', 'roomType:id,name'])
            ->where('check_in', $today)
            ->where('status', 'confirmed')
            ->orderBy('id')
            ->get();

        $departures = Stay::with(['guest:id,first_name,last_name', 'room:id,number'])
            ->where('status', 'in_house')
            ->whereDate('expected_checkout', $today)
            ->orderBy('id')
            ->get();

        $inHouse = Stay::with(['guest:id,first_name,last_name', 'room:id,number'])
            ->where('status', 'in_house')
            ->orderBy('checked_in_at')
            ->limit(50)
            ->get();

        return [
            'date' => $today,
            'arrivals_count' => $arrivals->count(),
            'arrivals' => $arrivals,
            'departures_count' => $departures->count(),
            'departures' => $departures,
            'in_house_count' => Stay::where('status', 'in_house')->count(),
            'in_house' => $inHouse,
        ];
    }

    /**
     * Housekeeping queue: counts by task status + overdue list.
     * Overdue = created more than 24h ago and not yet ready.
     */
    public function housekeepingReport(): array
    {
        $counts = HousekeepingTask::query()
            ->selectRaw('status, COUNT(*) as c')
            ->groupBy('status')
            ->pluck('c', 'status')
            ->map(fn ($c) => (int) $c)
            ->all();

        $overdue = HousekeepingTask::with(['room:id,number'])
            ->where('created_at', '<', Carbon::now()->subDay())
            ->where('status', '!=', 'ready')
            ->orderBy('created_at')
            ->limit(50)
            ->get();

        return [
            'by_status' => $counts,
            'queue_total' => array_sum($counts),
            'overdue_count' => HousekeepingTask::where('created_at', '<', Carbon::now()->subDay())
                ->where('status', '!=', 'ready')->count(),
            'overdue' => $overdue,
        ];
    }

    /**
     * Maintenance: counts by ticket status + open high/urgent list.
     */
    public function maintenanceReport(): array
    {
        $counts = MaintenanceTicket::query()
            ->selectRaw('status, COUNT(*) as c')
            ->groupBy('status')
            ->pluck('c', 'status')
            ->map(fn ($c) => (int) $c)
            ->all();

        $critical = MaintenanceTicket::with(['room:id,number'])
            ->whereIn('priority', ['high', 'urgent'])
            ->whereNotIn('status', ['completed', 'verified', 'closed'])
            ->orderBy('created_at')
            ->limit(50)
            ->get();

        return [
            'by_status' => $counts,
            'open_total' => (int) MaintenanceTicket::whereNotIn('status', ['closed', 'verified'])->count(),
            'critical_open_count' => $critical->count(),
            'critical_open' => $critical,
        ];
    }

    /**
     * Sum of outstanding balances across all open folios.
     * balance = charges + discounts + adjustments − payments; outstanding = max(balance, 0).
     */
    public function outstandingBalance(): float
    {
        $folioIds = Folio::where('status', 'open')->pluck('id');
        if ($folioIds->isEmpty()) {
            return 0.0;
        }

        $lines = FolioLine::whereIn('folio_id', $folioIds)
            ->selectRaw("folio_id,
                COALESCE(SUM(CASE WHEN line_type IN ('room','service','tax','fee') THEN amount ELSE 0 END),0) as charges,
                COALESCE(SUM(CASE WHEN line_type = 'discount' THEN amount ELSE 0 END),0) as discounts,
                COALESCE(SUM(CASE WHEN line_type = 'adjustment' THEN amount ELSE 0 END),0) as adjustments")
            ->groupBy('folio_id')
            ->get()
            ->keyBy('folio_id');

        $payments = Payment::whereIn('folio_id', $folioIds)
            ->selectRaw('folio_id, COALESCE(SUM(amount),0) as paid')
            ->groupBy('folio_id')
            ->pluck('paid', 'folio_id');

        $total = 0.0;
        foreach ($folioIds as $id) {
            $l = $lines->get($id);
            $balance = round(
                (float) ($l->charges ?? 0)
                + (float) ($l->discounts ?? 0)
                + (float) ($l->adjustments ?? 0)
                - (float) ($payments[$id] ?? 0),
                2
            );
            $total += max($balance, 0.0);
        }

        return round($total, 2);
    }

    /**
     * Room revenue (line_type=room) for a date range, hotel-scoped via folio.
     */
    private function roomRevenue(string $startDate, string $endDate): float
    {
        return round((float) FolioLine::query()
            ->whereHas('folio')
            ->where('line_type', 'room')
            ->whereDate('service_date', '>=', $startDate)
            ->whereDate('service_date', '<=', $endDate)
            ->sum('amount'), 2);
    }

    /**
     * Normalise + validate a date range. Returns [Carbon start, Carbon end, int nights].
     */
    private function range(string $startDate, string $endDate): array
    {
        $start = Carbon::parse($startDate)->startOfDay();
        $end = Carbon::parse($endDate)->startOfDay();

        if ($end->lt($start)) {
            [$start, $end] = [$end, $start];
        }

        $nights = $start->diffInDays($end) + 1;
        if ($nights > self::MAX_NIGHTS) {
            $end = $start->copy()->addDays(self::MAX_NIGHTS - 1);
            $nights = self::MAX_NIGHTS;
        }

        return [$start, $end, $nights];
    }
}
