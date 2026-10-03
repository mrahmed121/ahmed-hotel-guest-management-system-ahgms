<?php

namespace App\Domains\Shared\Traits;

use App\Domains\Shared\Scopes\HotelScope;
use Illuminate\Support\Facades\Auth;

/**
 * BelongsToHotel — attach to every hotel-owned model.
 * Adds the HotelScope global scope + auto-fills hotel_id on creation.
 */
trait BelongsToHotel
{
    public static function bootBelongsToHotel(): void
    {
        static::addGlobalScope(new HotelScope);

        static::creating(function ($model) {
            if (empty($model->hotel_id) && Auth::check() && Auth::user()->hotel_id) {
                $model->hotel_id = Auth::user()->hotel_id;
            }
        });
    }

    public function hotel()
    {
        return $this->belongsTo(\App\Domains\Shared\Models\Hotel::class);
    }
}
