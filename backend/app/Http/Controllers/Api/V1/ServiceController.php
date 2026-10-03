<?php

namespace App\Http\Controllers\Api\V1;

use App\Domains\Housekeeping\Models\Service;
use App\Domains\Housekeeping\Services\ServiceCatalogService;
use App\Http\Requests\Api\V1\StoreServiceRequest;
use App\Http\Requests\Api\V1\UpdateServiceRequest;

class ServiceController
{
    public function index(ServiceCatalogService $service)
    {
        return response()->json(['data' => Service::orderBy('name')->paginate(15)]);
    }

    public function active(ServiceCatalogService $service)
    {
        return response()->json(['data' => $service->active()]);
    }

    public function store(StoreServiceRequest $request, ServiceCatalogService $service)
    {
        return response()->json(['data' => $service->create($request->validated())], 201);
    }

    public function show(Service $service)
    {
        return response()->json(['data' => $service]);
    }

    public function update(UpdateServiceRequest $request, Service $service, ServiceCatalogService $catalog)
    {
        return response()->json(['data' => $catalog->update($service, $request->validated())]);
    }

    public function destroy(Service $service, ServiceCatalogService $catalog)
    {
        $catalog->delete($service);
        return response()->json(['message' => 'Service deleted.']);
    }
}
