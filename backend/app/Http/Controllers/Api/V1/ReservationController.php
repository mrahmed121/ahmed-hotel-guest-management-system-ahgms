<?php

namespace App\Http\Controllers\Api\V1;

use App\Domains\Reservations\Models\Reservation;
use App\Domains\Reservations\Services\ReservationService;
use App\Http\Requests\Api\V1\StoreReservationRequest;
use App\Http\Requests\Api\V1\UpdateReservationRequest;
use Illuminate\Http\Request;

class ReservationController
{
    public function index(Request $request)
    {
        $query = Reservation::with(['guest', 'room', 'roomType'])->orderByDesc('created_at');
        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }
        if ($request->filled('guest_id')) {
            $query->where('guest_id', $request->integer('guest_id'));
        }
        if ($request->filled('room_id')) {
            $query->where('room_id', $request->integer('room_id'));
        }
        if ($request->filled('check_in_from')) {
            $query->where('check_in', '>=', $request->string('check_in_from'));
        }
        if ($request->filled('check_in_to')) {
            $query->where('check_in', '<=', $request->string('check_in_to'));
        }
        if ($request->filled('confirmation_code')) {
            $query->where('confirmation_code', $request->string('confirmation_code'));
        }
        return response()->json($query->paginate(15));
    }

    public function store(StoreReservationRequest $request, ReservationService $service)
    {
        return response()->json(['data' => $service->create($request->validated())], 201);
    }

    public function show(Reservation $reservation)
    {
        return response()->json([
            'data' => $reservation->load(['guest', 'room', 'roomType', 'ratePlan']),
        ]);
    }

    public function update(UpdateReservationRequest $request, Reservation $reservation, ReservationService $service)
    {
        return response()->json(['data' => $service->update($reservation, $request->validated())]);
    }

    public function destroy(Reservation $reservation, ReservationService $service)
    {
        $service->delete($reservation);
        return response()->json(['message' => 'Reservation deleted.']);
    }

    public function confirm(Reservation $reservation, ReservationService $service)
    {
        return response()->json(['data' => $service->transition($reservation, 'confirmed')]);
    }

    public function cancel(Request $request, Reservation $reservation, ReservationService $service)
    {
        $request->validate(['reason' => ['nullable', 'string', 'max:255']]);
        return response()->json([
            'data' => $service->cancel($reservation, $request->input('reason')),
        ]);
    }

    public function noShow(Reservation $reservation, ReservationService $service)
    {
        return response()->json(['data' => $service->noShow($reservation)]);
    }
}
