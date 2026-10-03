<?php

namespace App\Http\Controllers\Api\V1;

use App\Domains\FrontDesk\Models\Stay;
use App\Domains\FrontDesk\Services\RoomMoveService;
use App\Http\Requests\Api\V1\RoomMoveRequest;

class RoomMoveController
{
    public function move(RoomMoveRequest $request, Stay $stay, RoomMoveService $service)
    {
        $stay = $service->move(
            $stay->id,
            $request->integer('new_room_id'),
            $request->string('reason')->toString()
        );

        return response()->json(['data' => $stay]);
    }
}
