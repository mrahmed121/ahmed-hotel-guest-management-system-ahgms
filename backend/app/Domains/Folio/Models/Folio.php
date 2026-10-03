<?php

namespace App\Domains\Folio\Models;

use App\Domains\FrontDesk\Models\Stay;
use App\Domains\Shared\Traits\BelongsToHotel;
use Illuminate\Database\Eloquent\Model;

class Folio extends Model
{
    use BelongsToHotel;

    public const STATUSES = ['open', 'closed'];

    protected $fillable = [
        'hotel_id', 'stay_id', 'folio_number',
        'status', 'opened_at', 'closed_at',
    ];

    protected $casts = [
        'opened_at' => 'datetime',
        'closed_at' => 'datetime',
    ];

    public function stay()
    {
        return $this->belongsTo(Stay::class);
    }

    public function lines()
    {
        return $this->hasMany(FolioLine::class);
    }

    public function payments()
    {
        return $this->hasMany(Payment::class);
    }

    public function adjustments()
    {
        return $this->hasMany(FolioAdjustment::class);
    }

    public function isOpen(): bool
    {
        return $this->status === 'open';
    }
}
