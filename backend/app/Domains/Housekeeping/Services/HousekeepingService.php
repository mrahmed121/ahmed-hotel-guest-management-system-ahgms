<?php

namespace App\Domains\Housekeeping\Services;

use App\Domains\Housekeeping\Models\HousekeepingTask;
use App\Domains\Inventory\Models\Room;
use App\Domains\Inventory\Services\RoomService;
use App\Domains\Shared\Models\User;
use App\Domains\Shared\Services\AuditService;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * HousekeepingService — room turnover workflow.
 *
 * Task lifecycle: dirty → assigned → cleaning → inspection → ready.
 * Room status is synced alongside: dirty / cleaning / inspection / ready.
 * A room becomes AVAILABLE only when front-desk (or an explicit action)
 * moves it ready → available; this service never marks rooms available.
 */
class HousekeepingService
{
    public function __construct(
        private AuditService $audit,
        private RoomService $rooms,
    ) {}

    /**
     * Create a turnover task for a room. Idempotent: at most one OPEN
     * task per room — returns the existing one if present.
     */
    public function createTask(int $roomId, array $data = []): HousekeepingTask
    {
        return DB::transaction(function () use ($roomId, $data) {
            $room = Room::lockForUpdate()->findOrFail($roomId);

            $existing = HousekeepingTask::where('room_id', $room->id)
                ->whereIn('status', HousekeepingTask::OPEN_STATUSES)
                ->lockForUpdate()
                ->first();

            if ($existing) {
                return $existing;
            }

            $task = HousekeepingTask::create([
                'hotel_id' => $room->hotel_id,
                'room_id' => $room->id,
                'status' => 'dirty',
                'priority' => $data['priority'] ?? 'normal',
                'notes' => $data['notes'] ?? null,
            ]);

            // Room is dirty now (no-op if already dirty — checkout set it).
            if ($room->status !== 'dirty' && $room->canTransitionTo('dirty')) {
                $this->rooms->setStatus($room, 'dirty', 'Housekeeping task created');
            }

            $this->audit->log('housekeeping.task_created', $task, [
                'room' => $room->number, 'task_id' => $task->id,
            ]);

            return $task->fresh();
        });
    }

    /** dirty → assigned. Assignee must be a housekeeper or supervisor. */
    public function assign(int $taskId, int $userId): HousekeepingTask
    {
        return DB::transaction(function () use ($taskId, $userId) {
            $task = HousekeepingTask::lockForUpdate()->findOrFail($taskId);
            $this->assertTransition($task, 'assigned');

            $user = User::findOrFail($userId);
            $role = $user->role?->slug;
            if (! in_array($role, ['housekeeper', 'housekeeping_supervisor'], true)) {
                throw ValidationException::withMessages([
                    'assigned_to' => ['Only housekeepers or housekeeping supervisors can be assigned cleaning tasks.'],
                ]);
            }

            $task->update(['status' => 'assigned', 'assigned_to' => $user->id]);
            $this->audit->log('housekeeping.task_assigned', $task, [
                'task_id' => $task->id, 'assignee' => $user->name,
            ]);

            return $task->fresh();
        });
    }

    /** assigned → cleaning. */
    public function startCleaning(int $taskId): HousekeepingTask
    {
        return DB::transaction(function () use ($taskId) {
            $task = HousekeepingTask::lockForUpdate()->findOrFail($taskId);
            $this->assertTransition($task, 'cleaning');

            $task->update(['status' => 'cleaning', 'started_at' => now()]);

            $room = $task->room;
            if ($room->status !== 'cleaning' && $room->canTransitionTo('cleaning')) {
                $this->rooms->setStatus($room, 'cleaning', 'Cleaning started');
            }

            $this->audit->log('housekeeping.cleaning_started', $task, ['task_id' => $task->id]);

            return $task->fresh();
        });
    }

    /** cleaning → inspection. */
    public function complete(int $taskId): HousekeepingTask
    {
        return DB::transaction(function () use ($taskId) {
            $task = HousekeepingTask::lockForUpdate()->findOrFail($taskId);
            $this->assertTransition($task, 'inspection');

            $task->update(['status' => 'inspection', 'completed_at' => now()]);

            $room = $task->room;
            if ($room->status !== 'inspection' && $room->canTransitionTo('inspection')) {
                $this->rooms->setStatus($room, 'inspection', 'Cleaning completed, awaiting inspection');
            }

            $this->audit->log('housekeeping.cleaning_completed', $task, ['task_id' => $task->id]);

            return $task->fresh();
        });
    }

    /**
     * inspection → ready (passed) or → cleaning (failed, rework).
     * On pass the room moves to 'ready' — front-desk then makes it 'available'.
     */
    public function inspect(int $taskId, bool $passed, ?string $notes = null): HousekeepingTask
    {
        return DB::transaction(function () use ($taskId, $passed, $notes) {
            $task = HousekeepingTask::lockForUpdate()->findOrFail($taskId);
            $target = $passed ? 'ready' : 'cleaning';
            $this->assertTransition($task, $target);

            $task->update([
                'status' => $target,
                'inspected_by' => Auth::id(),
                'inspected_at' => now(),
                'notes' => $notes ?? $task->notes,
            ]);

            $room = $task->room;
            if ($room->canTransitionTo($target)) {
                $this->rooms->setStatus(
                    $room,
                    $target,
                    $passed ? 'Inspection passed — room ready' : 'Inspection failed — rework required'
                );
            }

            $this->audit->log('housekeeping.inspected', $task, [
                'task_id' => $task->id, 'passed' => $passed,
            ]);

            return $task->fresh();
        });
    }

    public function list(array $filters = [])
    {
        $query = HousekeepingTask::with(['room', 'assignee'])->orderByDesc('created_at');

        if (! empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }
        if (! empty($filters['room_id'])) {
            $query->where('room_id', $filters['room_id']);
        }
        if (! empty($filters['assigned_to'])) {
            $query->where('assigned_to', $filters['assigned_to']);
        }

        return $query->paginate($filters['per_page'] ?? 15);
    }

    protected function assertTransition(HousekeepingTask $task, string $to): void
    {
        if (! $task->canTransitionTo($to)) {
            throw ValidationException::withMessages([
                'status' => ["Illegal task transition: {$task->status} → {$to}."],
            ]);
        }
    }
}
