<?php

namespace Tests\Feature;

use App\Domains\Folio\Models\Folio;
use App\Domains\Folio\Models\FolioLine;
use App\Domains\Folio\Models\Payment;
use App\Domains\FrontDesk\Models\Stay;
use App\Domains\Guests\Models\Guest;
use App\Domains\Inventory\Models\Room;
use App\Domains\Inventory\Models\RoomType;
use App\Domains\Shared\Models\Hotel;
use Database\Seeders\GuestSeeder;
use Database\Seeders\HotelSeeder;
use Database\Seeders\InventorySeeder;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\UserSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FolioTest extends TestCase
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

    private function room101(): Room
    {
        return Room::where('hotel_id', $this->agh()->id)->where('number', '101')->first();
    }

    /** Reservation spanning $nights nights starting $startOffset days from today. */
    private function makeConfirmedReservation(int $nights = 1, int $startOffset = 0): int
    {
        $resId = $this->auth('frontdesk@ahmedgrand.local')->postJson('/api/v1/reservations', [
            'guest_id' => $this->activeGuest()->id,
            'room_type_id' => $this->stdType()->id,
            'room_id' => $this->room101()->id,
            'check_in' => now()->addDays($startOffset)->toDateString(),
            'check_out' => now()->addDays($startOffset + $nights)->toDateString(),
        ])->assertCreated()->json('data.id');

        $this->auth('frontdesk@ahmedgrand.local')
            ->postJson("/api/v1/reservations/{$resId}/confirm")
            ->assertOk();

        return $resId;
    }

    private function checkIn(int $resId, string $email = 'reception@ahmedgrand.local'): int
    {
        return $this->auth($email)->postJson('/api/v1/stays/check-in', [
            'reservation_id' => $resId,
        ])->assertCreated()->json('data.id');
    }

    // ------------------------------------------------------------------
    // Folio lifecycle
    // ------------------------------------------------------------------

    public function test_folio_auto_created_on_check_in(): void
    {
        $stayId = $this->checkIn($this->makeConfirmedReservation());

        $folio = Folio::where('stay_id', $stayId)->first();
        $this->assertNotNull($folio);
        $this->assertEquals('open', $folio->status);
        $this->assertMatchesRegularExpression('/^FL-\d{4}-\d{6}$/', $folio->folio_number);
    }

    public function test_folio_open_is_idempotent(): void
    {
        $stayId = $this->checkIn($this->makeConfirmedReservation());

        $svc = app(\App\Domains\Folio\Services\FolioService::class);
        $a = $svc->openForStay($stayId);
        $b = $svc->openForStay($stayId);

        $this->assertEquals($a->id, $b->id);
        $this->assertEquals(1, Folio::where('stay_id', $stayId)->count());
    }

    // ------------------------------------------------------------------
    // Nightly billing
    // ------------------------------------------------------------------

    public function test_nightly_charges_three_nights_idempotent(): void
    {
        // 4-night reservation starting today; check in, then backdate the
        // stay to simulate 3 nights already elapsed.
        $stayId = $this->checkIn($this->makeConfirmedReservation(4, 0));
        $stay = Stay::find($stayId);
        $rate = (float) $stay->reservation->nightly_rate;
        $this->assertGreaterThan(0, $rate);

        $stay->update(['checked_in_at' => now()->subDays(3)->setHour(14)]);

        $run1 = $this->auth('accounts@ahmedgrand.local')
            ->postJson('/api/v1/billing/nightly')
            ->assertOk()->json('data');
        $this->assertEquals(3, $run1['charged']);

        // Re-run: idempotent, no new lines.
        $run2 = $this->auth('accounts@ahmedgrand.local')
            ->postJson('/api/v1/billing/nightly')
            ->assertOk()->json('data');
        $this->assertEquals(0, $run2['charged']);
        $this->assertEquals(3, $run2['skipped']);

        $folio = Folio::where('stay_id', $stayId)->first();
        $lines = FolioLine::where('folio_id', $folio->id)->where('line_type', 'room')->get();
        $this->assertCount(3, $lines);
        $this->assertEquals(round($rate * 3, 2), (float) $lines->sum('amount'));

        // Distinct service dates.
        $this->assertCount(3, $lines->pluck('service_date')->unique());
    }

    public function test_nightly_billing_skips_future_nights(): void
    {
        // 1-night stay starting today → zero chargeable nights.
        $stayId = $this->checkIn($this->makeConfirmedReservation(1, 0));

        $run = $this->auth('accounts@ahmedgrand.local')
            ->postJson('/api/v1/billing/nightly')
            ->assertOk()->json('data');

        $this->assertEquals(0, $run['charged']);
    }

    public function test_nightly_charge_survives_room_move(): void
    {
        $stayId = $this->checkIn($this->makeConfirmedReservation(3, 0));
        $stay = Stay::find($stayId);
        $stay->update(['checked_in_at' => now()->subDays(2)->setHour(14)]);

        // Move to room 102 today (after the chargeable nights).
        $room102 = Room::where('hotel_id', $this->agh()->id)->where('number', '102')->first();
        $this->auth('frontdesk@ahmedgrand.local')->postJson("/api/v1/stays/{$stayId}/room-move", [
            'new_room_id' => $room102->id,
            'reason' => 'guest request',
        ])->assertOk();

        $run = $this->auth('accounts@ahmedgrand.local')
            ->postJson('/api/v1/billing/nightly')
            ->assertOk()->json('data');

        // Both nights still charge (rate frozen at booking).
        $this->assertEquals(2, $run['charged']);

        $folio = Folio::where('stay_id', $stayId)->first();
        $lines = FolioLine::where('folio_id', $folio->id)->where('line_type', 'room')->get();
        $this->assertCount(2, $lines);
        // First night names the original room (move happened later).
        $this->assertStringContainsString('101', $lines->first()->description);
    }

    // ------------------------------------------------------------------
    // Charges, adjustments, totals
    // ------------------------------------------------------------------

    public function test_service_charge_and_discount_math(): void
    {
        $stayId = $this->checkIn($this->makeConfirmedReservation());
        $folio = Folio::where('stay_id', $stayId)->first();

        // Service charge: 2 × 1500 laundry.
        $this->auth('reception@ahmedgrand.local')->postJson("/api/v1/folios/{$folio->id}/charges", [
            'line_type' => 'service',
            'description' => 'Laundry',
            'quantity' => 2,
            'unit_price' => 1500,
            'service_date' => now()->toDateString(),
        ])->assertCreated();

        // Discount adjustment of 500.
        $this->auth('frontdesk@ahmedgrand.local')->postJson("/api/v1/folios/{$folio->id}/adjustments", [
            'type' => 'discount',
            'amount' => 500,
            'reason' => 'Loyalty discount',
        ])->assertCreated();

        $totals = $this->auth()->getJson("/api/v1/folios/{$folio->id}/totals")
            ->assertOk()->json('data');

        $this->assertEquals(3000.0, $totals['charges']);
        $this->assertEquals(-500.0, $totals['discounts']);
        $this->assertEquals(0.0, $totals['payments']);
        $this->assertEquals(2500.0, $totals['balance']);
        $this->assertEquals(2500.0, $totals['outstanding']);
        $this->assertEquals(0.0, $totals['guest_credit']);
    }

    public function test_adjustment_requires_reason(): void
    {
        $stayId = $this->checkIn($this->makeConfirmedReservation());
        $folio = Folio::where('stay_id', $stayId)->first();

        $this->auth('frontdesk@ahmedgrand.local')->postJson("/api/v1/folios/{$folio->id}/adjustments", [
            'type' => 'discount',
            'amount' => 100,
            'reason' => '',
        ])->assertStatus(422);
    }

    // ------------------------------------------------------------------
    // Payments
    // ------------------------------------------------------------------

    public function test_payment_settles_balance(): void
    {
        $stayId = $this->checkIn($this->makeConfirmedReservation());
        $folio = Folio::where('stay_id', $stayId)->first();

        $this->auth('reception@ahmedgrand.local')->postJson("/api/v1/folios/{$folio->id}/charges", [
            'line_type' => 'service',
            'description' => 'Minibar',
            'quantity' => 1,
            'unit_price' => 2500,
        ])->assertCreated();

        $res = $this->auth('accounts@ahmedgrand.local')->postJson("/api/v1/folios/{$folio->id}/payments", [
            'method' => 'cash',
            'amount' => 2500,
            'idempotency_key' => 'pay-test-001',
        ])->assertCreated();

        $this->assertMatchesRegularExpression('/^RCPT-\d{4}-\d{6}$/', $res->json('data.receipt_number'));

        $totals = $this->auth()->getJson("/api/v1/folios/{$folio->id}/totals")->json('data');
        $this->assertEquals(2500.0, $totals['payments']);
        $this->assertEquals(0.0, $totals['balance']);
    }

    public function test_payment_idempotency(): void
    {
        $stayId = $this->checkIn($this->makeConfirmedReservation());
        $folio = Folio::where('stay_id', $stayId)->first();

        $payload = [
            'method' => 'card',
            'amount' => 1000,
            'idempotency_key' => 'pay-dup-001',
        ];

        $first = $this->auth('accounts@ahmedgrand.local')
            ->postJson("/api/v1/folios/{$folio->id}/payments", $payload)
            ->assertCreated()->json('data.id');

        $second = $this->auth('accounts@ahmedgrand.local')
            ->postJson("/api/v1/folios/{$folio->id}/payments", $payload)
            ->assertCreated()->json('data.id');

        $this->assertEquals($first, $second);
        $this->assertEquals(1, Payment::where('folio_id', $folio->id)->count());
    }

    public function test_overpayment_becomes_guest_credit(): void
    {
        $stayId = $this->checkIn($this->makeConfirmedReservation());
        $folio = Folio::where('stay_id', $stayId)->first();

        $this->auth('reception@ahmedgrand.local')->postJson("/api/v1/folios/{$folio->id}/charges", [
            'line_type' => 'service',
            'description' => 'Parking',
            'quantity' => 1,
            'unit_price' => 1000,
        ])->assertCreated();

        // Pay 1500 against 1000 owed.
        $this->auth('accounts@ahmedgrand.local')->postJson("/api/v1/folios/{$folio->id}/payments", [
            'method' => 'cash',
            'amount' => 1500,
            'idempotency_key' => 'pay-over-001',
        ])->assertCreated();

        $totals = $this->auth()->getJson("/api/v1/folios/{$folio->id}/totals")->json('data');
        $this->assertEquals(-500.0, $totals['balance']);
        $this->assertEquals(0.0, $totals['outstanding']);
        $this->assertEquals(500.0, $totals['guest_credit']);
    }

    public function test_receipt_json(): void
    {
        $stayId = $this->checkIn($this->makeConfirmedReservation());
        $folio = Folio::where('stay_id', $stayId)->first();

        $payId = $this->auth('accounts@ahmedgrand.local')->postJson("/api/v1/folios/{$folio->id}/payments", [
            'method' => 'bank_transfer',
            'amount' => 2000,
            'reference' => 'TRX-999',
            'idempotency_key' => 'pay-rcpt-001',
        ])->assertCreated()->json('data.id');

        $receipt = $this->auth('accounts@ahmedgrand.local')
            ->getJson("/api/v1/payments/{$payId}/receipt")
            ->assertOk()->json('data');

        $this->assertEquals('TRX-999', $receipt['reference']);
        $this->assertEquals(2000.0, $receipt['amount']);
        $this->assertNotEmpty($receipt['folio']['folio_number']);
    }

    // ------------------------------------------------------------------
    // Check-out integration
    // ------------------------------------------------------------------

    public function test_checkout_blocked_with_outstanding_balance(): void
    {
        $stayId = $this->checkIn($this->makeConfirmedReservation());
        $folio = Folio::where('stay_id', $stayId)->first();

        $this->auth('reception@ahmedgrand.local')->postJson("/api/v1/folios/{$folio->id}/charges", [
            'line_type' => 'service',
            'description' => 'Spa',
            'quantity' => 1,
            'unit_price' => 5000,
        ])->assertCreated();

        $this->auth('reception@ahmedgrand.local')
            ->postJson("/api/v1/stays/{$stayId}/check-out")
            ->assertStatus(422)
            ->assertJsonValidationErrors('folio');

        $this->assertEquals('in_house', Stay::find($stayId)->status);
    }

    public function test_checkout_succeeds_when_settled_and_closes_folio(): void
    {
        $stayId = $this->checkIn($this->makeConfirmedReservation());
        $folio = Folio::where('stay_id', $stayId)->first();

        $this->auth('reception@ahmedgrand.local')->postJson("/api/v1/folios/{$folio->id}/charges", [
            'line_type' => 'service',
            'description' => 'Breakfast',
            'quantity' => 2,
            'unit_price' => 1200,
        ])->assertCreated();

        $this->auth('accounts@ahmedgrand.local')->postJson("/api/v1/folios/{$folio->id}/payments", [
            'method' => 'card',
            'amount' => 2400,
            'idempotency_key' => 'pay-co-001',
        ])->assertCreated();

        $res = $this->auth('reception@ahmedgrand.local')
            ->postJson("/api/v1/stays/{$stayId}/check-out")
            ->assertOk();

        $this->assertTrue($res->json('meta.folio_closed'));
        $this->assertEquals('checked_out', Stay::find($stayId)->status);
        $this->assertEquals('closed', Folio::find($folio->id)->status);
        $this->assertEquals('dirty', Room::find($this->room101()->id)->status);
    }

    public function test_checkout_zero_balance_closes_folio(): void
    {
        $stayId = $this->checkIn($this->makeConfirmedReservation());

        $this->auth('reception@ahmedgrand.local')
            ->postJson("/api/v1/stays/{$stayId}/check-out")
            ->assertOk()
            ->assertJsonPath('meta.folio_closed', true);

        $folio = Folio::where('stay_id', $stayId)->first();
        $this->assertEquals('closed', $folio->status);
    }

    // ------------------------------------------------------------------
    // Authorization & isolation
    // ------------------------------------------------------------------

    public function test_cross_hotel_folio_returns_404(): void
    {
        $stayId = $this->checkIn($this->makeConfirmedReservation());
        $folio = Folio::where('stay_id', $stayId)->first();

        // Create a second hotel + user, try to reach the first hotel's folio.
        $hotel2 = \App\Domains\Shared\Models\Hotel::create([
            'name' => 'Other Hotel', 'code' => 'OTH',
        ]);
        $role = \App\Domains\Shared\Models\Role::where('slug', 'hotel_admin')->first();
        $user = \App\Domains\Shared\Models\User::create([
            'name' => 'Other Admin', 'email' => 'other@other.local',
            'password' => 'password123', 'role_id' => $role->id,
            'hotel_id' => $hotel2->id, 'is_active' => true,
        ]);

        $token = $this->postJson('/api/v1/auth/login', [
            'email' => 'other@other.local', 'password' => 'password123',
        ])->json('data.token');

        $this->withHeader('Authorization', 'Bearer ' . $token)
            ->getJson("/api/v1/folios/{$folio->id}")
            ->assertNotFound();
    }

    public function test_housekeeper_cannot_record_payment(): void
    {
        $stayId = $this->checkIn($this->makeConfirmedReservation());
        $folio = Folio::where('stay_id', $stayId)->first();

        $this->auth('hk@ahmedgrand.local')->postJson("/api/v1/folios/{$folio->id}/payments", [
            'method' => 'cash',
            'amount' => 100,
            'idempotency_key' => 'pay-hk-001',
        ])->assertForbidden();
    }

    public function test_accountant_can_record_payment(): void
    {
        $stayId = $this->checkIn($this->makeConfirmedReservation());
        $folio = Folio::where('stay_id', $stayId)->first();

        $this->auth('accounts@ahmedgrand.local')->postJson("/api/v1/folios/{$folio->id}/payments", [
            'method' => 'cash',
            'amount' => 100,
            'idempotency_key' => 'pay-acc-001',
        ])->assertCreated();
    }

    public function test_no_update_or_delete_on_posted_lines(): void
    {
        // There is intentionally no PUT/DELETE route for folio lines.
        $stayId = $this->checkIn($this->makeConfirmedReservation());
        $folio = Folio::where('stay_id', $stayId)->first();

        $lineId = $this->auth('reception@ahmedgrand.local')->postJson("/api/v1/folios/{$folio->id}/charges", [
            'line_type' => 'service',
            'description' => 'Locked line',
            'quantity' => 1,
            'unit_price' => 100,
        ])->assertCreated()->json('data.id');

        // No such routes exist → 404/405, never a mutation.
        $this->auth('frontdesk@ahmedgrand.local')
            ->putJson("/api/v1/folio-lines/{$lineId}", ['amount' => 1])
            ->assertStatus(404);
        $this->auth('frontdesk@ahmedgrand.local')
            ->deleteJson("/api/v1/folio-lines/{$lineId}")
            ->assertStatus(404);
    }
}
