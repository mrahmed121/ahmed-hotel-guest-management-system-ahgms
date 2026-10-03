<?php

namespace App\Domains\Inventory\Services;

use App\Domains\Inventory\Models\RatePlan;
use App\Domains\Inventory\Models\RoomType;
use App\Domains\Shared\Services\AuditService;
use Illuminate\Validation\ValidationException;

class RatePlanService
{
    public function __construct(private AuditService $audit) {}

    public function create(array $data): RatePlan
    {
        $this->assertRoomTypeInHotel($data['room_type_id']);

        if ($data['valid_to'] < $data['valid_from']) {
            throw ValidationException::withMessages([
                'valid_to' => ['The valid-to date must be on or after the valid-from date.'],
            ]);
        }

        $plan = RatePlan::create($data);
        $this->audit->log('rate-plan.created', $plan, ['name' => $plan->name]);

        return $plan;
    }

    public function update(RatePlan $plan, array $data): RatePlan
    {
        if (isset($data['room_type_id'])) {
            $this->assertRoomTypeInHotel($data['room_type_id']);
        }

        $from = $data['valid_from'] ?? $plan->valid_from->format('Y-m-d');
        $to = $data['valid_to'] ?? $plan->valid_to->format('Y-m-d');
        if ($to < $from) {
            throw ValidationException::withMessages([
                'valid_to' => ['The valid-to date must be on or after the valid-from date.'],
            ]);
        }

        $plan->update($data);
        $this->audit->log('rate-plan.updated', $plan);

        return $plan->fresh();
    }

    public function delete(RatePlan $plan): void
    {
        $this->audit->log('rate-plan.deleted', $plan, ['name' => $plan->name]);
        $plan->delete();
    }

    private function assertRoomTypeInHotel(int $roomTypeId): void
    {
        // Global scope ensures cross-hotel room types resolve to null → 404-style failure.
        if (! RoomType::where('id', $roomTypeId)->exists()) {
            throw ValidationException::withMessages([
                'room_type_id' => ['The selected room type is invalid.'],
            ]);
        }
    }
}
