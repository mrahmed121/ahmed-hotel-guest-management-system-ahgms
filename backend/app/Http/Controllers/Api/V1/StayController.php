<?php

namespace App\Http\Controllers\Api\V1;

use App\Domains\FrontDesk\Models\Stay;
use Illuminate\Http\Request;

class StayController
{
    public function index(Request $request)
    {
        $query = Stay::with(['guest', 'room', 'room.roomType', 'reservation'])
            ->orderByDesc('checked_in_at');

        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        } else {
            $query->where('status', 'in_house');
        }
        if ($request->filled('guest_id')) {
            $query->where('guest_id', $request->integer('guest_id'));
        }
        if ($request->filled('room_id')) {
            $query->where('room_id', $request->integer('room_id'));
        }

        return response()->json($query->paginate(15));
    }

    public function show(Stay $stay)
    {
        return response()->json([
            'data' => $stay->load([
                'guest', 'room', 'room.roomType', 'reservation',
                'roomHistory.fromRoom', 'roomHistory.toRoom', 'roomHistory.actor',
            ]),
        ]);
    }
}
