<?php

namespace Tests\Feature;

use App\Domains\FrontDesk\Models\Stay;
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
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\UserSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FrontDeskTest extends TestCase
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

    private function auth(string $email = 'reception@ahmedgrand.local')
    {
        return $this->withHeader('Authorization', 'Bearer ' . $this->token($email));
    }

    private function agh(): Hotel
    {
        return Hotel::where('code', 'AGH')->first();
    }

    private function activeGuest(): Guest
    {
        return Guest::where('hotel_id', $this->agh()->id)->where('status', 'active')->first();
    }

    private function stdType(): RoomType
    {
        return RoomType::where('hotel_id', $this->agh()->id)->where('code', 'STD')->first();
    }

    /** Create a reservation for today → tomorrow via the API (default status reserved). */
    private function makeReservation(array $overrides = [])
    {
        $payload = array_merge([
            'guest_id' => $this->activeGuest()->id,
            'room_type_id' => $this->stdType()->id,
            'room_id' => Room::where('hotel_id', $this->agh()->id)->where('number', '101')->first()->id,
            'check_in' => now()->toDateString(),
            'check_out' => now()->addDay()->toDateString(),
        ], $overrides);

        return $this->auth('frontdesk@ahmedgrand.local')->postJson('/api/v1/reservations', $payload);
    }

    /** Create a reservation and confirm it via the confirm endpoint. */
    private function makeConfirmedReservation(array $overrides = []): int
    {
        $resId = $this->makeReservation($overrides)->assertCreated()->json('data.id');
        $this->auth('frontdesk@ahmedgrand.local')
            ->postJson("/api/v1/reservations/{$resId}/confirm")
            ->assertOk();

        return $resId;
    }

    public function test_check_in_happy_path(): void
    {
        $resId = $this->makeConfirmedReservation();

        $res = $this->auth()->postJson('/api/v1/stays/check-in', [
            'reservation_id' => $resId,
        ]);
        $res->assertCreated()
            ->assertJsonPath('data.status', 'in_house')
            ->assertJsonPath('meta.early_check_in', false);

        $stay = Stay::find($res->json('data.id'));
        $this->assertEquals('in_house', $stay->status);
        $this->assertEquals('occupied', $stay->room->fresh()->status);
        $this->assertEquals('checked_in', $stay->reservation->fresh()->status);
    }

    public function test_double_check_in_rejected(): void
    {
        $resId = $this->makeConfirmedReservation();

        $this->auth()->postJson('/api/v1/stays/check-in', ['reservation_id' => $resId])
            ->assertCreated();
        $this->auth()->postJson('/api/v1/stays/check-in', ['reservation_id' => $resId])
            ->assertStatus(422);
    }

    public function test_check_in_blacklisted_guest_rejected(): void
    {
        $guest = $this->activeGuest();
        $resId = $this->makeConfirmedReservation(['guest_id' => $guest->id]);

        // Guest blacklisted after booking — check-in must refuse.
        $this->auth('frontdesk@ahmedgrand.local')
            ->postJson("/api/v1/guests/{$guest->id}/blacklist")
            ->assertOk();

        $this->auth()->postJson('/api/v1/stays/check-in', ['reservation_id' => $resId])
            ->assertStatus(422);
    }

    public function test_check_in_reserved_auto_confirms(): void
    {
        // Documented design: 'reserved' is auto-confirmed as part of check-in.
        $resId = $this->makeReservation()->assertCreated()->json('data.id');

        $this->auth()->postJson('/api/v1/stays/check-in', ['reservation_id' => $resId])
            ->assertCreated()
            ->assertJsonPath('data.status', 'in_house');

        $this->assertEquals('checked_in', Reservation::find($resId)->status);
    }

    public function test_check_in_cancelled_rejected(): void
    {
        $resId = $this->makeConfirmedReservation();
        $this->auth('frontdesk@ahmedgrand.local')
            ->postJson("/api/v1/reservations/{$resId}/cancel")
            ->assertOk();

        $this->auth()->postJson('/api/v1/stays/check-in', ['reservation_id' => $resId])
            ->assertStatus(422);
    }

    public function test_check_in_too_early_rejected(): void
    {
        $resId = $this->makeConfirmedReservation([
            'check_in' => now()->addDays(5)->toDateString(),
            'check_out' => now()->addDays(7)->toDateString(),
        ]);

        $this->auth()->postJson('/api/v1/stays/check-in', ['reservation_id' => $resId])
            ->assertStatus(422);
    }

    public function test_walk_in_creates_guest_reservation_stay(): void
    {
        $res = $this->auth()->postJson('/api/v1/stays/walk-in', [
            'first_name' => 'Walk',
            'last_name' => 'Inson',
            'phone' => '+920000000001',
            'room_type_id' => $this->stdType()->id,
            'adults' => 2,
        ]);

        $res->assertCreated()
            ->assertJsonPath('data.status', 'in_house')
            ->assertJsonPath('meta.walk_in', true);

        $stay = Stay::find($res->json('data.id'));
        $this->assertEquals('Walk Inson', $stay->guest->full_name);
        $this->assertEquals('walk_in', $stay->reservation->source);
        $this->assertEquals('checked_in', $stay->reservation->status);
        $this->assertEquals('occupied', $stay->room->fresh()->status);
    }

    public function test_check_out_happy_path(): void
    {
        $resId = $this->makeConfirmedReservation();
        $stayId = $this->auth()->postJson('/api/v1/stays/check-in', [
            'reservation_id' => $resId,
        ])->assertCreated()->json('data.id');
        $roomId = Stay::find($stayId)->room_id;

        $res = $this->auth()->postJson("/api/v1/stays/{$stayId}/check-out");
        $res->assertOk()
            ->assertJsonPath('data.status', 'checked_out')
            ->assertJsonPath('meta.folio_checked', true) // P5 folio module present
            ->assertJsonPath('meta.folio_closed', true); // zero balance → folio auto-closed

        $this->assertEquals('checked_out', Stay::find($stayId)->status);
        $this->assertEquals('dirty', Room::find($roomId)->status);
        $this->assertEquals('checked_out', Reservation::find($resId)->status);
    }

    public function test_double_check_out_rejected(): void
    {
        $resId = $this->makeConfirmedReservation();
        $stayId = $this->auth()->postJson('/api/v1/stays/check-in', [
            'reservation_id' => $resId,
        ])->assertCreated()->json('data.id');

        $this->auth()->postJson("/api/v1/stays/{$stayId}/check-out")->assertOk();
        $this->auth()->postJson("/api/v1/stays/{$stayId}/check-out")->assertStatus(422);
    }

    public function test_room_move_happy_path(): void
    {
        $resId = $this->makeConfirmedReservation();
        $stayId = $this->auth()->postJson('/api/v1/stays/check-in', [
            'reservation_id' => $resId,
        ])->assertCreated()->json('data.id');
        $oldRoomId = Stay::find($stayId)->room_id;
        $newRoomId = Room::where('hotel_id', $this->agh()->id)->where('number', '102')->first()->id;

        $res = $this->auth('frontdesk@ahmedgrand.local')->postJson("/api/v1/stays/{$stayId}/room-move", [
            'new_room_id' => $newRoomId,
            'reason' => 'Guest requested quieter room',
        ]);
        $res->assertOk()->assertJsonPath('data.room_id', $newRoomId);

        $stay = Stay::find($stayId);
        $this->assertEquals($newRoomId, $stay->room_id);
        $this->assertEquals('dirty', Room::find($oldRoomId)->status);
        $this->assertEquals('occupied', Room::find($newRoomId)->status);

        $history = $stay->roomHistory;
        $this->assertCount(1, $history);
        $this->assertEquals($oldRoomId, $history[0]->from_room_id);
        $this->assertEquals($newRoomId, $history[0]->to_room_id);
        $this->assertEquals('Guest requested quieter room', $history[0]->reason);
        $this->assertNotNull($history[0]->actor_id);
    }

    public function test_room_move_to_occupied_room_rejected(): void
    {
        // Stay A in room 101.
        $resA = $this->makeConfirmedReservation();
        $stayA = $this->auth()->postJson('/api/v1/stays/check-in', [
            'reservation_id' => $resA,
        ])->assertCreated()->json('data.id');

        // Stay B in room 102 (different guest).
        $guestB = Guest::where('hotel_id', $this->agh()->id)
            ->where('status', 'active')->skip(1)->first();
        $resB = $this->makeConfirmedReservation([
            'guest_id' => $guestB->id,
            'room_id' => Room::where('hotel_id', $this->agh()->id)->where('number', '102')->first()->id,
        ]);
        $this->auth()->postJson('/api/v1/stays/check-in', ['reservation_id' => $resB])->assertCreated();
        $occupiedRoomId = Stay::where('reservation_id', $resB)->first()->room_id;

        // Try to move stay A into stay B's room.
        $this->auth('frontdesk@ahmedgrand.local')->postJson("/api/v1/stays/{$stayA}/room-move", [
            'new_room_id' => $occupiedRoomId,
            'reason' => 'Trying occupied room',
        ])->assertStatus(422);
    }

    public function test_stay_index_defaults_to_in_house(): void
    {
        $resId = $this->makeConfirmedReservation();
        $this->auth()->postJson('/api/v1/stays/check-in', ['reservation_id' => $resId])->assertCreated();

        $res = $this->auth()->getJson('/api/v1/stays');
        $res->assertOk();
        foreach ($res->json('data') as $stay) {
            $this->assertEquals('in_house', $stay['status']);
        }
        $this->assertGreaterThanOrEqual(1, count($res->json('data')));
    }

    public function test_cross_hotel_isolation_returns_404(): void
    {
        $hotelB = Hotel::create(['name' => 'Second Hotel', 'code' => 'SEC']);
        $adminRole = Role::where('slug', 'hotel_admin')->first();
        User::create([
            'name' => 'Hotel B Admin', 'email' => 'admin@secondhotel.local',
            'password' => 'password123', 'role_id' => $adminRole->id,
            'hotel_id' => $hotelB->id,
        ]);

        // Reservation belongs to hotel A (AGH).
        $resId = $this->makeConfirmedReservation();

        // Hotel B admin must not see it → 404, not 403.
        $tokenB = $this->token('admin@secondhotel.local');
        $this->withHeader('Authorization', 'Bearer ' . $tokenB)
            ->postJson('/api/v1/stays/check-in', ['reservation_id' => $resId])
            ->assertNotFound();
    }

    public function test_rbac_receptionist_can_check_in_housekeeper_cannot(): void
    {
        $resId = $this->makeConfirmedReservation();

        // Receptionist has check-in.
        $this->auth('reception@ahmedgrand.local')
            ->postJson('/api/v1/stays/check-in', ['reservation_id' => $resId])
            ->assertCreated();

        // Housekeeper lacks check-in → 403 (different room to avoid overlap).
        $resId2 = $this->makeConfirmedReservation([
            'room_id' => Room::where('hotel_id', $this->agh()->id)->where('number', '102')->first()->id,
        ]);
        $this->auth('hk@ahmedgrand.local')
            ->postJson('/api/v1/stays/check-in', ['reservation_id' => $resId2])
            ->assertForbidden();
    }
}
