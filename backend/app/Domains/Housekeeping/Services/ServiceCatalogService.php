<?php

namespace App\Domains\Housekeeping\Services;

use App\Domains\Housekeeping\Models\Service;
use App\Domains\Shared\Services\AuditService;
use Illuminate\Validation\ValidationException;

class ServiceCatalogService
{
    public function __construct(private AuditService $audit) {}

    public function create(array $data): Service
    {
        $service = Service::create($data);
        $this->audit->log('service.created', $service, ['name' => $service->name]);

        return $service;
    }

    public function update(Service $service, array $data): Service
    {
        $service->update($data);
        $this->audit->log('service.updated', $service, ['name' => $service->name]);

        return $service->fresh();
    }

    public function delete(Service $service): void
    {
        $this->audit->log('service.deleted', $service, ['name' => $service->name]);
        $service->delete();
    }

    /** Active services for the folio charge picker. */
    public function active()
    {
        return Service::where('active', true)->orderBy('name')->get();
    }

    /** Find an active service by id — used by FolioService::addServiceCharge. */
    public function findActive(int $id): Service
    {
        $service = Service::where('active', true)->find($id);
        if (! $service) {
            throw ValidationException::withMessages([
                'service_id' => ['Service not found or inactive.'],
            ]);
        }

        return $service;
    }
}
