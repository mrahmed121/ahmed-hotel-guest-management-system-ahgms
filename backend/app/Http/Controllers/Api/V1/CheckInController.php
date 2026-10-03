<?php

namespace App\Http\Controllers\Api\V1;

use App\Domains\FrontDesk\Services\CheckInService;
use App\Http\Requests\Api\V1\CheckInRequest;
use App\Http\Requests\Api\V1\WalkInRequest;

class CheckInController
{
    public function checkIn(CheckInRequest $request, CheckInService $service)
    {
        $result = $service->checkIn(
            $request->integer('reservation_id'),
            $request->only(['room_id', 'notes'])
        );

        return response()->json([
            'data' => $result['stay'],
            'meta' => ['early_check_in' => $result['early_check_in']],
        ], 201);
    }

    public function walkIn(WalkInRequest $request, CheckInService $service)
    {
        $result = $service->createWalkIn($request->validated());

        return response()->json([
            'data' => $result['stay'],
            'meta' => ['early_check_in' => $result['early_check_in'], 'walk_in' => true],
        ], 201);
    }
}
