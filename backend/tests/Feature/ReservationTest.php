<?php

namespace Tests\Feature;

use App\Domains\Guests\Models\Guest;
use App\Domains\Inventory\Models\Room;
use App\Domains\Inventory\Models\RoomType;
use App\Domains\Reservations\Models\Reservation;
use App\Domains\Shared\Models\Hotel;
use App\Domains\Shared\Models\Role;
use App\Domains\Shared\Models\User;
use Database\Seeders\GuestSeeder;
use Database\Seeders\HotelSeeder;
use Database\Seeders\InventorySeeder;
use Database\Seeders\ReservationSeeder;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\UserSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ReservationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([
            HotelSeeder::class, RolePermissionSeeder::class, UserSeeder::class,
            InventorySeeder::class, GuestSeeder::class, ReservationSeeder::class,
        ]);

        $hotelB = Hotel::create(['name' => 'Second Hotel', 'code' => 'SEC']);
        $adminRole = Role::where('slug', 'hotel_admin')->first();
        User::create([
            'name' => 'Hotel B Admin', 'email' => 'admin@secondhotel.local',
            'password' => 'password123', 'role_id' => $adminRole->id,
            'hotel_id' => $hotelB->id,
        ]);
    }

    private function token(string $email): string
    {
        return $this->postJson('/api/v1/auth/login', [
            'email' => $email, 'password' => 'password123',
        ])->json('data.token');
    }

    private function auth(string $email = 'admin@ahmedgrand.local')
    {
        return $this->withHeader('Authorization', 'Bearer ' . $this->token($email));
    }

    private function agh(): Hotel
    {
        return Hotel::where('code', 'AGH')->first();
    }

    private function makeReservation(array $overrides = []): \Illuminate\Testing\TestResponse
    {
        $guest = Guest::where('status', 'active')->first();
        // Default to STD; if room_id is given, use that room's actual type.
        $roomTypeId = $overrides['room_type_id'] ?? null;
        if ($roomTypeId === null && ! empty($overrides['room_id'])) {
            $roomTypeId = Room::find($overrides['room_id'])->room_type_id;
        }
        $roomTypeId ??= RoomType::where('hotel_id', $this->agh()->id)->where('code', 'STD')->first()->id;
        return $this->auth()->postJson('/api/v1/reservations', array_merge([
            'guest_id' => $guest->id,
            'room_type_id' => $roomTypeId,
            'check_in' => '2026-12-01',
            'check_out' => '2026-12-03',
        ], $overrides));
    }

    public function test_reservation_create_with_estimate(): void
    {
        $res = $this->makeReservation();
        $res->assertCreated()
            ->assertJsonPath('data.status', 'reserved')
            ->assertJsonPath('data.nightly_rate', '8000.00')
            ->assertJsonPath('data.total_estimate', '16000.00'); // 2 nights × 8000
        $this->assertMatchesRegularExpression(
            '/^RSV-2026-\d{6}$/', $res->json('data.confirmation_code')
        );
    }

    public function test_confirmation_code_unique(): void
    {
        $a = $this->makeReservation(['check_in' => '2026-12-01', 'check_out' => '2026-12-02']);
        $b = $this->makeReservation(['check_in' => '2026-12-05', 'check_out' => '2026-12-06']);
        $this->assertNotEquals(
            $a->json('data.confirmation_code'), $b->json('data.confirmation_code')
        );
    }

    public function test_overlap_rejected_for_same_room(): void
    {
        $room = Room::where('number', '103')->first();
        $this->makeReservation([
            'room_id' => $room->id, 'check_in' => '2026-12-10', 'check_out' => '2026-12-13',
        ])->assertCreated();

        // Overlapping range → 422
        $this->makeReservation([
            'room_id' => $room->id, 'check_in' => '2026-12-12', 'check_out' => '2026-12-15',
        ])->assertStatus(422);

        // Enveloping range → 422
        $this->makeReservation([
            'room_id' => $room->id, 'check_in' => '2026-12-09', 'check_out' => '2026-12-14',
        ])->assertStatus(422);
    }

    public function test_adjacent_dates_allowed_same_day_turnover(): void
    {
        $room = Room::where('number', '104')->first();
        $this->makeReservation([
            'room_id' => $room->id, 'check_in' => '2026-12-10', 'check_out' => '2026-12-12',
        ])->assertCreated();

        // Checkout 12th, next checkin 12th → allowed.
        $this->makeReservation([
            'room_id' => $room->id, 'check_in' => '2026-12-12', 'check_out' => '2026-12-14',
        ])->assertCreated();
    }

    public function test_cancelled_reservation_does_not_block(): void
    {
        $room = Room::where('number', '105')->first();
        $created = $this->makeReservation([
            'room_id' => $room->id, 'check_in' => '2026-12-10', 'check_out' => '2026-12-13',
        ])->assertCreated();
        $id = $created->json('data.id');

        $this->auth()->postJson("/api/v1/reservations/{$id}/cancel", ['reason' => 'test'])
            ->assertOk()->assertJsonPath('data.status', 'cancelled');

        // Same room + dates now bookable.
        $this->makeReservation([
            'room_id' => $room->id, 'check_in' => '2026-12-10', 'check_out' => '2026-12-13',
        ])->assertCreated();
    }

    public function test_no_show_releases_room(): void
    {
        $room = Room::where('number', '106')->first();
        $created = $this->makeReservation([
            'room_id' => $room->id, 'check_in' => '2026-12-10', 'check_out' => '2026-12-13',
        ])->assertCreated();
        $id = $created->json('data.id');

        $this->auth()->postJson("/api/v1/reservations/{$id}/no-show")
            ->assertOk()->assertJsonPath('data.status', 'no_show');

        $this->assertEquals('available', $room->fresh()->status);
    }

    public function test_illegal_transitions_blocked(): void
    {
        $created = $this->makeReservation()->assertCreated();
        $id = $created->json('data.id');

        // Direct check-in via transition endpoint is blocked (P4 owns it).
        $this->auth()->postJson("/api/v1/reservations/{$id}/confirm")
            ->assertOk(); // reserved → confirmed is legal

        // confirmed → checked_out is illegal (must go through checked_in)
        $res = Reservation::find($id);
        $res->update(['status' => 'confirmed']);
        // There is no direct endpoint for checked_out; verify model guard:
        $this->assertFalse($res->fresh()->canTransitionTo('checked_out'));
        $this->assertFalse($res->fresh()->canTransitionTo('checked_in'));
    }

    public function test_cancelled_cannot_be_modified(): void
    {
        $cancelled = Reservation::where('status', 'cancelled')->first();
        $this->auth()->putJson("/api/v1/reservations/{$cancelled->id}", [
            'check_in' => '2026-11-01', 'check_out' => '2026-11-03',
        ])->assertStatus(422);
    }

    public function test_reservation_hotel_isolation(): void
    {
        $response = $this->auth('admin@secondhotel.local')->getJson('/api/v1/reservations');
        $response->assertOk();
        $this->assertCount(0, $response->json('data'));

        $resA = Reservation::withoutGlobalScopes()->first();
        $this->auth('admin@secondhotel.local')->getJson("/api/v1/reservations/{$resA->id}")
            ->assertNotFound();
    }

    public function test_unassignable_room_rejected(): void
    {
        $room = Room::where('number', '101')->first();
        $room->update(['status' => 'maintenance']);

        $this->makeReservation([
            'room_id' => $room->id, 'check_in' => '2026-12-20', 'check_out' => '2026-12-22',
        ])->assertStatus(422);
    }
}
