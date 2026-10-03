<?php

namespace App\Domains\Guests\Models;

use App\Domains\Shared\Traits\BelongsToHotel;
use Illuminate\Database\Eloquent\Model;

class Guest extends Model
{
    use BelongsToHotel;

    public const STATUSES = ['active', 'blacklisted'];

    public const ID_TYPES = ['passport', 'cnic', 'driving_license', 'other'];

    protected $fillable = [
        'hotel_id', 'first_name', 'last_name', 'email', 'phone',
        'country', 'id_type', 'id_number', 'address', 'notes',
        'vip', 'status',
    ];

    protected $casts = [
        'vip' => 'boolean',
    ];

    protected $appends = ['full_name'];

    public function getFullNameAttribute(): string
    {
        return trim($this->first_name . ' ' . $this->last_name);
    }

    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }

    public function reservations()
    {
        return $this->hasMany(\App\Domains\Reservations\Models\Reservation::class);
    }
}
