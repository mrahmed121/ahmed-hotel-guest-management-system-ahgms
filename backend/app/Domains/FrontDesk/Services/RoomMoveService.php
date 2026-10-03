<?php

namespace App\Domains\FrontDesk\Services;

use App\Domains\FrontDesk\Events\RoomBecameDirty;
use App\Domains\FrontDesk\Models\Stay;
use App\Domains\FrontDesk\Models\StayRoomHistory;
use App\Domains\Inventory\Models\Room;
use App\Domains\Reservations\Models\Reservation;
use App\Domains\Shared\Services\AuditService;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class RoomMoveService
{
    public function __construct(private AuditService $audit) {}

    /**
     * Move an in-house guest to another room.
     * Old room → dirty (needs turnover); new room → occupied.
     * Every move is appended to stay_room_history — never overwritten.
     */
    public function move(int $stayId, int $newRoomId, string $reason): Stay
    {
        return DB::transaction(function () use ($stayId, $newRoomId, $reason) {
            $stay = Stay::with(['room', 'reservation', 'guest'])
                ->lockForUpdate()
                ->findOrFail($stayId);

            if (! $stay->isInHouse()) {
                throw ValidationException::withMessages([
                    'stay' => ['Only in-house stays can be moved.'],
                ]);
            }

            if ($stay->room_id === $newRoomId) {
                throw ValidationException::withMessages([
                    'new_room_id' => ['Guest is already in this room.'],
                ]);
            }

            $newRoom = Room::where('id', $newRoomId)->lockForUpdate()->firstOrFail();

            if (in_array($newRoom->status, ['maintenance', 'out_of_service'], true)) {
                throw ValidationException::withMessages([
                    'new_room_id' => ["Room {$newRoom->number} is '{$newRoom->status}' and cannot be assigned."],
                ]);
            }
            if ($newRoom->status === 'occupied') {
                throw ValidationException::withMessages([
                    'new_room_id' => ["Room {$newRoom->number} is currently occupied."],
                ]);
            }
            if ($newRoom->room_type_id !== (int) $stay->reservation->room_type_id) {
                throw ValidationException::withMessages([
                    'new_room_id' => ['Room does not belong to the reservation room type.'],
                ]);
            }

            // New room must be free for the remainder of the stay.
            $conflict = Reservation::overlaps(
                $newRoom->id,
                now()->toDateString(),
                $stay->expected_checkout->toDateString(),
                $stay->reservation_id
            )->first();
            if ($conflict) {
                throw ValidationException::withMessages([
                    'new_room_id' => ["Room {$newRoom->number} is booked ({$conflict->confirmation_code}) for overlapping dates."],
                ]);
            }

            $oldRoom = Room::where('id', $stay->room_id)->lockForUpdate()->firstOrFail();

            StayRoomHistory::create([
                'stay_id' => $stay->id,
                'from_room_id' => $oldRoom->id,
                'to_room_id' => $newRoom->id,
                'reason' => $reason,
                'actor_id' => Auth::id(),
                'created_at' => now(),
            ]);

            $stay->update(['room_id' => $newRoom->id]);

            $oldRoom->update(['status' => 'dirty']);
            // P4 owns occupancy: set directly (Room::canTransitionTo blocks 'occupied').
            $newRoom->update(['status' => 'occupied']);

            $this->audit->log('stay.room_moved', $stay, [
                'guest' => $stay->guest->full_name,
                'from_room' => $oldRoom->number,
                'to_room' => $newRoom->number,
                'reason' => $reason,
            ]);

            event(new RoomBecameDirty($oldRoom, "room move of stay #{$stay->id}"));

            return $stay->fresh(['guest', 'room', 'room.roomType', 'reservation', 'roomHistory']);
        });
    }
}
