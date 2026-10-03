<?php

namespace Tests\Feature;

use Database\Seeders\HotelSeeder;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\UserSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RbacTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([HotelSeeder::class, RolePermissionSeeder::class, UserSeeder::class]);
    }

    private function token(string $email): string
    {
        return $this->postJson('/api/v1/auth/login', [
            'email' => $email, 'password' => 'password123',
        ])->json('data.token');
    }

    private function auth(string $email): self
    {
        return $this->withHeader('Authorization', 'Bearer ' . $this->token($email));
    }

    public function test_housekeeper_cannot_create_users(): void
    {
        $this->auth('hk@ahmedgrand.local')
            ->postJson('/api/v1/users', [
                'name' => 'X', 'email' => 'x@example.com',
                'password' => 'password123', 'role_id' => 1,
            ])
            ->assertStatus(403);
    }

    public function test_receptionist_cannot_view_audit_logs(): void
    {
        $this->auth('reception@ahmedgrand.local')
            ->getJson('/api/v1/audit-logs')
            ->assertStatus(403);
    }

    public function test_auditor_is_read_only(): void
    {
        // Can read.
        $this->auth('audit@ahmedgrand.local')
            ->getJson('/api/v1/users')
            ->assertOk();

        // Cannot create.
        $this->auth('audit@ahmedgrand.local')
            ->postJson('/api/v1/users', [
                'name' => 'X', 'email' => 'x@example.com',
                'password' => 'password123', 'role_id' => 1,
            ])
            ->assertStatus(403);
    }

    public function test_hotel_admin_cannot_create_hotels(): void
    {
        // hotels.manage is super_admin only.
        $this->auth('admin@ahmedgrand.local')
            ->postJson('/api/v1/hotels', ['name' => 'Other', 'code' => 'OTH'])
            ->assertStatus(403);
    }

    public function test_super_admin_can_create_hotels(): void
    {
        $this->auth('super@ahgms.local')
            ->postJson('/api/v1/hotels', ['name' => 'Second Hotel', 'code' => 'SEC'])
            ->assertStatus(201);
    }

    public function test_hotel_admin_can_manage_users_in_own_hotel(): void
    {
        $receptionistRole = \App\Domains\Shared\Models\Role::where('slug', 'receptionist')->first();

        $this->auth('admin@ahmedgrand.local')
            ->postJson('/api/v1/users', [
                'name' => 'New Receptionist',
                'email' => 'new.reception@ahmedgrand.local',
                'password' => 'password123',
                'role_id' => $receptionistRole->id,
            ])
            ->assertStatus(201);
    }
}
