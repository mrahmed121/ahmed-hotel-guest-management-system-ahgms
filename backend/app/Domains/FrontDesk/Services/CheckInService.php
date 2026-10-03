<?php

namespace App\Domains\FrontDesk\Services;

use App\Domains\FrontDesk\Events\GuestCheckedIn;
use App\Domains\FrontDesk\Models\Stay;
use App\Domains\Guests\Models\Guest;
use App\Domains\Guests\Services\GuestService;
use App\Domains\Inventory\Models\Room;
use App\Domains\Inventory\Models\RoomType;
use App\Domains\Reservations\Models\Reservation;
use App\Domains\Reservations\Services\ReservationService;
use App\Domains\Shared\Services\AuditService;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CheckInService
{
    public function __construct(
        private AuditService $audit,
        private GuestService $guests,
        private ReservationService $reservations,
    ) {}

    /**
     * Check a guest in from a reservation.
     *
     * Design decision (documented): a 'reserved' reservation is auto-confirmed
     * as part of check-in — front desks check guests in from the arrivals list
     * without a separate confirmation step. 'inquiry' reservations must be
     * confirmed first; terminal states are rejected.
     */
    public function checkIn(int $reservationId, array $data = []): array
    {
        return DB::transaction(function () use ($reservationId, $data) {
            $reservation = Reservation::lockForUpdate()->findOrFail($reservationId);

            if ($reservation->status === 'checked_in') {
                throw ValidationException::withMessages([
                    'reservation_id' => ['Reservation is already checked in.'],
                ]);
            }
            if (! in_array($reservation->status, ['reserved', 'confirmed'], true)) {
                throw ValidationException::withMessages([
                    'reservation_id' => ["Reservation '{$reservation->status}' cannot be checked in."],
                ]);
            }

            $guest = $reservation->guest;
            if ($guest->status === 'blacklisted') {
                throw ValidationException::withMessages([
                    'guest_id' => ['Guest is blacklisted and cannot be checked in.'],
                ]);
            }

            $earlyCheckIn = false;
            $this->assertCheckInWindow($reservation, $earlyCheckIn);

            // Auto-confirm reserved → confirmed as part of check-in.
            if ($reservation->status === 'reserved') {
                $reservation->update(['status' => 'confirmed']);
            }

            $room = $this->resolveRoom($reservation, $data['room_id'] ?? null);

            $stay = Stay::create([
                'reservation_id' => $reservation->id,
                'guest_id' => $reservation->guest_id,
                'room_id' => $room->id,
                'checked_in_at' => now(),
                'expected_checkout' => $reservation->check_out->toDateString(),
                'status' => 'in_house',
                'adults' => $reservation->adults,
                'children' => $reservation->children,
                'notes' => $data['notes'] ?? null,
            ]);

            $reservation->update(['status' => 'checked_in', 'checked_in_at' => now()]);

            // P4 owns occupancy: Room::canTransitionTo() deliberately blocks
            // 'occupied', so the check-in flow sets it directly.
            $room->update(['status' => 'occupied']);

            $this->audit->log('stay.checked_in', $stay, [
                'confirmation_code' => $reservation->confirmation_code,
                'guest' => $guest->full_name,
                'room' => $room->number,
                'early_check_in' => $earlyCheckIn,
            ]);

            $stay->load(['guest', 'room', 'room.roomType', 'reservation']);
            event(new GuestCheckedIn($stay));

            return ['stay' => $stay, 'early_check_in' => $earlyCheckIn];
        });
    }

    /**
     * Walk-in: guest + reservation + stay in a single transaction.
     * Defaults: check_in today, check_out tomorrow, status confirmed.
     */
    public function createWalkIn(array $data): array
    {
        return DB::transaction(function () use ($data) {
            $guest = ! empty($data['guest_id'])
                ? Guest::findOrFail($data['guest_id'])
                : $this->guests->create([
                    'first_name' => $data['first_name'],
                    'last_name' => $data['last_name'] ?? '',
                    'email' => $data['email'] ?? null,
                    'phone' => $data['phone'],
                    'country' => $data['country'] ?? null,
                    'id_type' => $data['id_type'] ?? null,
                    'id_number' => $data['id_number'] ?? null,
                    'address' => $data['address'] ?? null,
                    'notes' => $data['guest_notes'] ?? null,
                ]);

            if ($guest->status === 'blacklisted') {
                throw ValidationException::withMessages([
                    'guest_id' => ['Guest is blacklisted and cannot be checked in.'],
                ]);
            }

            $checkIn = $data['check_in'] ?? now()->toDateString();
            $checkOut = $data['check_out']
                ?? now()->addDay()->toDateString();

            $reservation = $this->reservations->create([
                'guest_id' => $guest->id,
                'room_type_id' => $data['room_type_id'],
                'room_id' => $data['room_id'] ?? null,
                'status' => 'confirmed',
                'check_in' => $checkIn,
                'check_out' => $checkOut,
                'adults' => $data['adults'] ?? 1,
                'children' => $data['children'] ?? 0,
                'source' => 'walk_in',
                'notes' => $data['notes'] ?? null,
            ]);

            return $this->checkIn($reservation->id, [
                'room_id' => $data['room_id'] ?? null,
                'notes' => $data['notes'] ?? null,
            ]);
        });
    }

    private function assertCheckInWindow(Reservation $reservation, bool &$earlyCheckIn): void
    {
        $today = now()->toDateString();
        $checkIn = $reservation->check_in->toDateString();
        $checkOut = $reservation->check_out->toDateString();

        if ($today >= $checkOut) {
            throw ValidationException::withMessages([
                'reservation_id' => ['Reservation window has passed. Mark as no-show instead.'],
            ]);
        }

        // More than 1 day before scheduled check-in → reject.
        if ($checkIn > now()->addDay()->toDateString()) {
            throw ValidationException::withMessages([
                'reservation_id' => ["Too early: scheduled check-in is {$checkIn}."],
            ]);
        }

        $earlyCheckIn = $checkIn > $today; // 1 day early → allowed with warning flag
    }

    /**
     * Resolve the room for check-in: explicit room_id wins, otherwise pick the
     * first available room of the reservation's room type (row-locked).
     */
    private function resolveRoom(Reservation $reservation, ?int $roomId): Room
    {
        if ($roomId) {
            $room = Room::where('id', $roomId)->lockForUpdate()->firstOrFail();
        } else {
            if ($reservation->room_id) {
                $room = Room::where('id', $reservation->room_id)->lockForUpdate()->firstOrFail();
            } else {
                $room = Room::where('room_type_id', $reservation->room_type_id)
                    ->where('status', 'available')
                    ->lockForUpdate()
                    ->orderBy('number')
                    ->first();

                if (! $room) {
                    throw ValidationException::withMessages([
                        'room_id' => ['No available room for this room type right now.'],
                    ]);
                }
            }
        }

        if (in_array($room->status, ['maintenance', 'out_of_service'], true)) {
            throw ValidationException::withMessages([
                'room_id' => ["Room {$room->number} is '{$room->status}' and cannot be assigned."],
            ]);
        }
        if ($room->status === 'occupied') {
            throw ValidationException::withMessages([
                'room_id' => ["Room {$room->number} is currently occupied."],
            ]);
        }
        if ($room->room_type_id !== (int) $reservation->room_type_id) {
            throw ValidationException::withMessages([
                'room_id' => ['Room does not belong to the reservation room type.'],
            ]);
        }

        // Re-verify no overlapping active reservation holds this room.
        $conflict = Reservation::overlaps(
            $room->id,
            $reservation->check_in->toDateString(),
            $reservation->check_out->toDateString(),
            $reservation->id
        )->first();
        if ($conflict) {
            throw ValidationException::withMessages([
                'room_id' => ["Room {$room->number} is booked ({$conflict->confirmation_code}) for overlapping dates."],
            ]);
        }

        // Keep the reservation's room assignment in sync.
        if ($reservation->room_id !== $room->id) {
            $reservation->update(['room_id' => $room->id]);
        }

        return $room;
    }
}
