<?php

namespace App\Domains\Inventory\Models;

use App\Domains\Shared\Traits\BelongsToHotel;
use Illuminate\Database\Eloquent\Model;

class Amenity extends Model
{
    use BelongsToHotel;

    protected $fillable = ['hotel_id', 'name', 'icon'];
}
