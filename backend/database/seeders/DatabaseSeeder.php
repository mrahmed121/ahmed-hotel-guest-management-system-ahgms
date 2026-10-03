<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            HotelSeeder::class,
            RolePermissionSeeder::class,
            UserSeeder::class,
            InventorySeeder::class,
            GuestSeeder::class,
            ReservationSeeder::class,
            ServiceSeeder::class,
            HousekeepingSeeder::class,
            MaintenanceSeeder::class,
        ]);
    }
}
