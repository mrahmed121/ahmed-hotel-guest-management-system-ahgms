<?php

namespace App\Domains\Housekeeping\Services;

use App\Domains\Housekeeping\Models\MaintenanceTicket;
use App\Domains\Inventory\Models\Room;
use App\Domains\Inventory\Services\RoomService;
use App\Domains\Shared\Models\User;
use App\Domains\Shared\Services\AuditService;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * MaintenanceService — hotel maintenance tickets.
 *
 * Lifecycle: open → triaged → assigned → in_progress → completed
 *            → verified → closed.
 *
 * Room interplay:
 * - On ticket creation the room moves to 'maintenance' when the room's
 *   own state machine allows it (occupied rooms stay occupied — work is
 *   scheduled around the guest).
 * - Rooms in 'maintenance' / 'out_of_service' are never assignable
 *   (Room::isAssignable() already enforces this for P2/P3).
 * - When a ticket is verified/closed and no other blocking ticket exists
 *   for the room, the room moves to 'dirty' so housekeeping turns it over
 *   before it becomes available again.
 */
class MaintenanceService
{
    public function __construct(
        private AuditService $audit,
        private RoomService $rooms,
    ) {}

    public function create(array $data): MaintenanceTicket
    {
        return DB::transaction(function () use ($data) {
            $room = null;
            if (! empty($data['room_id'])) {
                $room = Room::findOrFail($data['room_id']);
            }

            $ticket = MaintenanceTicket::create([
                'hotel_id' => $room?->hotel_id,
                'room_id' => $room?->id,
                'category' => $data['category'] ?? 'other',
                'priority' => $data['priority'] ?? 'normal',
                'status' => 'open',
                'title' => $data['title'],
                'description' => $data['description'] ?? null,
                'reported_by' => Auth::id(),
            ]);

            if ($room && $room->canTransitionTo('maintenance')) {
                $this->rooms->setStatus($room, 'maintenance', "Ticket {$ticket->ticket_number} opened");
            }

            $this->audit->log('maintenance.ticket_created', $ticket, [
                'ticket_number' => $ticket->ticket_number,
                'room' => $room?->number,
            ]);

            return $ticket->fresh();
        });
    }

    public function update(MaintenanceTicket $ticket, array $data): MaintenanceTicket
    {
        if (isset($data['room_id'])) {
            $room = Room::findOrFail($data['room_id']);
            $data['hotel_id'] = $room->hotel_id;
        }

        $ticket->update($data);
        $this->audit->log('maintenance.ticket_updated', $ticket, [
            'ticket_number' => $ticket->ticket_number,
        ]);

        return $ticket->fresh();
    }

    public function transition(int $ticketId, string $to): MaintenanceTicket
    {
        return DB::transaction(function () use ($ticketId, $to) {
            $ticket = MaintenanceTicket::lockForUpdate()->findOrFail($ticketId);

            if (! $ticket->canTransitionTo($to)) {
                throw ValidationException::withMessages([
                    'status' => ["Illegal ticket transition: {$ticket->status} → {$to}."],
                ]);
            }

            $updates = ['status' => $to];
            if ($to === 'completed') {
                $updates['completed_at'] = now();
            }
            if ($to === 'verified') {
                $updates['verified_by'] = Auth::id();
                $updates['verified_at'] = now();
            }

            $ticket->update($updates);
            $this->audit->log('maintenance.ticket_transition', $ticket, [
                'ticket_number' => $ticket->ticket_number, 'to' => $to,
            ]);

            if (in_array($to, ['verified', 'closed'], true)) {
                $this->releaseRoomIfClear($ticket->fresh());
            }

            return $ticket->fresh();
        });
    }

    /** assigned via transition; convenience wrapper that also sets assignee. */
    public function assign(int $ticketId, int $userId): MaintenanceTicket
    {
        $ticket = MaintenanceTicket::findOrFail($ticketId);
        User::findOrFail($userId);

        if ($ticket->status === 'open') {
            $this->transition($ticketId, 'triaged');
            $ticket = $ticket->fresh();
        }
        if ($ticket->status === 'triaged') {
            $this->transition($ticketId, 'assigned');
            $ticket = $ticket->fresh();
        }
        if ($ticket->status !== 'assigned') {
            throw ValidationException::withMessages([
                'status' => ["Ticket {$ticket->ticket_number} cannot be assigned from status '{$ticket->status}'."],
            ]);
        }

        $ticket->update(['assigned_to' => $userId]);
        $this->audit->log('maintenance.ticket_assigned', $ticket, [
            'ticket_number' => $ticket->ticket_number, 'assignee_id' => $userId,
        ]);

        return $ticket->fresh();
    }

    public function list(array $filters = [])
    {
        $query = MaintenanceTicket::with(['room', 'assignee'])->orderByDesc('created_at');

        if (! empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }
        if (! empty($filters['category'])) {
            $query->where('category', $filters['category']);
        }
        if (! empty($filters['room_id'])) {
            $query->where('room_id', $filters['room_id']);
        }

        return $query->paginate($filters['per_page'] ?? 15);
    }

    /**
     * After verify/close: if the room has no other blocking tickets and is
     * still in 'maintenance', send it to 'dirty' for housekeeping turnover.
     * Rooms in 'out_of_service' need a manual decision — left untouched.
     */
    protected function releaseRoomIfClear(MaintenanceTicket $ticket): void
    {
        $room = $ticket->room;
        if (! $room || $room->status !== 'maintenance') {
            return;
        }

        $stillBlocking = MaintenanceTicket::where('room_id', $room->id)
            ->where('id', '!=', $ticket->id)
            ->whereIn('status', MaintenanceTicket::BLOCKING_STATUSES)
            ->exists();

        if (! $stillBlocking && $room->canTransitionTo('dirty')) {
            $this->rooms->setStatus($room, 'dirty', "Ticket {$ticket->ticket_number} {$ticket->status} — needs cleaning");
        }
    }
}
