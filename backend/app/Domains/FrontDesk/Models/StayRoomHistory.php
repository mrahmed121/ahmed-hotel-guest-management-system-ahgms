<?php

namespace App\Domains\FrontDesk\Models;

use App\Domains\Inventory\Models\Room;
use App\Domains\Shared\Models\User;
use Illuminate\Database\Eloquent\Model;

/**
 * StayRoomHistory — append-only record of room moves within a stay.
 * No update/delete API: history is preserved forever.
 */
class StayRoomHistory extends Model
{
    public $timestamps = false;

    protected $table = 'stay_room_history';

    protected $fillable = [
        'stay_id', 'from_room_id', 'to_room_id',
        'reason', 'actor_id', 'created_at',
    ];

    protected $casts = [
        'created_at' => 'datetime',
    ];

    public function stay()
    {
        return $this->belongsTo(Stay::class);
    }

    public function fromRoom()
    {
        return $this->belongsTo(Room::class, 'from_room_id');
    }

    public function toRoom()
    {
        return $this->belongsTo(Room::class, 'to_room_id');
    }

    public function actor()
    {
        return $this->belongsTo(User::class, 'actor_id');
    }
}
