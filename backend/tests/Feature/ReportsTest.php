<?php

namespace Tests\Feature;

use App\Domains\Folio\Models\Folio;
use App\Domains\Folio\Models\FolioLine;
use App\Domains\Folio\Models\Payment;
use App\Domains\FrontDesk\Models\Stay;
use App\Domains\Guests\Models\Guest;
use App\Domains\Housekeeping\Models\HousekeepingTask;
use App\Domains\Housekeeping\Models\MaintenanceTicket;
use App\Domains\Inventory\Models\Room;
use App\Domains\Reservations\Models\Reservation;
use App\Domains\Shared\Models\Hotel;
use App\Domains\Shared\Models\User;
use Database\Seeders\GuestSeeder;
use Database\Seeders\HotelSeeder;
use Database\Seeders\InventorySeeder;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\UserSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ReportsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([
            HotelSeeder::class, RolePermissionSeeder::class, UserSeeder::class,
            InventorySeeder::class, GuestSeeder::class,
        ]);
    }

    private function token(string $email): string
    {
        return $this->postJson('/api/v1/auth/login', [
            'email' => $email, 'password' => 'password123',
        ])->json('data.token');
    }

    private function auth(string $email = 'frontdesk@ahmedgrand.local')
    {
        return $this->withHeader('Authorization', 'Bearer ' . $this->token($email));
    }

    private function agh(): Hotel
    {
        return Hotel::withoutGlobalScopes()->where('code', 'AGH')->first();
    }

    private function room(string $number): Room
    {
        return Room::withoutGlobalScopes()
            ->where('hotel_id', $this->agh()->id)->where('number', $number)->firstOrFail();
    }

    private function guest(): Guest
    {
        return Guest::withoutGlobalScopes()->where('hotel_id', $this->agh()->id)->firstOrFail();
    }

    /**
     * Build a deterministic stay scenario for 2026-10-01 → 2026-10-03:
     * - Stay 1, room 101: checked in Oct 1 14:00, out Oct 3 11:00 → nights Oct 1, Oct 2
     * - Stay 2, room 102: checked in Oct 2 15:00, still in_house     → nights Oct 2, Oct 3
     * Occupied room-nights = 4 over 3 nights.
     * Folio lines: 101 → room 100×2 (Oct 1,2) + service 50 (Oct 2) + discount -20 (Oct 2)
     *              102 → room 120×2 (Oct 2,3)
     * Payment: 200 on folio 102 (Oct 2).
     */
    protected function seedScenario(): array
    {
        $h = $this->agh()->id;
        $g = $this->guest()->id;

        $res1 = Reservation::create([
            'hotel_id' => $h, 'guest_id' => $g,
            'room_id' => $this->room('101')->id,
            'room_type_id' => $this->room('101')->room_type_id,
            'confirmation_code' => 'RSV-T1', 'status' => 'checked_in',
            'check_in' => '2026-10-01', 'check_out' => '2026-10-03',
            'adults' => 2, 'nightly_rate' => 100, 'total_estimate' => 200,
        ]);
        $res2 = Reservation::create([
            'hotel_id' => $h, 'guest_id' => $g,
            'room_id' => $this->room('102')->id,
            'room_type_id' => $this->room('102')->room_type_id,
            'confirmation_code' => 'RSV-T2', 'status' => 'checked_in',
            'check_in' => '2026-10-02', 'check_out' => '2026-10-05',
            'adults' => 1, 'nightly_rate' => 120, 'total_estimate' => 360,
        ]);

        $s1 = Stay::create([
            'hotel_id' => $h, 'reservation_id' => $res1->id, 'guest_id' => $g,
            'room_id' => $this->room('101')->id, 'status' => 'checked_out',
            'checked_in_at' => '2026-10-01 14:00:00', 'checked_out_at' => '2026-10-03 11:00:00',
            'expected_checkout' => '2026-10-03',
        ]);
        $s2 = Stay::create([
            'hotel_id' => $h, 'reservation_id' => $res2->id, 'guest_id' => $g,
            'room_id' => $this->room('102')->id, 'status' => 'in_house',
            'checked_in_at' => '2026-10-02 15:00:00', 'checked_out_at' => null,
            'expected_checkout' => '2026-10-05',
        ]);

        $f1 = Folio::create(['hotel_id' => $h, 'stay_id' => $s1->id, 'folio_number' => 'FL-T-1', 'status' => 'open', 'opened_at' => now()]);
        $f2 = Folio::create(['hotel_id' => $h, 'stay_id' => $s2->id, 'folio_number' => 'FL-T-2', 'status' => 'open', 'opened_at' => now()]);

        $line = fn ($folio, $type, $amount, $date, $desc) => FolioLine::create([
            'folio_id' => $folio, 'line_type' => $type, 'description' => $desc,
            'quantity' => 1, 'unit_price' => $amount, 'amount' => $amount, 'service_date' => $date,
        ]);
        $line($f1->id, 'room', 100, '2026-10-01', 'Room 2026-10-01');
        $line($f1->id, 'room', 100, '2026-10-02', 'Room 2026-10-02');
        $line($f1->id, 'service', 50, '2026-10-02', 'Laundry');
        $line($f1->id, 'discount', -20, '2026-10-02', 'Promo');
        $line($f2->id, 'room', 120, '2026-10-02', 'Room 2026-10-02');
        $line($f2->id, 'room', 120, '2026-10-03', 'Room 2026-10-03');

        Payment::create([
            'hotel_id' => $h, 'folio_id' => $f2->id, 'receipt_number' => 'RCPT-T-1',
            'method' => 'cash', 'amount' => 200, 'paid_at' => '2026-10-02 18:00:00',
            'idempotency_key' => 'idem-t-1', 'received_by' => 1,
        ]);

        return [$f1->id, $f2->id];
    }

    public function test_occupancy_exact_math(): void
    {
        $this->seedScenario();
        $totalRooms = Room::withoutGlobalScopes()->where('hotel_id', $this->agh()->id)->count();

        $res = $this->auth('audit@ahmedgrand.local')
            ->getJson('/api/v1/reports/occupancy?start_date=2026-10-01&end_date=2026-10-03')
            ->assertOk();

        $d = $res->json('data');
        $this->assertEquals(3, $d['nights']);
        $this->assertEquals($totalRooms, $d['total_rooms']);
        $this->assertEquals(4, $d['occupied_room_nights']);
        $this->assertEquals($totalRooms * 3 - 4, $d['available_room_nights']);
        $this->assertEquals(round(4 / ($totalRooms * 3) * 100, 2), $d['occupancy_rate']);
    }

    public function test_adr_exact_math(): void
    {
        $this->seedScenario();

        $res = $this->auth('audit@ahmedgrand.local')
            ->getJson('/api/v1/reports/adr?start_date=2026-10-01&end_date=2026-10-03')
            ->assertOk();

        $d = $res->json('data');
        $this->assertEquals(440.0, $d['total_room_revenue']); // 100+100+120+120
        $this->assertEquals(4, $d['occupied_room_nights']);
        $this->assertEquals(110.0, $d['adr']);
    }

    public function test_revpar_consistent_with_adr_times_occupancy(): void
    {
        $this->seedScenario();
        $totalRooms = Room::withoutGlobalScopes()->where('hotel_id', $this->agh()->id)->count();

        $rev = $this->auth('audit@ahmedgrand.local')
            ->getJson('/api/v1/reports/revpar?start_date=2026-10-01&end_date=2026-10-03')
            ->assertOk()->json('data');

        $occ = $this->auth('audit@ahmedgrand.local')
            ->getJson('/api/v1/reports/occupancy?start_date=2026-10-01&end_date=2026-10-03')
            ->assertOk()->json('data');

        $adr = $this->auth('audit@ahmedgrand.local')
            ->getJson('/api/v1/reports/adr?start_date=2026-10-01&end_date=2026-10-03')
            ->assertOk()->json('data');

        $this->assertEquals(round(440 / ($totalRooms * 3), 2), $rev['revpar']);
        $this->assertEqualsWithDelta($adr['adr'] * $occ['occupancy_rate'] / 100, $rev['revpar'], 0.02);
    }

    public function test_revenue_breakdown_and_outstanding(): void
    {
        $this->seedScenario();

        $d = $this->auth('audit@ahmedgrand.local')
            ->getJson('/api/v1/reports/revenue?start_date=2026-10-01&end_date=2026-10-03')
            ->assertOk()->json('data');

        $this->assertEquals(440.0, $d['breakdown']['room']);
        $this->assertEquals(50.0, $d['breakdown']['service']);
        $this->assertEquals(-20.0, $d['breakdown']['discount']);
        $this->assertEquals(0.0, $d['breakdown']['tax']);
        $this->assertEquals(470.0, $d['net_revenue']); // 440+50-20
        $this->assertEquals(200.0, $d['payments_total']);
        // Folio1: 250-20=230 charges... 200+50-20=230, no payments → 230
        // Folio2: 240 charges, 200 paid → 40. Outstanding = 270.
        $this->assertEquals(270.0, $d['outstanding_balance']);
    }

    public function test_reservations_report(): void
    {
        $h = $this->agh()->id;
        $g = $this->guest()->id;

        Reservation::create([
            'hotel_id' => $h, 'guest_id' => $g, 'confirmation_code' => 'RSV-R1',
            'room_type_id' => $this->room('101')->room_type_id,
            'status' => 'confirmed', 'check_in' => '2026-11-01', 'check_out' => '2026-11-03',
            'adults' => 2, 'nightly_rate' => 150, 'total_estimate' => 300,
        ]);
        Reservation::create([
            'hotel_id' => $h, 'guest_id' => $g, 'confirmation_code' => 'RSV-R2',
            'room_type_id' => $this->room('101')->room_type_id,
            'status' => 'cancelled', 'check_in' => '2026-11-05', 'check_out' => '2026-11-06',
            'adults' => 1, 'nightly_rate' => 100, 'total_estimate' => 100,
        ]);

        $d = $this->auth('audit@ahmedgrand.local')
            ->getJson('/api/v1/reports/reservations?start_date=2026-11-01&end_date=2026-11-30')
            ->assertOk()->json('data');

        $this->assertEquals(1, $d['by_status']['confirmed'] ?? 0);
        $this->assertEquals(1, $d['by_status']['cancelled'] ?? 0);
        $this->assertEquals(2, $d['total']);
        $this->assertEquals(300.0, $d['active_pipeline_value']); // only confirmed
    }

    public function test_empty_range_returns_zeros(): void
    {
        $d = $this->auth('audit@ahmedgrand.local')
            ->getJson('/api/v1/reports/occupancy?start_date=2030-01-01&end_date=2030-01-07')
            ->assertOk()->json('data');

        $this->assertEquals(0, $d['occupied_room_nights']);
        $this->assertEquals(0.0, $d['occupancy_rate']);

        $a = $this->auth('audit@ahmedgrand.local')
            ->getJson('/api/v1/reports/adr?start_date=2030-01-01&end_date=2030-01-07')
            ->assertOk()->json('data');
        $this->assertEquals(0.0, $a['adr']);
    }

    public function test_cross_hotel_data_is_isolated(): void
    {
        $this->seedScenario();

        $hotelB = Hotel::create(['name' => 'Second Hotel', 'code' => 'SEC']);
        $role = \App\Domains\Shared\Models\Role::where('slug', 'hotel_admin')->first();
        User::create([
            'name' => 'B Admin', 'email' => 'badmin@second.local',
            'password' => bcrypt('password123'), 'role_id' => $role->id,
            'hotel_id' => $hotelB->id, 'is_active' => true,
        ]);

        // Hotel B has no rooms → occupancy must be zero, not hotel A's data.
        $d = $this->auth('badmin@second.local')
            ->getJson('/api/v1/reports/occupancy?start_date=2026-10-01&end_date=2026-10-03')
            ->assertOk()->json('data');

        $this->assertEquals(0, $d['total_rooms']);
        $this->assertEquals(0, $d['occupied_room_nights']);

        $r = $this->auth('badmin@second.local')
            ->getJson('/api/v1/reports/revenue?start_date=2026-10-01&end_date=2026-10-03')
            ->assertOk()->json('data');
        $this->assertEquals(0.0, $r['breakdown']['room']);
    }

    public function test_auditor_can_view_reports_housekeeper_cannot(): void
    {
        $this->auth('audit@ahmedgrand.local')
            ->getJson('/api/v1/reports/occupancy?start_date=2026-10-01&end_date=2026-10-03')
            ->assertOk();

        $this->auth('hk@ahmedgrand.local')
            ->getJson('/api/v1/reports/occupancy?start_date=2026-10-01&end_date=2026-10-03')
            ->assertForbidden();

        // Housekeeper CAN view the dashboard (has dashboard.view).
        $this->auth('hk@ahmedgrand.local')
            ->getJson('/api/v1/dashboard')
            ->assertOk();
    }

    public function test_dashboard_snapshot(): void
    {
        $this->seedScenario();

        $d = $this->auth()->getJson('/api/v1/dashboard')->assertOk()->json('data');

        $this->assertArrayHasKey('occupancy_today', $d);
        $this->assertArrayHasKey('arrivals_today', $d);
        $this->assertArrayHasKey('departures_today', $d);
        $this->assertArrayHasKey('in_house', $d);
        $this->assertArrayHasKey('revenue_mtd', $d);
        $this->assertArrayHasKey('outstanding_balance', $d);
        $this->assertArrayHasKey('housekeeping_queue', $d);
        $this->assertArrayHasKey('maintenance_open', $d);
        $this->assertArrayHasKey('recent_stays', $d);
        $this->assertCount(2, $d['recent_stays']);
    }

    public function test_housekeeping_and_maintenance_reports(): void
    {
        $h = $this->agh()->id;

        $task = HousekeepingTask::create([
            'hotel_id' => $h, 'room_id' => $this->room('101')->id,
            'status' => 'dirty', 'priority' => 'high',
        ]);
        // Backdate via direct assignment (created_at is not mass-assignable).
        $task->created_at = now()->subDays(2);
        $task->updated_at = now()->subDays(2);
        $task->save();
        MaintenanceTicket::create([
            'hotel_id' => $h, 'room_id' => $this->room('102')->id,
            'ticket_number' => 'MT-T-1', 'category' => 'plumbing',
            'priority' => 'urgent', 'status' => 'open', 'title' => 'Leak',
        ]);

        $hk = $this->auth('audit@ahmedgrand.local')
            ->getJson('/api/v1/reports/housekeeping')->assertOk()->json('data');
        $this->assertEquals(1, $hk['by_status']['dirty'] ?? 0);
        $this->assertEquals(1, $hk['overdue_count']);

        $m = $this->auth('audit@ahmedgrand.local')
            ->getJson('/api/v1/reports/maintenance')->assertOk()->json('data');
        $this->assertEquals(1, $m['by_status']['open'] ?? 0);
        $this->assertEquals(1, $m['critical_open_count']);
    }

    public function test_report_endpoints_require_dates(): void
    {
        $this->auth('audit@ahmedgrand.local')
            ->getJson('/api/v1/reports/occupancy')
            ->assertStatus(422);
    }
}
