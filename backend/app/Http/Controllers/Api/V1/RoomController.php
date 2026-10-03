<?php

namespace App\Http\Controllers\Api\V1;

use App\Domains\Inventory\Models\Room;
use App\Domains\Inventory\Services\RoomService;
use App\Http\Requests\Api\V1\SetRoomStatusRequest;
use App\Http\Requests\Api\V1\StoreRoomRequest;
use App\Http\Requests\Api\V1\UpdateRoomRequest;
use Illuminate\Http\Request;

class RoomController
{
    public function index(Request $request)
    {
        $query = Room::with(['floor', 'roomType'])->orderBy('number');
        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }
        if ($request->filled('room_type_id')) {
            $query->where('room_type_id', $request->integer('room_type_id'));
        }
        if ($request->filled('floor_id')) {
            $query->where('floor_id', $request->integer('floor_id'));
        }
        return response()->json($query->paginate(15));
    }

    public function store(StoreRoomRequest $request, RoomService $service)
    {
        return response()->json(['data' => $service->create($request->validated())], 201);
    }

    public function show(Room $room)
    {
        return response()->json(['data' => $room->load(['floor', 'roomType'])]);
    }

    public function update(UpdateRoomRequest $request, Room $room, RoomService $service)
    {
        return response()->json(['data' => $service->update($room, $request->validated())]);
    }

    public function destroy(Room $room, RoomService $service)
    {
        $service->delete($room);
        return response()->json(['message' => 'Room deleted.']);
    }

    public function setStatus(SetRoomStatusRequest $request, Room $room, RoomService $service)
    {
        $data = $request->validated();
        $room = $service->setStatus($room, $data['status'], $data['reason'] ?? null);
        return response()->json(['data' => $room]);
    }
}
