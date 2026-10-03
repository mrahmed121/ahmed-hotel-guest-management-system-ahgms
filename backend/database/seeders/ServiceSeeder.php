<?php

namespace Database\Seeders;

use App\Domains\Housekeeping\Models\Service;
use App\Domains\Shared\Models\Hotel;
use Illuminate\Database\Seeder;

class ServiceSeeder extends Seeder
{
    public function run(): void
    {
        $hotel = Hotel::where('code', 'AGH')->first();
        if (! $hotel) {
            return;
        }

        $services = [
            ['name' => 'Breakfast', 'code' => 'BRKFST', 'description' => 'Continental breakfast buffet', 'unit_price' => 1500],
            ['name' => 'Laundry', 'code' => 'LNDRY', 'description' => 'Wash and fold laundry service', 'unit_price' => 800],
            ['name' => 'Airport Transfer', 'code' => 'AIRPRT', 'description' => 'One-way airport transfer', 'unit_price' => 3000],
            ['name' => 'Extra Bed', 'code' => 'XTRBED', 'description' => 'Extra bed per night', 'unit_price' => 2000],
            ['name' => 'Parking', 'code' => 'PRKING', 'description' => 'Secure parking per night', 'unit_price' => 500],
        ];

        foreach ($services as $svc) {
            Service::firstOrCreate(
                ['hotel_id' => $hotel->id, 'code' => $svc['code']],
                $svc + ['taxable' => false, 'active' => true]
            );
        }
    }
}
