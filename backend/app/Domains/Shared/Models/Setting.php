<?php

namespace App\Domains\Shared\Models;

use App\Domains\Shared\Traits\BelongsToHotel;
use Illuminate\Database\Eloquent\Model;

class Setting extends Model
{
    use BelongsToHotel;

    protected $fillable = ['hotel_id', 'key', 'value'];

    protected $casts = [
        'value' => 'array',
    ];
}
