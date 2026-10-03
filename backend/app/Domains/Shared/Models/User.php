<?php

namespace App\Domains\Shared\Models;

use App\Domains\Shared\Traits\BelongsToHotel;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Tymon\JWTAuth\Contracts\JWTSubject;

class User extends Authenticatable implements JWTSubject
{
    use BelongsToHotel;

    protected $fillable = ['hotel_id', 'name', 'email', 'password', 'role_id', 'is_active'];

    protected $hidden = ['password', 'remember_token'];

    protected $casts = [
        'is_active' => 'boolean',
        'password' => 'hashed',
    ];

    public function hotel()
    {
        return $this->belongsTo(Hotel::class);
    }

    public function role()
    {
        return $this->belongsTo(Role::class);
    }

    public function isSuperAdmin(): bool
    {
        return $this->role && $this->role->slug === 'super_admin';
    }

    public function hasPermission(string $slug): bool
    {
        return $this->role && $this->role->hasPermission($slug);
    }

    public function getJWTIdentifier()
    {
        return $this->getKey();
    }

    public function getJWTCustomClaims(): array
    {
        return [
            'hotel_id' => $this->hotel_id,
            'role' => $this->role?->slug,
        ];
    }
}
