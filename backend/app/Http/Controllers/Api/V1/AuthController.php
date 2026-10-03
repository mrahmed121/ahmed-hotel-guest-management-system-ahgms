<?php

namespace App\Http\Controllers\Api\V1;

use App\Domains\Shared\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Tymon\JWTAuth\Facades\JWTAuth;

class AuthController
{
    public function login(Request $request)
    {
        $credentials = $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
        ]);

        // Look the user up WITHOUT the hotel global scope: authentication must
        // succeed regardless of any ambient authenticated user (the User model
        // carries BelongsToHotel, and Auth::attempt() resolves through that
        // scope, which breaks cross-hotel login whenever auth state leaks).
        $user = User::withoutGlobalScopes()->where('email', $credentials['email'])->first();

        if (! $user || ! Hash::check($credentials['password'], $user->password)) {
            return response()->json(['message' => 'Invalid credentials.'], 401);
        }

        if (! $user->is_active) {
            return response()->json(['message' => 'Account is inactive.'], 403);
        }

        $token = Auth::guard('api')->login($user);

        $user->load(['role.permissions', 'hotel']);

        return response()->json([
            'message' => 'Authenticated.',
            'data' => [
                'token' => $token,
                'token_type' => 'bearer',
                'expires_in' => config('jwt.ttl') * 60,
                'user' => $user,
            ],
        ]);
    }

    public function logout()
    {
        try {
            auth('api')->logout();
        } catch (\Throwable) {
            // Token already invalid/expired — still a successful logout.
        }

        return response()->json(['message' => 'Logged out.']);
    }

    public function refresh()
    {
        $token = JWTAuth::parseToken()->refresh();
        $user = Auth::guard('api')->setToken($token)->user();
        $user->load(['role.permissions', 'hotel']);

        return response()->json([
            'data' => [
                'token' => $token,
                'token_type' => 'bearer',
                'expires_in' => config('jwt.ttl') * 60,
                'user' => $user,
            ],
        ]);
    }

    public function me()
    {
        $user = Auth::guard('api')->user();
        $user->load(['role.permissions', 'hotel']);

        return response()->json(['data' => $user]);
    }
}
