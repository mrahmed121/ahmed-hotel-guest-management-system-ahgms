<?php

namespace Tests\Feature;

use App\Domains\Inventory\Models\Floor;
use App\Domains\Inventory\Models\Room;
use App\Domains\Inventory\Models\RoomType;
use App\Domains\Shared\Models\Hotel;
use App\Domains\Shared\Models\Role;
use App\Domains\Shared\Models\User;
use Database\Seeders\HotelSeeder;
use Database\Seeders\InventorySeeder;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\UserSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class InventoryTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([HotelSeeder::class, RolePermissionSeeder::class, UserSeeder::class, InventorySeeder::class]);

        // Second hotel with its own admin for isolation tests.
        $hotelB = Hotel::create(['name' => 'Second Hotel', 'code' => 'SEC']);
        $adminRole = Role::where('slug', 'hotel_admin')->first();
        User::create([
            'name' => 'Hotel B Admin',
            'email' => 'admin@secondhotel.local',
            'password' => 'password123',
            'role_id' => $adminRole->id,
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

    public function test_room_crud(): void
    {
        $hotel = $this->agh();
        $type = RoomType::where('hotel_id', $hotel->id)->first();
        $floor = Floor::where('hotel_id', $hotel->id)->first();

        // Create
        $create = $this->auth()->postJson('/api/v1/rooms', [
            'floor_id' => $floor->id,
            'room_type_id' => $type->id,
            'number' => '999',
            'notes' => 'Test room',
        ]);
        $create->assertCreated()->assertJsonPath('data.number', '999');
        $id = $create->json('data.id');

        // Show
        $this->auth()->getJson("/api/v1/rooms/{$id}")->assertOk();

        // Update
        $this->auth()->putJson("/api/v1/rooms/{$id}", ['notes' => 'Updated'])
            ->assertOk()->assertJsonPath('data.notes', 'Updated');

        // Delete
        $this->auth()->deleteJson("/api/v1/rooms/{$id}")->assertOk();
        $this->auth()->getJson("/api/v1/rooms/{$id}")->assertNotFound();
    }

    public function test_room_number_unique_per_hotel(): void
    {
        $hotel = $this->agh();
        $type = RoomType::where('hotel_id', $hotel->id)->first();

        $this->auth()->postJson('/api/v1/rooms', [
            'room_type_id' => $type->id,
            'number' => '101', // already seeded
        ])->assertStatus(422)->assertJsonValidationErrors('number');
    }

    public function test_cross_hotel_room_access_returns_404(): void
    {
        $room = Room::first(); // belongs to AGH

        $this->auth('admin@secondhotel.local')
            ->getJson("/api/v1/rooms/{$room->id}")
            ->assertNotFound();
    }

    public function test_cross_hotel_room_list_is_scoped(): void
    {
        $response = $this->auth('admin@secondhotel.local')->getJson('/api/v1/rooms');
        $response->assertOk();
        $this->assertCount(0, $response->json('data'));
    }

    public function test_available_to_occupied_blocked_with_checkin_message(): void
    {
        $room = Room::where('status', 'available')->first();

        $this->auth()->postJson("/api/v1/rooms/{$room->id}/status", ['status' => 'occupied'])
            ->assertStatus(422)
            ->assertJsonPath('errors.status.0', 'Rooms can only become occupied through the check-in flow.');
    }

    public function test_legal_status_transitions_work(): void
    {
        $room = Room::where('status', 'available')->first();

        $this->auth()->postJson("/api/v1/rooms/{$room->id}/status", ['status' => 'maintenance'])
            ->assertOk()->assertJsonPath('data.status', 'maintenance');

        $this->auth()->postJson("/api/v1/rooms/{$room->id}/status", ['status' => 'available'])
            ->assertOk()->assertJsonPath('data.status', 'available');
    }

    public function test_illegal_status_transition_rejected(): void
    {
        $room = Room::where('status', 'available')->first();

        // available → cleaning skips dirty; must be rejected.
        $this->auth()->postJson("/api/v1/rooms/{$room->id}/status", ['status' => 'cleaning'])
            ->assertStatus(422)
            ->assertJsonPath('errors.status.0', 'Illegal status transition: available → cleaning.');
    }

    public function test_unknown_status_rejected(): void
    {
        $room = Room::where('status', 'available')->first();

        $this->auth()->postJson("/api/v1/rooms/{$room->id}/status", ['status' => 'haunted'])
            ->assertStatus(422);
    }

    public function test_rate_plan_date_validation(): void
    {
        $type = RoomType::first();

        $this->auth()->postJson('/api/v1/rate-plans', [
            'room_type_id' => $type->id,
            'name' => 'Bad dates',
            'base_rate' => 5000,
            'valid_from' => '2026-12-31',
            'valid_to' => '2026-01-01',
        ])->assertStatus(422)->assertJsonValidationErrors('valid_to');
    }

    public function test_rate_plan_nightly_total_math(): void
    {
        $type = RoomType::first();

        $create = $this->auth()->postJson('/api/v1/rate-plans', [
            'room_type_id' => $type->id,
            'name' => 'Math plan',
            'base_rate' => 10000,
            'valid_from' => '2026-01-01',
            'valid_to' => '2026-12-31',
            'tax_percent' => 0,
            'service_charge_percent' => 10,
        ]);
        $create->assertCreated();
        $id = $create->json('data.id');

        // 10000 × 1.10 = 11000.00
        $this->auth()->getJson("/api/v1/rate-plans/{$id}")
            ->assertOk()->assertJsonPath('data.nightly_total', '11000.00');
    }

    public function test_housekeeper_cannot_create_rooms(): void
    {
        $type = RoomType::first();

        $this->auth('hk@ahmedgrand.local')->postJson('/api/v1/rooms', [
            'room_type_id' => $type->id,
            'number' => '998',
        ])->assertForbidden();
    }

    public function test_housekeeper_can_view_rooms(): void
    {
        $this->auth('hk@ahmedgrand.local')->getJson('/api/v1/rooms')->assertOk();
    }

    public function test_floor_delete_blocked_with_rooms(): void
    {
        $floor = Floor::has('rooms')->first();

        $this->auth()->deleteJson("/api/v1/floors/{$floor->id}")
            ->assertStatus(422);
    }

    public function test_room_type_delete_blocked_with_rooms(): void
    {
        $type = RoomType::has('rooms')->first();

        $this->auth()->deleteJson("/api/v1/room-types/{$type->id}")
            ->assertStatus(422);
    }

    public function test_floor_number_unique_per_hotel(): void
    {
        $this->auth()->postJson('/api/v1/floors', ['number' => 1])
            ->assertStatus(422)->assertJsonValidationErrors('number');
    }

    public function test_unauthenticated_inventory_access_denied(): void
    {
        $this->getJson('/api/v1/rooms')->assertUnauthorized();
        $this->getJson('/api/v1/room-types')->assertUnauthorized();
    }
}
