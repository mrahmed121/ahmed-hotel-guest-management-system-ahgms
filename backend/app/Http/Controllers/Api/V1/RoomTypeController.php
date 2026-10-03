<?php

namespace App\Http\Controllers\Api\V1;

use App\Domains\Inventory\Models\RoomType;
use App\Domains\Inventory\Services\RoomTypeService;
use App\Http\Requests\Api\V1\StoreRoomTypeRequest;
use App\Http\Requests\Api\V1\UpdateRoomTypeRequest;
use Illuminate\Http\Request;

class RoomTypeController
{
    public function index(Request $request)
    {
        $query = RoomType::withCount('rooms')->orderBy('name');
        if ($request->boolean('active_only')) {
            $query->where('is_active', true);
        }
        return response()->json($query->paginate(15));
    }

    public function store(StoreRoomTypeRequest $request, RoomTypeService $service)
    {
        return response()->json(['data' => $service->create($request->validated())], 201);
    }

    public function show(RoomType $roomType)
    {
        return response()->json(['data' => $roomType->loadCount(['rooms', 'ratePlans'])]);
    }

    public function update(UpdateRoomTypeRequest $request, RoomType $roomType, RoomTypeService $service)
    {
        return response()->json(['data' => $service->update($roomType, $request->validated())]);
    }

    public function destroy(RoomType $roomType, RoomTypeService $service)
    {
        $service->delete($roomType);
        return response()->json(['message' => 'Room type deleted.']);
    }
}
