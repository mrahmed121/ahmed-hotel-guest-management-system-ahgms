<?php

namespace App\Http\Controllers\Api\V1;

use App\Domains\Shared\Models\Role;

class RoleController
{
    public function index()
    {
        $user = request()->user('api');
        $query = Role::with('permissions')->orderBy('name');
        if (! $user->isSuperAdmin()) {
            $query->where(function ($q) use ($user) {
                $q->where('hotel_id', $user->hotel_id)->orWhereNull('hotel_id');
            });
        }
        return response()->json(['data' => $query->get()]);
    }
}
