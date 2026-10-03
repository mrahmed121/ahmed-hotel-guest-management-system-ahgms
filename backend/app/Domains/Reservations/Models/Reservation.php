<?php

namespace App\Domains\Reservations\Models;

use App\Domains\Guests\Models\Guest;
use App\Domains\Inventory\Models\RatePlan;
use App\Domains\Inventory\Models\Room;
use App\Domains\Inventory\Models\RoomType;
use App\Domains\Shared\Traits\BelongsToHotel;
use Illuminate\Database\Eloquent\Model;

class Reservation extends Model
{
    use BelongsToHotel;

    public const STATUSES = [
        'inquiry', 'reserved', 'confirmed',
        'checked_in', 'checked_out',
        'cancelled', 'no_show',
    ];

    /**
     * Legal status transitions.
     * checked_in is intentionally absent as a direct target — the P4
     * check-in flow owns that transition.
     */
    public const TRANSITIONS = [
        'inquiry'     => ['reserved', 'cancelled'],
        'reserved'    => ['confirmed', 'cancelled', 'no_show'],
        'confirmed'   => ['cancelled', 'no_show'],
        'checked_in'  => ['checked_out'],
        'checked_out' => [],
        'cancelled'   => [],
        'no_show'     => [],
    ];

    /** Statuses that block a room's availability for a date range. */
    public const ACTIVE_STATUSES = ['inquiry', 'reserved', 'confirmed', 'checked_in'];

    protected $fillable = [
        'hotel_id', 'guest_id', 'room_id', 'room_type_id',
        'confirmation_code', 'status', 'check_in', 'check_out',
        'adults', 'children', 'rate_plan_id', 'nightly_rate',
        'total_estimate', 'source', 'notes',
        'cancelled_at', 'cancellation_reason',
        'checked_in_at', 'checked_out_at',
    ];

    protected $casts = [
        'check_in' => 'date',
        'check_out' => 'date',
        'nightly_rate' => 'decimal:2',
        'total_estimate' => 'decimal:2',
        'cancelled_at' => 'datetime',
        'checked_in_at' => 'datetime',
        'checked_out_at' => 'datetime',
    ];

    public function guest()
    {
        return $this->belongsTo(Guest::class);
    }

    public function room()
    {
        return $this->belongsTo(Room::class);
    }

    public function roomType()
    {
        return $this->belongsTo(RoomType::class);
    }

    public function ratePlan()
    {
        return $this->belongsTo(RatePlan::class);
    }

    public function isActive(): bool
    {
        return in_array($this->status, self::ACTIVE_STATUSES, true);
    }

    public function nights(): int
    {
        return (int) $this->check_in->diffInDays($this->check_out);
    }

    public function canTransitionTo(string $to): bool
    {
        return in_array($to, self::TRANSITIONS[$this->status] ?? [], true);
    }

    /**
     * Find active reservations overlapping a date range for a room.
     * Overlap rule: new.check_in < existing.check_out AND new.check_out > existing.check_in
     * (same-day turnover — checkout date == next checkin date — is allowed).
     *
     * Uses whereDate() because date-cast attributes are stored as
     * 'YYYY-MM-DD 00:00:00' strings in SQLite; plain string comparison
     * would treat '2026-10-13 00:00:00' > '2026-10-13' as true.
     */
    public static function overlaps(int $roomId, string $checkIn, string $checkOut, ?int $ignoreId = null)
    {
        $query = static::where('room_id', $roomId)
            ->whereIn('status', self::ACTIVE_STATUSES)
            ->whereDate('check_in', '<', $checkOut)
            ->whereDate('check_out', '>', $checkIn);

        if ($ignoreId !== null) {
            $query->where('id', '!=', $ignoreId);
        }

        return $query;
    }
}
