<?php

namespace Tests\Feature;

use App\Domains\FrontDesk\Events\RoomBecameDirty;
use App\Domains\Housekeeping\Models\HousekeepingTask;
use App\Domains\Inventory\Models\Room;
use App\Domains\Shared\Models\Hotel;
use App\Domains\Shared\Models\User;
use Database\Seeders\HotelSeeder;
use Database\Seeders\InventorySeeder;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\UserSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class HousekeepingTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([
            HotelSeeder::class, RolePermissionSeeder::class, UserSeeder::class,
            InventorySeeder::class,
        ]);
    }

    private function token(string $email): string
    {
        return $this->postJson('/api/v1/auth/login', [
            'email' => $email, 'password' => 'password123',
        ])->json('data.token');
    }

    private function auth(string $email = 'hk.super@ahmedgrand.local')
    {
        return $this->withHeader('Authorization', 'Bearer ' . $this->token($email));
    }

    private function agh(): Hotel
    {
        return Hotel::where('code', 'AGH')->first();
    }

    private function room(string $number): Room
    {
        return Room::where('hotel_id', $this->agh()->id)->where('number', $number)->first();
    }

    public function test_room_became_dirty_event_auto_creates_task(): void
    {
        $room = $this->room('101');

        $this->assertEquals(0, HousekeepingTask::where('room_id', $room->id)->count());

        event(new RoomBecameDirty($room, 'test'));

        $task = HousekeepingTask::where('room_id', $room->id)->first();
        $this->assertNotNull($task);
        $this->assertEquals('dirty', $task->status);
    }

    public function test_duplicate_task_for_same_room_returns_existing(): void
    {
        $room = $this->room('102');

        $first = $this->auth()->postJson('/api/v1/housekeeping-tasks', [
            'room_id' => $room->id,
        ])->assertCreated()->json('data.id');

        $second = $this->auth()->postJson('/api/v1/housekeeping-tasks', [
            'room_id' => $room->id,
        ])->assertCreated()->json('data.id');

        $this->assertEquals($first, $second);
        $this->assertEquals(1, HousekeepingTask::where('room_id', $room->id)->count());
    }

    public function test_full_lifecycle_dirty_to_ready(): void
    {
        $hk = User::where('email', 'hk@ahmedgrand.local')->first();
        $room = $this->room('103');
        $room->update(['status' => 'dirty']); // post-checkout state

        // Create (dirty)
        $taskId = $this->auth()->postJson('/api/v1/housekeeping-tasks', [
            'room_id' => $room->id, 'priority' => 'high',
        ])->assertCreated()->json('data.id');

        // dirty → assigned
        $this->auth()->postJson("/api/v1/housekeeping-tasks/{$taskId}/assign", [
            'assigned_to' => $hk->id,
        ])->assertOk()->assertJsonPath('data.status', 'assigned');

        // assigned → cleaning (room → cleaning)
        $this->auth('hk@ahmedgrand.local')->postJson("/api/v1/housekeeping-tasks/{$taskId}/start")
            ->assertOk()->assertJsonPath('data.status', 'cleaning');
        $this->assertEquals('cleaning', $this->room('103')->fresh()->status);

        // cleaning → inspection (room → inspection)
        $this->auth('hk@ahmedgrand.local')->postJson("/api/v1/housekeeping-tasks/{$taskId}/complete")
            ->assertOk()->assertJsonPath('data.status', 'inspection');
        $this->assertEquals('inspection', $this->room('103')->fresh()->status);

        // inspection → ready (room → ready)
        $this->auth()->postJson("/api/v1/housekeeping-tasks/{$taskId}/inspect", [
            'passed' => true, 'notes' => 'Spotless',
        ])->assertOk()->assertJsonPath('data.status', 'ready');
        $this->assertEquals('ready', $this->room('103')->fresh()->status);
    }

    public function test_inspection_failed_returns_to_cleaning(): void
    {
        $hk = User::where('email', 'hk@ahmedgrand.local')->first();
        $room = $this->room('104');
        $room->update(['status' => 'dirty']); // post-checkout state

        $taskId = $this->auth()->postJson('/api/v1/housekeeping-tasks', [
            'room_id' => $room->id,
        ])->assertCreated()->json('data.id');

        $this->auth()->postJson("/api/v1/housekeeping-tasks/{$taskId}/assign", ['assigned_to' => $hk->id])->assertOk();
        $this->auth('hk@ahmedgrand.local')->postJson("/api/v1/housekeeping-tasks/{$taskId}/start")->assertOk();
        $this->auth('hk@ahmedgrand.local')->postJson("/api/v1/housekeeping-tasks/{$taskId}/complete")->assertOk();

        // Fail inspection → back to cleaning
        $this->auth()->postJson("/api/v1/housekeeping-tasks/{$taskId}/inspect", [
            'passed' => false, 'notes' => 'Bathroom needs rework',
        ])->assertOk()->assertJsonPath('data.status', 'cleaning');

        $this->assertEquals('cleaning', $this->room('104')->fresh()->status);
    }

    public function test_illegal_transition_returns_422(): void
    {
        $room = $this->room('105');

        $taskId = $this->auth()->postJson('/api/v1/housekeeping-tasks', [
            'room_id' => $room->id,
        ])->assertCreated()->json('data.id');

        // dirty → ready directly is illegal
        $this->auth()->postJson("/api/v1/housekeeping-tasks/{$taskId}/inspect", [
            'passed' => true,
        ])->assertStatus(422);
    }

    public function test_assign_validates_housekeeper_role(): void
    {
        $receptionist = User::where('email', 'reception@ahmedgrand.local')->first();
        $room = $this->room('106');

        $taskId = $this->auth()->postJson('/api/v1/housekeeping-tasks', [
            'room_id' => $room->id,
        ])->assertCreated()->json('data.id');

        // Receptionist is not a housekeeper
        $this->auth()->postJson("/api/v1/housekeeping-tasks/{$taskId}/assign", [
            'assigned_to' => $receptionist->id,
        ])->assertStatus(422);
    }

    public function test_cross_hotel_task_returns_404(): void
    {
        $other = Hotel::create(['name' => 'Other Hotel', 'code' => 'OTH']);
        $room = $this->room('201');

        $task = HousekeepingTask::create([
            'hotel_id' => $other->id,
            'room_id' => $room->id,
            'status' => 'dirty',
        ]);

        $this->auth()->getJson("/api/v1/housekeeping-tasks/{$task->id}")->assertNotFound();
    }

    public function test_housekeeper_can_update_tasks_but_not_services(): void
    {
        // Housekeeper has housekeeping.manage — can progress tasks
        $room = $this->room('202');
        $taskId = $this->auth('hk.super@ahmedgrand.local')->postJson('/api/v1/housekeeping-tasks', [
            'room_id' => $room->id,
        ])->assertCreated()->json('data.id');

        $hk = User::where('email', 'hk@ahmedgrand.local')->first();
        $this->auth('hk.super@ahmedgrand.local')->postJson("/api/v1/housekeeping-tasks/{$taskId}/assign", [
            'assigned_to' => $hk->id,
        ])->assertOk();

        $this->auth('hk@ahmedgrand.local')->postJson("/api/v1/housekeeping-tasks/{$taskId}/start")->assertOk();

        // ...but cannot manage the service catalog (403)
        $this->auth('hk@ahmedgrand.local')->postJson('/api/v1/services', [
            'name' => 'Test', 'code' => 'TST', 'unit_price' => 100,
        ])->assertForbidden();
    }

    public function test_receptionist_cannot_manage_housekeeping(): void
    {
        $this->auth('reception@ahmedgrand.local')->postJson('/api/v1/housekeeping-tasks', [
            'room_id' => $this->room('203')->id,
        ])->assertForbidden();
    }
}
