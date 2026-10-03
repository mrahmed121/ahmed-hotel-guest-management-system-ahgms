<?php

namespace App\Http\Controllers\Api\V1;

use App\Domains\Reservations\Services\AvailabilityService;
use App\Http\Requests\Api\V1\AvailabilityRequest;

class AvailabilityController
{
    public function search(AvailabilityRequest $request, AvailabilityService $service)
    {
        $data = $request->validated();
        $user = $request->user('api');

        $hotelId = $user->hotel_id;
        // Super admins may query a specific hotel.
        if ($user->hotel_id === null && ! empty($data['hotel_id'])) {
            $hotelId = (int) $data['hotel_id'];
        }

        if ($hotelId === null) {
            return response()->json(['message' => 'Hotel context required.'], 422);
        }

        return response()->json([
            'data' => $service->search(
                $hotelId,
                $data['check_in'],
                $data['check_out'],
                $data['room_type_id'] ?? null,
                $data['adults'] ?? null,
            ),
        ]);
    }
}
