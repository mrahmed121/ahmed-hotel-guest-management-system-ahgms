<?php

namespace Database\Seeders;

use App\Domains\Housekeeping\Services\MaintenanceService;
use App\Domains\Inventory\Models\Room;
use App\Domains\Shared\Models\Hotel;
use Illuminate\Database\Seeder;

class MaintenanceSeeder extends Seeder
{
    public function run(): void
    {
        $hotel = Hotel::where('code', 'AGH')->first();
        if (! $hotel) {
            return;
        }

        $room = Room::where('hotel_id', $hotel->id)->where('number', '305')->first();
        if (! $room) {
            return;
        }

        app(MaintenanceService::class)->create([
            'room_id' => $room->id,
            'category' => 'ac',
            'priority' => 'high',
            'title' => 'AC not cooling',
            'description' => 'Guest reported the air conditioner is blowing warm air.',
        ]);
    }
}
