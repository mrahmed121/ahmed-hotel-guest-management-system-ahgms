<?php

namespace Database\Seeders;

use App\Domains\Guests\Models\Guest;
use App\Domains\Shared\Models\Hotel;
use Illuminate\Database\Seeder;

class GuestSeeder extends Seeder
{
    public function run(): void
    {
        $hotel = Hotel::where('code', 'AGH')->firstOrFail();
        $hid = $hotel->id;

        $guests = [
            ['Ahmed', 'Khan', 'ahmed.khan@example.com', '+92-300-1111111', 'Pakistan', 'cnic', '35202-1234567-1', 'VIP corporate guest', true],
            ['Fatima', 'Ali', 'fatima.ali@example.com', '+92-300-2222222', 'Pakistan', 'cnic', '35202-2345678-2', null, false],
            ['John', 'Smith', 'john.smith@example.com', '+1-555-0101', 'USA', 'passport', 'US12345678', 'Prefers high floor', false],
            ['Ayesha', 'Raza', 'ayesha.raza@example.com', '+92-300-3333333', 'Pakistan', 'passport', 'PK98765432', null, false],
            ['Omar', 'Farooq', 'omar.farooq@example.com', '+92-300-4444444', 'Pakistan', 'driving_license', 'DL-998877', null, false],
            ['Sara', 'Mahmood', 'sara.mahmood@example.com', '+92-300-5555555', 'Pakistan', 'cnic', '35202-3456789-3', 'Allergic to feather pillows', false],
            ['David', 'Chen', 'david.chen@example.com', '+86-138-0000-1111', 'China', 'passport', 'CN11223344', null, false],
            ['Hina', 'Shahid', 'hina.shahid@example.com', '+92-300-6666666', 'Pakistan', 'other', 'EMP-4455', 'Blacklisted: chargeback dispute', false],
        ];

        foreach ($guests as $i => [$first, $last, $email, $phone, $country, $idType, $idNumber, $notes, $vip]) {
            $guest = Guest::firstOrCreate(
                ['hotel_id' => $hid, 'phone' => $phone],
                [
                    'first_name' => $first,
                    'last_name' => $last,
                    'email' => $email,
                    'country' => $country,
                    'id_type' => $idType,
                    'id_number' => $idNumber,
                    'address' => 'Demo address ' . ($i + 1),
                    'notes' => $notes,
                    'vip' => $vip,
                    'status' => $i === 7 ? 'blacklisted' : 'active',
                ]
            );
        }
    }
}
