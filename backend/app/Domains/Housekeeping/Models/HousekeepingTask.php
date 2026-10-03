<?php

namespace App\Domains\Housekeeping\Models;

use App\Domains\Inventory\Models\Room;
use App\Domains\Shared\Models\User;
use App\Domains\Shared\Traits\BelongsToHotel;
use Illuminate\Database\Eloquent\Model;

class HousekeepingTask extends Model
{
    use BelongsToHotel;

    public const STATUSES = ['dirty', 'assigned', 'cleaning', 'inspection', 'ready'];

    public const PRIORITIES = ['low', 'normal', 'high', 'urgent'];

    /**
     * Legal task transitions. Room status is synced alongside:
     * dirty→(room dirty), assigned→(room stays dirty), cleaning→(room cleaning),
     * inspection→(room inspection), ready→(room ready).
     */
    public const TRANSITIONS = [
        'dirty'      => ['assigned'],
        'assigned'   => ['cleaning', 'dirty'],
        'cleaning'   => ['inspection'],
        'inspection' => ['ready', 'cleaning'],
        'ready'      => [],
    ];

    /** Task statuses considered "open" — one open task per room max. */
    public const OPEN_STATUSES = ['dirty', 'assigned', 'cleaning', 'inspection'];

    protected $fillable = [
        'hotel_id', 'room_id', 'assigned_to', 'status', 'priority',
        'notes', 'started_at', 'completed_at', 'inspected_by', 'inspected_at',
    ];

    protected $casts = [
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
        'inspected_at' => 'datetime',
    ];

    public function room()
    {
        return $this->belongsTo(Room::class);
    }

    public function assignee()
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function inspector()
    {
        return $this->belongsTo(User::class, 'inspected_by');
    }

    public function canTransitionTo(string $to): bool
    {
        return in_array($to, self::TRANSITIONS[$this->status] ?? [], true);
    }

    public function isOpen(): bool
    {
        return in_array($this->status, self::OPEN_STATUSES, true);
    }
}
