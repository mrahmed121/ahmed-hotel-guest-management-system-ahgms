<?php

namespace App\Domains\Inventory\Services;

use App\Domains\Inventory\Models\Floor;
use App\Domains\Inventory\Models\Room;
use App\Domains\Inventory\Models\RoomType;
use App\Domains\Shared\Services\AuditService;
use Illuminate\Validation\ValidationException;

class RoomService
{
    public function __construct(private AuditService $audit) {}

    public function create(array $data): Room
    {
        $this->assertFloorInHotel($data['floor_id'] ?? null);
        $this->assertRoomTypeInHotel($data['room_type_id']);

        $room = Room::create($data);
        $this->audit->log('room.created', $room, [
            'number' => $room->number, 'status' => $room->status,
        ]);

        return $room->load(['floor', 'roomType']);
    }

    public function update(Room $room, array $data): Room
    {
        if (array_key_exists('floor_id', $data)) {
            $this->assertFloorInHotel($data['floor_id']);
        }
        if (isset($data['room_type_id'])) {
            $this->assertRoomTypeInHotel($data['room_type_id']);
        }
        // Status changes go through setStatus() so transitions are validated.
        unset($data['status']);

        $room->update($data);
        $this->audit->log('room.updated', $room, ['number' => $room->number]);

        return $room->fresh(['floor', 'roomType']);
    }

    /**
     * Change room status with state-machine validation.
     * Moves INTO 'occupied' are rejected here — occupancy is set by
     * the P4 check-in flow only.
     */
    public function setStatus(Room $room, string $to, ?string $reason = null): Room
    {
        if (! in_array($to, Room::STATUSES, true)) {
            throw ValidationException::withMessages([
                'status' => ["Unknown room status '{$to}'."],
            ]);
        }

        if ($to === 'occupied') {
            throw ValidationException::withMessages([
                'status' => ['Rooms can only become occupied through the check-in flow.'],
            ]);
        }

        if (! $room->canTransitionTo($to)) {
            throw ValidationException::withMessages([
                'status' => ["Illegal status transition: {$room->status} → {$to}."],
            ]);
        }

        $from = $room->status;
        $room->update(['status' => $to]);
        $this->audit->log('room.status_changed', $room, [
            'number' => $room->number, 'from' => $from, 'to' => $to,
            'reason' => $reason,
        ]);

        return $room->fresh(['floor', 'roomType']);
    }

    public function delete(Room $room): void
    {
        if (in_array($room->status, ['reserved', 'occupied'], true)) {
            throw ValidationException::withMessages([
                'room' => ["Cannot delete a room with status '{$room->status}'."],
            ]);
        }
        $this->audit->log('room.deleted', $room, ['number' => $room->number]);
        $room->delete();
    }

    private function assertFloorInHotel(?int $floorId): void
    {
        if ($floorId === null) {
            return;
        }
        if (! Floor::where('id', $floorId)->exists()) {
            throw ValidationException::withMessages([
                'floor_id' => ['The selected floor is invalid.'],
            ]);
        }
    }

    private function assertRoomTypeInHotel(int $roomTypeId): void
    {
        if (! RoomType::where('id', $roomTypeId)->exists()) {
            throw ValidationException::withMessages([
                'room_type_id' => ['The selected room type is invalid.'],
            ]);
        }
    }
}
