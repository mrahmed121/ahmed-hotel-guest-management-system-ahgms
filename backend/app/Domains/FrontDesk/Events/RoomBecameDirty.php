<?php

namespace App\Domains\FrontDesk\Events;

use App\Domains\Inventory\Models\Room;
use Illuminate\Foundation\Events\Dispatchable;

class RoomBecameDirty
{
    use Dispatchable;

    public function __construct(public Room $room, public ?string $reason = null) {}
}
