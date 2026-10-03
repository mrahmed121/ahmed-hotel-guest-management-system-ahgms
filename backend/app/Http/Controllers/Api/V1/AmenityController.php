<?php

namespace App\Http\Controllers\Api\V1;

use App\Domains\Inventory\Models\Amenity;
use App\Domains\Inventory\Services\AmenityService;
use App\Http\Requests\Api\V1\StoreAmenityRequest;
use App\Http\Requests\Api\V1\UpdateAmenityRequest;

class AmenityController
{
    public function index()
    {
        return response()->json(Amenity::orderBy('name')->paginate(15));
    }

    public function store(StoreAmenityRequest $request, AmenityService $service)
    {
        return response()->json(['data' => $service->create($request->validated())], 201);
    }

    public function show(Amenity $amenity)
    {
        return response()->json(['data' => $amenity]);
    }

    public function update(UpdateAmenityRequest $request, Amenity $amenity, AmenityService $service)
    {
        return response()->json(['data' => $service->update($amenity, $request->validated())]);
    }

    public function destroy(Amenity $amenity, AmenityService $service)
    {
        $service->delete($amenity);
        return response()->json(['message' => 'Amenity deleted.']);
    }
}
