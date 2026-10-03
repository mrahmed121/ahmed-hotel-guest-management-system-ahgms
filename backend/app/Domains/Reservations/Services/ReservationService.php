<?php

namespace App\Domains\Reservations\Services;

use App\Domains\Guests\Models\Guest;
use App\Domains\Inventory\Models\RatePlan;
use App\Domains\Inventory\Models\Room;
use App\Domains\Inventory\Models\RoomType;
use App\Domains\Reservations\Models\Reservation;
use App\Domains\Shared\Services\AuditService;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ReservationService
{
    public function __construct(private AuditService $audit) {}

    /**
     * Create a reservation with overlap protection inside a transaction.
     */
    public function create(array $data): Reservation
    {
        return DB::transaction(function () use ($data) {
            $this->assertDates($data['check_in'], $data['check_out']);

            $roomType = RoomType::findOrFail($data['room_type_id']);

            $ratePlan = null;
            if (! empty($data['rate_plan_id'])) {
                $ratePlan = RatePlan::where('is_active', true)->findOrFail($data['rate_plan_id']);
                if ($ratePlan->room_type_id !== (int) $data['room_type_id']) {
                    throw ValidationException::withMessages([
                        'rate_plan_id' => ['Rate plan does not belong to the selected room type.'],
                    ]);
                }
            }

            $room = null;
            if (! empty($data['room_id'])) {
                // Lock the room row to serialize concurrent assignments.
                $room = Room::where('id', $data['room_id'])->lockForUpdate()->firstOrFail();
                if (! $room->isAssignable()) {
                    throw ValidationException::withMessages([
                        'room_id' => ["Room {$room->number} is '{$room->status}' and cannot be assigned."],
                    ]);
                }
                if ($room->room_type_id !== (int) $data['room_type_id']) {
                    throw ValidationException::withMessages([
                        'room_id' => ['Room does not belong to the selected room type.'],
                    ]);
                }
                $this->assertNoOverlap($room->id, $data['check_in'], $data['check_out']);
            }

            $guest = Guest::findOrFail($data['guest_id']);
            if ($guest->status === 'blacklisted') {
                throw ValidationException::withMessages([
                    'guest_id' => ['Guest is blacklisted and cannot make reservations.'],
                ]);
            }

            $nightlyRate = $ratePlan
                ? (float) $ratePlan->base_rate
                : (float) $roomType->base_rate;
            $nights = (int) (new \DateTime($data['check_in']))
                ->diff(new \DateTime($data['check_out']))->days;
            $totalEstimate = round($nightlyRate * $nights, 2);

            $reservation = Reservation::create([
                'guest_id' => $guest->id,
                'room_id' => $room?->id,
                'room_type_id' => $roomType->id,
                'confirmation_code' => $this->nextConfirmationCode(),
                'status' => $data['status'] ?? 'reserved',
                'check_in' => $data['check_in'],
                'check_out' => $data['check_out'],
                'adults' => $data['adults'] ?? 1,
                'children' => $data['children'] ?? 0,
                'rate_plan_id' => $ratePlan?->id,
                'nightly_rate' => $nightlyRate,
                'total_estimate' => $totalEstimate,
                'source' => $data['source'] ?? null,
                'notes' => $data['notes'] ?? null,
            ]);

            if ($room && $room->status === 'available') {
                $room->update(['status' => 'reserved']);
            }

            $this->audit->log('reservation.created', $reservation, [
                'confirmation_code' => $reservation->confirmation_code,
                'guest' => $guest->full_name,
                'nights' => $nights,
            ]);

            return $reservation->load(['guest', 'room', 'roomType', 'ratePlan']);
        });
    }

    /**
     * Modify reservation dates / room with overlap re-check.
     */
    public function update(Reservation $reservation, array $data): Reservation
    {
        if (! in_array($reservation->status, ['inquiry', 'reserved', 'confirmed'], true)) {
            throw ValidationException::withMessages([
                'reservation' => ["Reservation '{$reservation->status}' can no longer be modified."],
            ]);
        }

        return DB::transaction(function () use ($reservation, $data) {
            $checkIn = $data['check_in'] ?? $reservation->check_in->toDateString();
            $checkOut = $data['check_out'] ?? $reservation->check_out->toDateString();
            $this->assertDates($checkIn, $checkOut);

            $roomId = array_key_exists('room_id', $data) ? $data['room_id'] : $reservation->room_id;
            if ($roomId) {
                $room = Room::where('id', $roomId)->lockForUpdate()->firstOrFail();
                if (! $room->isAssignable()) {
                    throw ValidationException::withMessages([
                        'room_id' => ["Room {$room->number} is '{$room->status}' and cannot be assigned."],
                    ]);
                }
                $this->assertNoOverlap($roomId, $checkIn, $checkOut, $reservation->id);
            }

            $reservation->update([
                'check_in' => $checkIn,
                'check_out' => $checkOut,
                'room_id' => $roomId,
                'adults' => $data['adults'] ?? $reservation->adults,
                'children' => $data['children'] ?? $reservation->children,
                'notes' => $data['notes'] ?? $reservation->notes,
            ]);

            // Recompute estimate if dates changed.
            $nights = (int) (new \DateTime($checkIn))->diff(new \DateTime($checkOut))->days;
            $reservation->update([
                'total_estimate' => round((float) $reservation->nightly_rate * $nights, 2),
            ]);

            $this->audit->log('reservation.updated', $reservation, [
                'confirmation_code' => $reservation->confirmation_code,
            ]);

            return $reservation->fresh(['guest', 'room', 'roomType', 'ratePlan']);
        });
    }

    public function transition(Reservation $reservation, string $to): Reservation
    {
        if ($to === 'checked_in') {
            throw ValidationException::withMessages([
                'status' => ['Use the check-in flow to check a guest in.'],
            ]);
        }
        if (! in_array($to, Reservation::STATUSES, true)) {
            throw ValidationException::withMessages([
                'status' => ["Unknown reservation status '{$to}'."],
            ]);
        }
        if (! $reservation->canTransitionTo($to)) {
            throw ValidationException::withMessages([
                'status' => ["Illegal transition: {$reservation->status} → {$to}."],
            ]);
        }

        $from = $reservation->status;
        $reservation->update(['status' => $to]);
        $this->audit->log('reservation.status_changed', $reservation, [
            'confirmation_code' => $reservation->confirmation_code,
            'from' => $from, 'to' => $to,
        ]);

        return $reservation->fresh(['guest', 'room', 'roomType']);
    }

    public function cancel(Reservation $reservation, ?string $reason = null): Reservation
    {
        if (! in_array($reservation->status, ['inquiry', 'reserved', 'confirmed'], true)) {
            throw ValidationException::withMessages([
                'reservation' => ["Reservation '{$reservation->status}' cannot be cancelled."],
            ]);
        }

        return DB::transaction(function () use ($reservation, $reason) {
            $from = $reservation->status;
            $reservation->update([
                'status' => 'cancelled',
                'cancelled_at' => now(),
                'cancellation_reason' => $reason,
            ]);

            // Release the room back to available if it was held by this reservation.
            if ($reservation->room_id) {
                $room = Room::where('id', $reservation->room_id)->lockForUpdate()->first();
                if ($room && $room->status === 'reserved') {
                    $stillHeld = Reservation::overlaps(
                        $room->id,
                        $reservation->check_in->toDateString(),
                        $reservation->check_out->toDateString(),
                        $reservation->id
                    )->exists();
                    if (! $stillHeld) {
                        $room->update(['status' => 'available']);
                    }
                }
            }

            $this->audit->log('reservation.cancelled', $reservation, [
                'confirmation_code' => $reservation->confirmation_code,
                'from' => $from, 'reason' => $reason,
            ]);

            return $reservation->fresh(['guest', 'room', 'roomType']);
        });
    }

    public function noShow(Reservation $reservation): Reservation
    {
        if (! in_array($reservation->status, ['reserved', 'confirmed'], true)) {
            throw ValidationException::withMessages([
                'reservation' => ["Only reserved/confirmed reservations can be marked no-show."],
            ]);
        }

        return DB::transaction(function () use ($reservation) {
            $reservation->update(['status' => 'no_show']);

            if ($reservation->room_id) {
                $room = Room::where('id', $reservation->room_id)->lockForUpdate()->first();
                if ($room && $room->status === 'reserved') {
                    $room->update(['status' => 'available']);
                }
            }

            $this->audit->log('reservation.no_show', $reservation, [
                'confirmation_code' => $reservation->confirmation_code,
            ]);

            return $reservation->fresh(['guest', 'room', 'roomType']);
        });
    }

    public function delete(Reservation $reservation): void
    {
        if (! in_array($reservation->status, ['inquiry', 'cancelled', 'no_show'], true)) {
            throw ValidationException::withMessages([
                'reservation' => ["Only inquiry/cancelled/no-show reservations can be deleted."],
            ]);
        }
        $this->audit->log('reservation.deleted', $reservation, [
            'confirmation_code' => $reservation->confirmation_code,
        ]);
        $reservation->delete();
    }

    private function assertDates(string $checkIn, string $checkOut): void
    {
        if ($checkOut <= $checkIn) {
            throw ValidationException::withMessages([
                'check_out' => ['Check-out date must be after check-in date.'],
            ]);
        }
    }

    private function assertNoOverlap(int $roomId, string $checkIn, string $checkOut, ?int $ignoreId = null): void
    {
        $conflict = Reservation::overlaps($roomId, $checkIn, $checkOut, $ignoreId)->first();
        if ($conflict) {
            throw ValidationException::withMessages([
                'room_id' => [
                    "Room is already booked ({$conflict->confirmation_code}) for overlapping dates.",
                ],
            ]);
        }
    }

    /**
     * Generate the next RSV-YYYY-NNNNNN confirmation code, gap-safe within
     * the transaction (unique constraint is the final arbiter).
     */
    private function nextConfirmationCode(): string
    {
        $year = now()->format('Y');
        $prefix = "RSV-{$year}-";

        $max = Reservation::withoutGlobalScopes()
            ->where('confirmation_code', 'like', $prefix . '%')
            ->orderBy('confirmation_code', 'desc')
            ->value('confirmation_code');

        $next = $max ? ((int) substr($max, -6)) + 1 : 1;

        return $prefix . str_pad((string) $next, 6, '0', STR_PAD_LEFT);
    }
}
