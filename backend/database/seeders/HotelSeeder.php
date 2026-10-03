<?php

namespace Database\Seeders;

use App\Domains\Shared\Models\Hotel;
use Illuminate\Database\Seeder;

class HotelSeeder extends Seeder
{
    public function run(): void
    {
        Hotel::firstOrCreate(
            ['code' => 'AGH'],
            [
                'name' => 'Ahmed Grand Hotel',
                'address' => '123 Main Boulevard, Lahore, Pakistan',
                'phone' => '+92-42-35710000',
                'email' => 'info@ahmedgrand.local',
                'settings' => [
                    'currency' => 'PKR',
                    'tax_percent' => 0,
                    'service_charge_percent' => 0,
                    'check_in_time' => '14:00',
                    'check_out_time' => '12:00',
                ],
            ]
        );
    }
}
