<?php

namespace App\Domains\Inventory\Services;

use App\Domains\Inventory\Models\Floor;
use App\Domains\Shared\Services\AuditService;
use Illuminate\Validation\ValidationException;

class FloorService
{
    public function __construct(private AuditService $audit) {}

    public function create(array $data): Floor
    {
        $floor = Floor::create($data);
        $this->audit->log('floor.created', $floor, ['number' => $floor->number]);

        return $floor;
    }

    public function update(Floor $floor, array $data): Floor
    {
        $floor->update($data);
        $this->audit->log('floor.updated', $floor);

        return $floor->fresh();
    }

    public function delete(Floor $floor): void
    {
        if ($floor->rooms()->exists()) {
            throw ValidationException::withMessages([
                'floor' => ['Cannot delete a floor that still has rooms. Move or delete the rooms first.'],
            ]);
        }
        $this->audit->log('floor.deleted', $floor, ['number' => $floor->number]);
        $floor->delete();
    }
}
