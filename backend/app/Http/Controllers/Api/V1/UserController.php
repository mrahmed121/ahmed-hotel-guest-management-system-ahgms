<?php

namespace App\Http\Controllers\Api\V1;

use App\Domains\Shared\Models\Role;
use App\Domains\Shared\Models\User;
use App\Domains\Shared\Services\AuditService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class UserController
{
    public function index()
    {
        $users = User::with(['role', 'hotel'])->orderBy('name')->paginate(15);
        return response()->json($users);
    }

    public function store(Request $request, AuditService $audit)
    {
        $actor = $request->user('api');

        $data = $request->validate([
            'name' => 'required|string|max:120',
            'email' => 'required|email|max:120|unique:users,email',
            'password' => 'required|string|min:8',
            'role_id' => 'required|exists:roles,id',
            'hotel_id' => 'nullable|exists:hotels,id',
            'is_active' => 'sometimes|boolean',
        ]);

        $role = Role::findOrFail($data['role_id']);

        // Non-super-admins can only create users in their own hotel
        // and cannot create super admins.
        if (! $actor->isSuperAdmin()) {
            if ($role->slug === 'super_admin') {
                abort(403, 'Cannot assign super admin role.');
            }
            $data['hotel_id'] = $actor->hotel_id;
        }

        $user = User::create($data);
        $audit->log('user.created', $user, ['email' => $user->email]);

        return response()->json(['data' => $user->load('role')], 201);
    }

    public function show(User $user)
    {
        return response()->json(['data' => $user->load(['role', 'hotel'])]);
    }

    public function update(Request $request, User $user, AuditService $audit)
    {
        $actor = $request->user('api');

        $data = $request->validate([
            'name' => 'sometimes|string|max:120',
            'password' => 'sometimes|string|min:8',
            'role_id' => 'sometimes|exists:roles,id',
            'is_active' => 'sometimes|boolean',
        ]);

        if (isset($data['role_id'])) {
            $role = Role::findOrFail($data['role_id']);
            if (! $actor->isSuperAdmin() && $role->slug === 'super_admin') {
                abort(403, 'Cannot assign super admin role.');
            }
        }

        // Prevent deactivating yourself.
        if ($user->id === $actor->id && array_key_exists('is_active', $data) && ! $data['is_active']) {
            abort(422, 'You cannot deactivate your own account.');
        }

        $user->update($data);
        $audit->log('user.updated', $user);

        return response()->json(['data' => $user->load('role')]);
    }
}
