<?php

namespace App\Domains\Inventory\Services;

use App\Domains\Inventory\Models\RoomType;
use App\Domains\Shared\Services\AuditService;
use Illuminate\Validation\ValidationException;

class RoomTypeService
{
    public function __construct(private AuditService $audit) {}

    public function create(array $data): RoomType
    {
        $roomType = RoomType::create($data);
        $this->audit->log('room-type.created', $roomType, ['code' => $roomType->code]);

        return $roomType;
    }

    public function update(RoomType $roomType, array $data): RoomType
    {
        $roomType->update($data);
        $this->audit->log('room-type.updated', $roomType);

        return $roomType->fresh();
    }

    public function delete(RoomType $roomType): void
    {
        if ($roomType->rooms()->exists()) {
            throw ValidationException::withMessages([
                'room_type' => ['Cannot delete a room type that still has rooms.'],
            ]);
        }
        if ($roomType->ratePlans()->exists()) {
            throw ValidationException::withMessages([
                'room_type' => ['Cannot delete a room type that still has rate plans.'],
            ]);
        }
        $this->audit->log('room-type.deleted', $roomType, ['code' => $roomType->code]);
        $roomType->delete();
    }
}
