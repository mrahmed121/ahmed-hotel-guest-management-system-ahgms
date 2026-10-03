<?php

namespace App\Domains\Housekeeping\Models;

use App\Domains\Shared\Traits\BelongsToHotel;
use Illuminate\Database\Eloquent\Model;

class Service extends Model
{
    use BelongsToHotel;

    protected $fillable = [
        'hotel_id', 'name', 'code', 'description',
        'unit_price', 'taxable', 'active',
    ];

    protected $casts = [
        'unit_price' => 'decimal:2',
        'taxable' => 'boolean',
        'active' => 'boolean',
    ];
}
