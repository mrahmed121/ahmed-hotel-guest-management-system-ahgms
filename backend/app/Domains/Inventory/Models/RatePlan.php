<?php

namespace App\Domains\Inventory\Models;

use App\Domains\Shared\Traits\BelongsToHotel;
use Illuminate\Database\Eloquent\Model;

class RatePlan extends Model
{
    use BelongsToHotel;

    protected $fillable = [
        'hotel_id', 'room_type_id', 'name', 'base_rate',
        'valid_from', 'valid_to', 'tax_percent',
        'service_charge_percent', 'min_stay', 'is_active',
    ];

    protected $casts = [
        'base_rate' => 'decimal:2',
        'tax_percent' => 'decimal:2',
        'service_charge_percent' => 'decimal:2',
        'valid_from' => 'date',
        'valid_to' => 'date',
        'is_active' => 'boolean',
    ];

    public function roomType()
    {
        return $this->belongsTo(RoomType::class);
    }

    /**
     * Total per-night price including configured tax and service charge.
     * Formula: base × (1 + tax/100) × (1 + service_charge/100), rounded to 2dp.
     */
    public function nightlyTotal(): string
    {
        $base = (float) $this->base_rate;
        $total = $base * (1 + (float) $this->tax_percent / 100)
                      * (1 + (float) $this->service_charge_percent / 100);

        return number_format(round($total, 2), 2, '.', '');
    }
}
