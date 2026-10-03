<?php

namespace App\Http\Controllers\Api\V1;

use App\Domains\Guests\Models\Guest;
use App\Domains\Guests\Services\GuestService;
use App\Http\Requests\Api\V1\StoreGuestRequest;
use App\Http\Requests\Api\V1\UpdateGuestRequest;
use Illuminate\Http\Request;

class GuestController
{
    public function index(Request $request)
    {
        $query = Guest::orderBy('last_name')->orderBy('first_name');
        if ($request->filled('search')) {
            $s = $request->string('search');
            $query->where(function ($q) use ($s) {
                $q->where('first_name', 'like', "%{$s}%")
                  ->orWhere('last_name', 'like', "%{$s}%")
                  ->orWhere('phone', 'like', "%{$s}%")
                  ->orWhere('email', 'like', "%{$s}%");
            });
        }
        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }
        if ($request->boolean('vip')) {
            $query->where('vip', true);
        }
        return response()->json($query->paginate(15));
    }

    public function store(StoreGuestRequest $request, GuestService $service)
    {
        return response()->json(['data' => $service->create($request->validated())], 201);
    }

    public function show(Guest $guest)
    {
        return response()->json(['data' => $guest->load('reservations')]);
    }

    public function update(UpdateGuestRequest $request, Guest $guest, GuestService $service)
    {
        return response()->json(['data' => $service->update($guest, $request->validated())]);
    }

    public function destroy(Guest $guest, GuestService $service)
    {
        $service->delete($guest);
        return response()->json(['message' => 'Guest deleted.']);
    }

    public function blacklist(Request $request, Guest $guest, GuestService $service)
    {
        $request->validate(['reason' => ['nullable', 'string', 'max:255']]);
        return response()->json([
            'data' => $service->blacklist($guest, $request->input('reason')),
        ]);
    }

    public function unblacklist(Guest $guest, GuestService $service)
    {
        return response()->json(['data' => $service->unblacklist($guest)]);
    }
}
