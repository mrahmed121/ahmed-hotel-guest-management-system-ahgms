<?php

namespace App\Http\Controllers\Api\V1;

use App\Domains\Shared\Models\Hotel;
use App\Domains\Shared\Services\AuditService;
use Illuminate\Http\Request;

class HotelController
{
    public function index()
    {
        // Super admin sees all; hotel users see only their own hotel.
        $user = request()->user('api');
        $query = Hotel::orderBy('name');
        if (! $user->isSuperAdmin()) {
            $query->where('id', $user->hotel_id);
        }
        return response()->json($query->paginate(15));
    }

    public function store(Request $request, AuditService $audit)
    {
        $data = $request->validate([
            'name' => 'required|string|max:120',
            'code' => 'required|string|max:20|unique:hotels,code',
            'address' => 'nullable|string|max:255',
            'phone' => 'nullable|string|max:40',
            'email' => 'nullable|email|max:120',
            'settings' => 'nullable|array',
        ]);

        $hotel = Hotel::create($data);
        $audit->log('hotel.created', $hotel, ['name' => $hotel->name]);

        return response()->json(['data' => $hotel], 201);
    }

    public function show(Hotel $hotel)
    {
        // Hotel model has no global scope; enforce manually for non-super-admins.
        $this->authorizeHotel($hotel);
        return response()->json(['data' => $hotel]);
    }

    public function update(Request $request, Hotel $hotel, AuditService $audit)
    {
        $this->authorizeHotel($hotel);

        $data = $request->validate([
            'name' => 'sometimes|string|max:120',
            'address' => 'nullable|string|max:255',
            'phone' => 'nullable|string|max:40',
            'email' => 'nullable|email|max:120',
            'settings' => 'nullable|array',
        ]);

        $hotel->update($data);
        $audit->log('hotel.updated', $hotel);

        return response()->json(['data' => $hotel]);
    }

    private function authorizeHotel(Hotel $hotel): void
    {
        $user = request()->user('api');
        if ($user->isSuperAdmin()) {
            return;
        }
        if ($user->hotel_id !== $hotel->id) {
            abort(404);
        }
    }
}
