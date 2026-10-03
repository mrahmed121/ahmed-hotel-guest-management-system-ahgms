<?php

namespace App\Domains\Housekeeping\Models;

use App\Domains\Inventory\Models\Room;
use App\Domains\Shared\Models\User;
use App\Domains\Shared\Traits\BelongsToHotel;
use Illuminate\Database\Eloquent\Model;

class MaintenanceTicket extends Model
{
    use BelongsToHotel;

    public const CATEGORIES = ['ac', 'plumbing', 'electrical', 'furniture', 'tv', 'water', 'other'];

    public const PRIORITIES = ['low', 'normal', 'high', 'urgent'];

    public const STATUSES = [
        'open', 'triaged', 'assigned', 'in_progress', 'completed', 'verified', 'closed',
    ];

    public const TRANSITIONS = [
        'open'        => ['triaged', 'assigned', 'closed'],
        'triaged'     => ['assigned', 'closed'],
        'assigned'    => ['in_progress', 'closed'],
        'in_progress' => ['completed'],
        'completed'   => ['verified'],
        'verified'    => ['closed'],
        'closed'      => [],
    ];

    /** Ticket statuses that keep a room blocked from assignment. */
    public const BLOCKING_STATUSES = ['open', 'triaged', 'assigned', 'in_progress'];

    protected $fillable = [
        'hotel_id', 'room_id', 'ticket_number', 'category', 'priority', 'status',
        'title', 'description', 'assigned_to', 'reported_by',
        'completed_at', 'verified_by', 'verified_at',
    ];

    protected $casts = [
        'completed_at' => 'datetime',
        'verified_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::creating(function (MaintenanceTicket $ticket) {
            if (empty($ticket->ticket_number)) {
                $ticket->ticket_number = self::nextTicketNumber((int) $ticket->hotel_id);
            }
        });
    }

    public static function nextTicketNumber(int $hotelId): string
    {
        $year = now()->format('Y');
        $prefix = "MT-{$year}-";

        $last = self::withoutGlobalScopes()
            ->where('hotel_id', $hotelId)
            ->where('ticket_number', 'like', $prefix . '%')
            ->orderByDesc('ticket_number')
            ->value('ticket_number');

        $next = $last ? ((int) substr($last, -6)) + 1 : 1;

        return $prefix . str_pad((string) $next, 6, '0', STR_PAD_LEFT);
    }

    public function room()
    {
        return $this->belongsTo(Room::class);
    }

    public function assignee()
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function reporter()
    {
        return $this->belongsTo(User::class, 'reported_by');
    }

    public function verifier()
    {
        return $this->belongsTo(User::class, 'verified_by');
    }

    public function canTransitionTo(string $to): bool
    {
        return in_array($to, self::TRANSITIONS[$this->status] ?? [], true);
    }

    public function isBlocking(): bool
    {
        return in_array($this->status, self::BLOCKING_STATUSES, true);
    }
}
