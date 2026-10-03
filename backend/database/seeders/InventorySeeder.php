<?php

namespace Database\Seeders;

use App\Domains\Inventory\Models\Amenity;
use App\Domains\Inventory\Models\Floor;
use App\Domains\Inventory\Models\RatePlan;
use App\Domains\Inventory\Models\Room;
use App\Domains\Inventory\Models\RoomType;
use App\Domains\Shared\Models\Hotel;
use Illuminate\Database\Seeder;

class InventorySeeder extends Seeder
{
    public function run(): void
    {
        $hotel = Hotel::where('code', 'AGH')->firstOrFail();
        $hid = $hotel->id;

        // Floors
        $floors = [];
        foreach ([1 => 'Ground Floor', 2 => 'First Floor', 3 => 'Second Floor'] as $number => $name) {
            $floors[$number] = Floor::firstOrCreate(
                ['hotel_id' => $hid, 'number' => $number],
                ['name' => $name]
            );
        }

        // Room types (PKR nightly base rates)
        $types = [];
        foreach ([
            ['Standard', 'STD', 8000, 2, 'Comfortable standard room with city view.'],
            ['Deluxe', 'DLX', 12000, 3, 'Spacious deluxe room with balcony.'],
            ['Family', 'FAM', 15000, 4, 'Large family room with two beds.'],
            ['Suite', 'STE', 25000, 3, 'Executive suite with living area.'],
        ] as [$name, $code, $rate, $occ, $desc]) {
            $types[$code] = RoomType::firstOrCreate(
                ['hotel_id' => $hid, 'code' => $code],
                [
                    'name' => $name, 'description' => $desc,
                    'base_rate' => $rate, 'max_occupancy' => $occ,
                    'is_active' => true,
                ]
            );
        }

        // Amenities
        foreach ([
            ['Free WiFi', 'wifi'], ['Air Conditioning', 'ac'], ['LED TV', 'tv'],
            ['Mini Bar', 'minibar'], ['Room Service', 'bell'], ['Parking', 'parking'],
            ['Swimming Pool', 'pool'], ['Gym', 'gym'],
        ] as [$name, $icon]) {
            Amenity::firstOrCreate(['hotel_id' => $hid, 'name' => $name], ['icon' => $icon]);
        }

        // Link a few amenities onto room types
        $types['STD']->update(['amenities' => ['Free WiFi', 'Air Conditioning', 'LED TV']]);
        $types['DLX']->update(['amenities' => ['Free WiFi', 'Air Conditioning', 'LED TV', 'Mini Bar', 'Room Service']]);
        $types['FAM']->update(['amenities' => ['Free WiFi', 'Air Conditioning', 'LED TV', 'Room Service', 'Parking']]);
        $types['STE']->update(['amenities' => ['Free WiFi', 'Air Conditioning', 'LED TV', 'Mini Bar', 'Room Service', 'Parking', 'Swimming Pool', 'Gym']]);

        // 24 rooms: floor 1 → 101-106, floor 2 → 201-208, floor 3 → 301-310
        $plan = [
            1 => ['STD', 'STD', 'DLX', 'DLX', 'FAM', 'FAM'],
            2 => ['STD', 'STD', 'STD', 'DLX', 'DLX', 'FAM', 'FAM', 'STE'],
            3 => ['STD', 'STD', 'DLX', 'DLX', 'DLX', 'FAM', 'STE', 'STE', 'STE', 'STE'],
        ];
        foreach ($plan as $floorNo => $codes) {
            $i = 1;
            foreach ($codes as $code) {
                $number = $floorNo * 100 + $i;
                Room::firstOrCreate(
                    ['hotel_id' => $hid, 'number' => (string) $number],
                    [
                        'floor_id' => $floors[$floorNo]->id,
                        'room_type_id' => $types[$code]->id,
                        'status' => 'available',
                    ]
                );
                $i++;
            }
        }

        // Rate plans
        RatePlan::firstOrCreate(
            ['hotel_id' => $hid, 'room_type_id' => $types['STD']->id, 'name' => 'Standard Rack 2026'],
            [
                'base_rate' => 8000, 'valid_from' => '2026-01-01', 'valid_to' => '2026-12-31',
                'tax_percent' => 0, 'service_charge_percent' => 5, 'min_stay' => 1, 'is_active' => true,
            ]
        );
        RatePlan::firstOrCreate(
            ['hotel_id' => $hid, 'room_type_id' => $types['STE']->id, 'name' => 'Suite Seasonal 2026'],
            [
                'base_rate' => 25000, 'valid_from' => '2026-01-01', 'valid_to' => '2026-12-31',
                'tax_percent' => 0, 'service_charge_percent' => 5, 'min_stay' => 1, 'is_active' => true,
            ]
        );
    }
}
