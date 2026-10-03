<?php

namespace Tests\Feature;

use Database\Seeders\HotelSeeder;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\UserSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([HotelSeeder::class, RolePermissionSeeder::class, UserSeeder::class]);
    }

    public function test_login_success_returns_token_and_user(): void
    {
        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'admin@ahmedgrand.local',
            'password' => 'password123',
        ]);

        $response->assertOk()
            ->assertJsonPath('data.token_type', 'bearer')
            ->assertJsonStructure(['data' => ['token', 'user' => ['id', 'email', 'role']]]);
    }

    public function test_login_fails_with_wrong_password(): void
    {
        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'admin@ahmedgrand.local',
            'password' => 'wrongpassword',
        ]);

        $response->assertStatus(401);
    }

    public function test_login_fails_with_unknown_email(): void
    {
        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'nobody@example.com',
            'password' => 'password123',
        ]);

        $response->assertStatus(401);
    }

    public function test_me_returns_authenticated_user(): void
    {
        $token = $this->loginAs('reception@ahmedgrand.local');

        $response = $this->withHeader('Authorization', "Bearer $token")
            ->getJson('/api/v1/auth/me');

        $response->assertOk()
            ->assertJsonPath('data.email', 'reception@ahmedgrand.local');
    }

    public function test_me_requires_authentication(): void
    {
        $this->getJson('/api/v1/auth/me')->assertStatus(401);
    }

    public function test_logout_invalidates_token(): void
    {
        $token = $this->loginAs('admin@ahmedgrand.local');

        $this->withHeader('Authorization', "Bearer $token")
            ->postJson('/api/v1/auth/logout')
            ->assertOk();

        // Token should no longer work.
        $this->withHeader('Authorization', "Bearer $token")
            ->getJson('/api/v1/auth/me')
            ->assertStatus(401);
    }

    public function test_refresh_returns_new_token(): void
    {
        $token = $this->loginAs('admin@ahmedgrand.local');

        $response = $this->withHeader('Authorization', "Bearer $token")
            ->postJson('/api/v1/auth/refresh');

        $response->assertOk()->assertJsonStructure(['data' => ['token']]);
        $this->assertNotEquals($token, $response->json('data.token'));
    }

    public function test_health_is_public(): void
    {
        $this->getJson('/api/v1/health')
            ->assertOk()
            ->assertJson(['status' => 'ok', 'app' => 'AHGMS']);
    }

    private function loginAs(string $email): string
    {
        $response = $this->postJson('/api/v1/auth/login', [
            'email' => $email,
            'password' => 'password123',
        ]);
        $response->assertOk();

        return $response->json('data.token');
    }
}
