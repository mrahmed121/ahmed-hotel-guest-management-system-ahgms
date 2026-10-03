<?php

namespace App\Domains\FrontDesk\Models;

use App\Domains\Guests\Models\Guest;
use App\Domains\Inventory\Models\Room;
use App\Domains\Reservations\Models\Reservation;
use App\Domains\Shared\Traits\BelongsToHotel;
use Illuminate\Database\Eloquent\Model;

class Stay extends Model
{
    use BelongsToHotel;

    public const STATUSES = ['in_house', 'checked_out'];

    protected $fillable = [
        'hotel_id', 'reservation_id', 'guest_id', 'room_id',
        'checked_in_at', 'checked_out_at', 'expected_checkout',
        'status', 'adults', 'children', 'notes',
    ];

    protected $casts = [
        'checked_in_at' => 'datetime',
        'checked_out_at' => 'datetime',
        'expected_checkout' => 'date',
    ];

    public function reservation()
    {
        return $this->belongsTo(Reservation::class);
    }

    public function guest()
    {
        return $this->belongsTo(Guest::class);
    }

    public function room()
    {
        return $this->belongsTo(Room::class);
    }

    public function roomHistory()
    {
        return $this->hasMany(StayRoomHistory::class)->orderBy('created_at');
    }

    public function isInHouse(): bool
    {
        return $this->status === 'in_house';
    }
}
