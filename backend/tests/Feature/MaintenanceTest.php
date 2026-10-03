<?php

namespace Tests\Feature;

use App\Domains\Folio\Models\Folio;
use App\Domains\FrontDesk\Models\Stay;
use App\Domains\Guests\Models\Guest;
use App\Domains\Housekeeping\Models\MaintenanceTicket;
use App\Domains\Housekeeping\Models\Service;
use App\Domains\Inventory\Models\Room;
use App\Domains\Inventory\Models\RoomType;
use App\Domains\Shared\Models\Hotel;
use Database\Seeders\GuestSeeder;
use Database\Seeders\HotelSeeder;
use Database\Seeders\InventorySeeder;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\ServiceSeeder;
use Database\Seeders\UserSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MaintenanceTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([
            HotelSeeder::class, RolePermissionSeeder::class, UserSeeder::class,
            InventorySeeder::class, GuestSeeder::class, ServiceSeeder::class,
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

    public function test_ticket_creation_moves_room_to_maintenance(): void
    {
        $room = $this->room('301');
        $this->assertEquals('available', $room->status);

        $res = $this->auth()->postJson('/api/v1/maintenance-tickets', [
            'room_id' => $room->id,
            'category' => 'plumbing',
            'priority' => 'high',
            'title' => 'Leaking tap',
            'description' => 'Bathroom tap leaking continuously.',
        ])->assertCreated();

        $this->assertMatchesRegularExpression('/^MT-\d{4}-\d{6}$/', $res->json('data.ticket_number'));
        $this->assertEquals('maintenance', $this->room('301')->fresh()->status);
    }

    public function test_room_in_maintenance_is_not_assignable(): void
    {
        $room = $this->room('302');
        $this->assertTrue($room->isAssignable());

        $this->auth()->postJson('/api/v1/maintenance-tickets', [
            'room_id' => $room->id,
            'category' => 'electrical',
            'title' => 'Power outlet dead',
        ])->assertCreated();

        $room = $this->room('302')->fresh();
        $this->assertEquals('maintenance', $room->status);
        $this->assertFalse($room->isAssignable());

        // Availability search excludes it
        $type = RoomType::where('hotel_id', $this->agh()->id)->where('code', 'STD')->first();
        $available = $this->auth('reception@ahmedgrand.local')->getJson('/api/v1/availability?' . http_build_query([
            'check_in' => now()->addDay()->toDateString(),
            'check_out' => now()->addDays(2)->toDateString(),
            'room_type_id' => $type->id,
        ]))->assertOk()->json('data');

        $numbers = collect($available)->pluck('number')->all();
        $this->assertNotContains('302', $numbers);
    }

    public function test_ticket_close_releases_room_to_dirty(): void
    {
        $room = $this->room('303');

        $ticketId = $this->auth()->postJson('/api/v1/maintenance-tickets', [
            'room_id' => $room->id,
            'category' => 'tv',
            'title' => 'TV remote missing',
        ])->assertCreated()->json('data.id');

        $this->assertEquals('maintenance', $this->room('303')->fresh()->status);

        // Walk the lifecycle to verified → room should go dirty for turnover
        foreach (['triaged', 'assigned', 'in_progress', 'completed', 'verified'] as $status) {
            $this->auth()->postJson("/api/v1/maintenance-tickets/{$ticketId}/transition", [
                'status' => $status,
            ])->assertOk();
        }

        $this->assertEquals('dirty', $this->room('303')->fresh()->status);
    }

    public function test_occupied_room_stays_occupied_when_ticket_created(): void
    {
        $room = $this->room('304');
        $room->update(['status' => 'occupied']);

        $this->auth()->postJson('/api/v1/maintenance-tickets', [
            'room_id' => $room->id,
            'category' => 'ac',
            'title' => 'AC noisy',
        ])->assertCreated();

        // occupied → maintenance is illegal; room keeps its guest
        $this->assertEquals('occupied', $this->room('304')->fresh()->status);
    }

    public function test_service_crud(): void
    {
        $id = $this->auth('admin@ahmedgrand.local')->postJson('/api/v1/services', [
            'name' => 'Spa Session',
            'code' => 'SPA',
            'unit_price' => 5000,
            'description' => '60-minute spa session',
        ])->assertCreated()->json('data.id');

        $this->auth('admin@ahmedgrand.local')->putJson("/api/v1/services/{$id}", [
            'unit_price' => 5500,
        ])->assertOk()->assertJsonPath('data.unit_price', '5500.00');

        $this->auth('admin@ahmedgrand.local')->deleteJson("/api/v1/services/{$id}")->assertOk();
        $this->assertNull(Service::find($id));
    }

    public function test_service_charge_via_folio_with_service_id(): void
    {
        $stay = $this->makeCheckedInStay();
        $folio = Folio::where('stay_id', $stay->id)->first();
        $this->assertNotNull($folio);

        $service = Service::where('hotel_id', $this->agh()->id)->where('code', 'BRKFST')->first();
        $this->assertNotNull($service);

        // No explicit price — defaults to the service's unit_price (1500)
        $line = $this->auth('reception@ahmedgrand.local')->postJson("/api/v1/folios/{$folio->id}/charges", [
            'line_type' => 'service',
            'service_id' => $service->id,
            'quantity' => 2,
        ])->assertCreated()->json('data');

        $this->assertEquals('Breakfast', $line['description']);
        $this->assertEquals('3000.00', $line['amount']);
    }

    public function test_cross_hotel_ticket_returns_404(): void
    {
        $other = Hotel::create(['name' => 'Other Hotel', 'code' => 'OTH2']);

        $ticket = MaintenanceTicket::withoutGlobalScopes()->create([
            'hotel_id' => $other->id,
            'ticket_number' => 'MT-2026-999999',
            'category' => 'other',
            'title' => 'Other hotel ticket',
        ]);

        $this->auth()->getJson("/api/v1/maintenance-tickets/{$ticket->id}")->assertNotFound();
    }

    // ---------- helpers ----------

    private function makeCheckedInStay(): Stay
    {
        $guest = Guest::where('hotel_id', $this->agh()->id)->where('status', 'active')->first();
        $type = RoomType::where('hotel_id', $this->agh()->id)->where('code', 'STD')->first();
        $room = $this->room('301'); // STD type per InventorySeeder floor plan

        $resId = $this->auth('frontdesk@ahmedgrand.local')->postJson('/api/v1/reservations', [
            'guest_id' => $guest->id,
            'room_type_id' => $type->id,
            'room_id' => $room->id,
            'check_in' => now()->toDateString(),
            'check_out' => now()->addDays(2)->toDateString(),
        ])->assertCreated()->json('data.id');

        $this->auth('frontdesk@ahmedgrand.local')->postJson("/api/v1/reservations/{$resId}/confirm")->assertOk();

        $stayId = $this->auth('reception@ahmedgrand.local')->postJson('/api/v1/stays/check-in', [
            'reservation_id' => $resId,
        ])->assertCreated()->json('data.id');

        return Stay::find($stayId);
    }
}
