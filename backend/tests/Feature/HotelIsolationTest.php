<?php

namespace Tests\Feature;

use App\Domains\Shared\Models\Hotel;
use App\Domains\Shared\Models\Role;
use App\Domains\Shared\Models\User;
use Database\Seeders\HotelSeeder;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\UserSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class HotelIsolationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([HotelSeeder::class, RolePermissionSeeder::class, UserSeeder::class]);

        // Second hotel with its own admin.
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

    public function test_hotel_admin_cannot_view_other_hotel(): void
    {
        $hotelB = Hotel::where('code', 'SEC')->first();

        $this->withHeader('Authorization', 'Bearer ' . $this->token('admin@ahmedgrand.local'))
            ->getJson("/api/v1/hotels/{$hotelB->id}")
            ->assertStatus(404);
    }

    public function test_hotel_admin_sees_only_own_hotel_in_list(): void
    {
        $response = $this->withHeader('Authorization', 'Bearer ' . $this->token('admin@ahmedgrand.local'))
            ->getJson('/api/v1/hotels');

        $response->assertOk();
        $ids = collect($response->json('data'))->pluck('id')->all();
        $this->assertCount(1, $ids);
        $this->assertEquals(Hotel::where('code', 'AGH')->first()->id, $ids[0]);
    }

    public function test_hotel_admin_cannot_view_other_hotel_user(): void
    {
        $userB = User::where('email', 'admin@secondhotel.local')->first();

        $this->withHeader('Authorization', 'Bearer ' . $this->token('admin@ahmedgrand.local'))
            ->getJson("/api/v1/users/{$userB->id}")
            ->assertStatus(404);
    }

    public function test_super_admin_sees_all_hotels(): void
    {
        $response = $this->withHeader('Authorization', 'Bearer ' . $this->token('super@ahgms.local'))
            ->getJson('/api/v1/hotels');

        $response->assertOk();
        $this->assertGreaterThanOrEqual(2, count($response->json('data')));
    }

    public function test_hotel_admin_cannot_create_super_admin_user(): void
    {
        $superRole = Role::where('slug', 'super_admin')->first();

        $this->withHeader('Authorization', 'Bearer ' . $this->token('admin@ahmedgrand.local'))
            ->postJson('/api/v1/users', [
                'name' => 'Evil', 'email' => 'evil@example.com',
                'password' => 'password123', 'role_id' => $superRole->id,
            ])
            ->assertStatus(403);
    }
}
