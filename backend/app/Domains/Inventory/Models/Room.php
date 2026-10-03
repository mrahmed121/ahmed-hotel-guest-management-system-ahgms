<?php

namespace App\Domains\Inventory\Models;

use App\Domains\Shared\Traits\BelongsToHotel;
use Illuminate\Database\Eloquent\Model;

class Room extends Model
{
    use BelongsToHotel;

    public const STATUSES = [
        'available', 'reserved', 'occupied', 'dirty',
        'cleaning', 'inspection', 'ready',
        'maintenance', 'out_of_service',
    ];

    /**
     * Legal status transitions. Any move INTO 'occupied' is blocked here —
     * occupancy is set exclusively by the P4 check-in flow.
     */
    public const TRANSITIONS = [
        'available'      => ['reserved', 'maintenance', 'out_of_service'],
        'reserved'       => ['available', 'maintenance', 'out_of_service'],
        'occupied'       => ['dirty'],
        'dirty'          => ['cleaning', 'maintenance', 'out_of_service'],
        'cleaning'       => ['inspection', 'maintenance', 'out_of_service'],
        'inspection'     => ['ready', 'cleaning'],
        'ready'          => ['available', 'maintenance', 'out_of_service'],
        'maintenance'    => ['available', 'dirty', 'out_of_service'],
        'out_of_service' => ['available', 'maintenance'],
    ];

    protected $fillable = [
        'hotel_id', 'floor_id', 'room_type_id',
        'number', 'status', 'features', 'notes',
    ];

    protected $casts = [
        'features' => 'array',
    ];

    public function floor()
    {
        return $this->belongsTo(Floor::class);
    }

    public function roomType()
    {
        return $this->belongsTo(RoomType::class);
    }

    public function canTransitionTo(string $to): bool
    {
        if ($to === 'occupied') {
            return false; // occupied only via check-in (P4)
        }

        return in_array($to, self::TRANSITIONS[$this->status] ?? [], true);
    }

    /** Rooms in these statuses can never be assigned to a stay/reservation. */
    public function isAssignable(): bool
    {
        return in_array($this->status, ['available', 'reserved', 'ready'], true);
    }
}
