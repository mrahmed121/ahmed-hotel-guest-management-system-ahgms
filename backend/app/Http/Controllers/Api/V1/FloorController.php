<?php

namespace App\Http\Controllers\Api\V1;

use App\Domains\Inventory\Models\Floor;
use App\Domains\Inventory\Services\FloorService;
use App\Http\Requests\Api\V1\StoreFloorRequest;
use App\Http\Requests\Api\V1\UpdateFloorRequest;

class FloorController
{
    public function index()
    {
        return response()->json(Floor::withCount('rooms')->orderBy('number')->paginate(15));
    }

    public function store(StoreFloorRequest $request, FloorService $service)
    {
        return response()->json(['data' => $service->create($request->validated())], 201);
    }

    public function show(Floor $floor)
    {
        return response()->json(['data' => $floor->loadCount('rooms')]);
    }

    public function update(UpdateFloorRequest $request, Floor $floor, FloorService $service)
    {
        return response()->json(['data' => $service->update($floor, $request->validated())]);
    }

    public function destroy(Floor $floor, FloorService $service)
    {
        $service->delete($floor);
        return response()->json(['message' => 'Floor deleted.']);
    }
}
