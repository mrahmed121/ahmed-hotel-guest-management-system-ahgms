<?php

namespace App\Domains\Inventory\Models;

use App\Domains\Shared\Traits\BelongsToHotel;
use Illuminate\Database\Eloquent\Model;

class Floor extends Model
{
    use BelongsToHotel;

    protected $fillable = ['hotel_id', 'number', 'name'];

    public function rooms()
    {
        return $this->hasMany(Room::class);
    }
}
