<?php

namespace App\Domains\Inventory\Models;

use App\Domains\Shared\Traits\BelongsToHotel;
use Illuminate\Database\Eloquent\Model;

class RoomType extends Model
{
    use BelongsToHotel;

    protected $fillable = [
        'hotel_id', 'name', 'code', 'description',
        'base_rate', 'max_occupancy', 'amenities', 'is_active',
    ];

    protected $casts = [
        'base_rate' => 'decimal:2',
        'amenities' => 'array',
        'is_active' => 'boolean',
    ];

    public function rooms()
    {
        return $this->hasMany(Room::class);
    }

    public function ratePlans()
    {
        return $this->hasMany(RatePlan::class);
    }
}
