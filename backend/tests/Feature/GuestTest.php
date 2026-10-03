<?php

namespace Tests\Feature;

use App\Domains\Guests\Models\Guest;
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

class GuestTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([
            HotelSeeder::class, RolePermissionSeeder::class,
            UserSeeder::class, InventorySeeder::class, GuestSeeder::class,
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

    public function test_guest_crud(): void
    {
        // Create
        $create = $this->auth()->postJson('/api/v1/guests', [
            'first_name' => 'Test', 'last_name' => 'Guest',
            'phone' => '+92-300-9999999', 'email' => 'test.guest@example.com',
        ]);
        $create->assertCreated()->assertJsonPath('data.first_name', 'Test');
        $id = $create->json('data.id');

        // Show
        $this->auth()->getJson("/api/v1/guests/{$id}")
            ->assertOk()->assertJsonPath('data.full_name', 'Test Guest');

        // Update
        $this->auth()->putJson("/api/v1/guests/{$id}", ['vip' => true])
            ->assertOk()->assertJsonPath('data.vip', true);

        // Search
        $this->auth()->getJson('/api/v1/guests?search=Test')
            ->assertOk()->assertJsonCount(1, 'data');

        // Delete (no reservations)
        $this->auth()->deleteJson("/api/v1/guests/{$id}")->assertOk();
        $this->assertDatabaseMissing('guests', ['id' => $id]);
    }

    public function test_guest_blacklist_flow(): void
    {
        $guest = Guest::where('hotel_id', Hotel::where('code', 'AGH')->first()->id)->first();

        $this->auth()->postJson("/api/v1/guests/{$guest->id}/blacklist", ['reason' => 'Test'])
            ->assertOk()->assertJsonPath('data.status', 'blacklisted');

        // Double blacklist rejected
        $this->auth()->postJson("/api/v1/guests/{$guest->id}/blacklist")
            ->assertStatus(422);

        $this->auth()->postJson("/api/v1/guests/{$guest->id}/unblacklist")
            ->assertOk()->assertJsonPath('data.status', 'active');

        // Double unblacklist rejected
        $this->auth()->postJson("/api/v1/guests/{$guest->id}/unblacklist")
            ->assertStatus(422);
    }

    public function test_blacklisted_guest_cannot_reserve(): void
    {
        $blacklisted = Guest::where('status', 'blacklisted')->first();
        $this->assertNotNull($blacklisted);

        $roomType = \App\Domains\Inventory\Models\RoomType::first();
        $this->auth()->postJson('/api/v1/reservations', [
            'guest_id' => $blacklisted->id,
            'room_type_id' => $roomType->id,
            'check_in' => '2026-11-01', 'check_out' => '2026-11-03',
        ])->assertStatus(422);
    }

    public function test_guest_hotel_isolation(): void
    {
        // Hotel B admin sees zero guests; cannot access hotel A guest.
        $response = $this->auth('admin@secondhotel.local')->getJson('/api/v1/guests');
        $response->assertOk();
        $this->assertCount(0, $response->json('data'));

        $guestA = Guest::withoutGlobalScopes()->first();
        $this->auth('admin@secondhotel.local')->getJson("/api/v1/guests/{$guestA->id}")
            ->assertNotFound();
    }

    public function test_guest_validation(): void
    {
        $this->auth()->postJson('/api/v1/guests', [
            'first_name' => 'NoPhone',
        ])->assertStatus(422); // last_name + phone required
    }
}
