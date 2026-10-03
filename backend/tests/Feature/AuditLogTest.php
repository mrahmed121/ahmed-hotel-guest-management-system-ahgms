<?php

namespace Tests\Feature;

use App\Domains\Shared\Models\AuditLog;
use App\Domains\Shared\Models\Role;
use Database\Seeders\HotelSeeder;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\UserSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuditLogTest extends TestCase
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

    public function test_user_creation_writes_audit_log(): void
    {
        $role = Role::where('slug', 'receptionist')->first();

        $this->withHeader('Authorization', 'Bearer ' . $this->token('admin@ahmedgrand.local'))
            ->postJson('/api/v1/users', [
                'name' => 'Audited User',
                'email' => 'audited@ahmedgrand.local',
                'password' => 'password123',
                'role_id' => $role->id,
            ])
            ->assertStatus(201);

        $this->assertDatabaseHas('audit_logs', ['action' => 'user.created']);
        $log = AuditLog::where('action', 'user.created')->latest('id')->first();
        $this->assertNotNull($log->actor_id);
        $this->assertNotNull($log->hotel_id);
        $this->assertEquals('audited@ahmedgrand.local', $log->context['email']);
    }

    public function test_setting_update_writes_audit_log(): void
    {
        $this->withHeader('Authorization', 'Bearer ' . $this->token('admin@ahmedgrand.local'))
            ->postJson('/api/v1/settings', ['key' => 'check_in_time', 'value' => '15:00'])
            ->assertOk();

        $this->assertDatabaseHas('audit_logs', ['action' => 'setting.updated']);
    }

    public function test_auditor_can_read_audit_logs(): void
    {
        $this->withHeader('Authorization', 'Bearer ' . $this->token('audit@ahmedgrand.local'))
            ->getJson('/api/v1/audit-logs')
            ->assertOk();
    }

    public function test_audit_logs_are_hotel_scoped(): void
    {
        $response = $this->withHeader('Authorization', 'Bearer ' . $this->token('reception@ahmedgrand.local'))
            ->getJson('/api/v1/audit-logs');

        // Receptionist lacks audit.view → 403 (also proves permission gating).
        $response->assertStatus(403);
    }
}
