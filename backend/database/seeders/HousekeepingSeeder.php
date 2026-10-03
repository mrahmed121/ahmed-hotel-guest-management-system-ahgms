<?php

namespace Database\Seeders;

use App\Domains\Housekeeping\Services\HousekeepingService;
use App\Domains\Inventory\Models\Room;
use App\Domains\Shared\Models\Hotel;
use Illuminate\Database\Seeder;

class HousekeepingSeeder extends Seeder
{
    public function run(): void
    {
        $hotel = Hotel::where('code', 'AGH')->first();
        if (! $hotel) {
            return;
        }

        // Two rooms marked dirty to demonstrate the turnover queue.
        foreach (['104', '207'] as $number) {
            $room = Room::where('hotel_id', $hotel->id)->where('number', $number)->first();
            if (! $room) {
                continue;
            }

            if ($room->canTransitionTo('dirty')) {
                $room->update(['status' => 'dirty']);
            }

            app(HousekeepingService::class)->createTask($room->id, [
                'priority' => 'normal',
                'notes' => 'Seeded turnover task',
            ]);
        }
    }
}
