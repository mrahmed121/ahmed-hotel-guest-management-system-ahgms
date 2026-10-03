<?php

namespace Tests\Feature;

use App\Domains\Guests\Models\Guest;
use App\Domains\Inventory\Models\Room;
use App\Domains\Inventory\Models\RoomType;
use App\Domains\Shared\Models\Hotel;
use Database\Seeders\GuestSeeder;
use Database\Seeders\HotelSeeder;
use Database\Seeders\InventorySeeder;
use Database\Seeders\ReservationSeeder;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\UserSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AvailabilityTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([
            HotelSeeder::class, RolePermissionSeeder::class, UserSeeder::class,
            InventorySeeder::class, GuestSeeder::class, ReservationSeeder::class,
        ]);
    }

    private function token(): string
    {
        return $this->postJson('/api/v1/auth/login', [
            'email' => 'admin@ahmedgrand.local', 'password' => 'password123',
        ])->json('data.token');
    }

    private function search(array $params)
    {
        return $this->withHeader('Authorization', 'Bearer ' . $this->token())
            ->getJson('/api/v1/availability?' . http_build_query($params));
    }

    private function roomNumbers(\Illuminate\Testing\TestResponse $response): array
    {
        return collect($response->json('data.rooms'))->pluck('number')->sort()->values()->all();
    }

    public function test_booked_room_excluded_from_availability(): void
    {
        // Room 101 is confirmed for 2026-10-10 → 2026-10-13.
        $res = $this->search(['check_in' => '2026-10-11', 'check_out' => '2026-10-12']);
        $res->assertOk();
        $this->assertNotContains('101', $this->roomNumbers($res));

        // Outside the booking window it is available.
        $res2 = $this->search(['check_in' => '2026-10-14', 'check_out' => '2026-10-15']);
        $this->assertContains('101', $this->roomNumbers($res2));
    }

    public function test_maintenance_room_excluded(): void
    {
        $room = Room::where('number', '204')->first();
        $room->update(['status' => 'maintenance']);

        $res = $this->search(['check_in' => '2026-11-01', 'check_out' => '2026-11-03']);
        $this->assertNotContains('204', $this->roomNumbers($res));
    }

    public function test_cancelled_reservation_frees_room(): void
    {
        // Room 302's reservation is cancelled for 2026-10-20 → 2026-10-22.
        $res = $this->search(['check_in' => '2026-10-20', 'check_out' => '2026-10-22']);
        $res->assertOk();
        $this->assertContains('302', $this->roomNumbers($res));
    }

    public function test_same_day_turnover_allowed(): void
    {
        // Room 101 checks out 2026-10-13; new booking starting 2026-10-13 is fine.
        $res = $this->search(['check_in' => '2026-10-13', 'check_out' => '2026-10-14']);
        $res->assertOk();
        $this->assertContains('101', $this->roomNumbers($res));
    }

    public function test_room_type_filter(): void
    {
        $suiteType = RoomType::where('code', 'STE')->first();
        $res = $this->search([
            'check_in' => '2026-11-01', 'check_out' => '2026-11-02',
            'room_type_id' => $suiteType->id,
        ]);
        $res->assertOk();
        foreach ($res->json('data.rooms') as $room) {
            $this->assertEquals('STE', $room['room_type']['code']);
        }
    }

    public function test_occupancy_filter(): void
    {
        // 5 adults needs FAM (4) or bigger... only rooms with max_occupancy >= 5.
        // Seeded max is 4, so expect zero rooms — proves the filter runs.
        $res = $this->search([
            'check_in' => '2026-11-01', 'check_out' => '2026-11-02', 'adults' => 5,
        ]);
        $res->assertOk();
        $this->assertCount(0, $res->json('data.rooms'));

        $res2 = $this->search([
            'check_in' => '2026-11-01', 'check_out' => '2026-11-02', 'adults' => 2,
        ]);
        $this->assertNotCount(0, $res2->json('data.rooms'));
    }

    public function test_nightly_rate_returned(): void
    {
        $res = $this->search(['check_in' => '2026-11-01', 'check_out' => '2026-11-03']);
        $res->assertOk()->assertJsonPath('data.nights', 2);
        $room = collect($res->json('data.rooms'))->firstWhere('number', '101');
        $this->assertNotNull($room);
        // STD has an active rate plan at 8000 base.
        $this->assertEquals('8000.00', $room['nightly_rate']);
    }

    public function test_invalid_dates_rejected(): void
    {
        $this->search(['check_in' => '2026-11-03', 'check_out' => '2026-11-01'])
            ->assertStatus(422);
    }
}
