<?php

namespace App\Domains\Inventory\Services;

use App\Domains\Inventory\Models\Amenity;
use App\Domains\Shared\Services\AuditService;

class AmenityService
{
    public function __construct(private AuditService $audit) {}

    public function create(array $data): Amenity
    {
        $amenity = Amenity::create($data);
        $this->audit->log('amenity.created', $amenity, ['name' => $amenity->name]);

        return $amenity;
    }

    public function update(Amenity $amenity, array $data): Amenity
    {
        $amenity->update($data);
        $this->audit->log('amenity.updated', $amenity);

        return $amenity->fresh();
    }

    public function delete(Amenity $amenity): void
    {
        $this->audit->log('amenity.deleted', $amenity, ['name' => $amenity->name]);
        $amenity->delete();
    }
}
