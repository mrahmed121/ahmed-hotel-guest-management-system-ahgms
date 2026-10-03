<?php

namespace App\Domains\Housekeeping\Listeners;

use App\Domains\FrontDesk\Events\RoomBecameDirty;
use App\Domains\Housekeeping\Services\HousekeepingService;

/**
 * Auto-create a housekeeping turnover task whenever a room becomes dirty
 * (e.g. after checkout). HousekeepingService::createTask is idempotent —
 * at most one open task per room, so replays are safe.
 */
class CreateHousekeepingTaskOnRoomDirty
{
    public function __construct(private HousekeepingService $housekeeping) {}

    public function handle(RoomBecameDirty $event): void
    {
        $this->housekeeping->createTask($event->room->id, [
            'notes' => $event->reason ? "Auto-created: {$event->reason}" : 'Auto-created on room dirty',
        ]);
    }
}
