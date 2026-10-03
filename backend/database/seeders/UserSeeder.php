<?php

namespace Database\Seeders;

use App\Domains\Shared\Models\Hotel;
use App\Domains\Shared\Models\Role;
use App\Domains\Shared\Models\User;
use Illuminate\Database\Seeder;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        $hotel = Hotel::where('code', 'AGH')->firstOrFail();
        $roleId = fn (string $slug) => Role::where('slug', $slug)->firstOrFail()->id;

        $users = [
            ['Super Admin', 'super@ahgms.local', 'super_admin', null],
            ['Hotel Admin', 'admin@ahmedgrand.local', 'hotel_admin', $hotel->id],
            ['Front Desk Manager', 'frontdesk@ahmedgrand.local', 'front_desk_manager', $hotel->id],
            ['Receptionist', 'reception@ahmedgrand.local', 'receptionist', $hotel->id],
            ['Accountant', 'accounts@ahmedgrand.local', 'accountant', $hotel->id],
            ['Housekeeping Supervisor', 'hk.super@ahmedgrand.local', 'housekeeping_supervisor', $hotel->id],
            ['Housekeeper', 'hk@ahmedgrand.local', 'housekeeper', $hotel->id],
            ['Operations Manager', 'ops@ahmedgrand.local', 'operations_manager', $hotel->id],
            ['Auditor', 'audit@ahmedgrand.local', 'auditor', $hotel->id],
        ];

        foreach ($users as [$name, $email, $roleSlug, $hotelId]) {
            User::firstOrCreate(
                ['email' => $email],
                [
                    'name' => $name,
                    'password' => 'password123',
                    'role_id' => $roleId($roleSlug),
                    'hotel_id' => $hotelId,
                    'is_active' => true,
                ]
            );
        }
    }
}
