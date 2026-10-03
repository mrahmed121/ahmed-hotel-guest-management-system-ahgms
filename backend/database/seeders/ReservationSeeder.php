<?php

namespace Database\Seeders;

use App\Domains\Guests\Models\Guest;
use App\Domains\Inventory\Models\Room;
use App\Domains\Inventory\Models\RoomType;
use App\Domains\Reservations\Models\Reservation;
use App\Domains\Shared\Models\Hotel;
use Illuminate\Database\Seeder;

class ReservationSeeder extends Seeder
{
    public function run(): void
    {
        $hotel = Hotel::where('code', 'AGH')->firstOrFail();
        $hid = $hotel->id;

        $guests = Guest::where('hotel_id', $hid)->orderBy('id')->get();
        if ($guests->count() < 6) {
            return; // Guests not seeded yet.
        }

        $roomByNumber = fn (string $number) => Room::where('hotel_id', $hid)
            ->where('number', $number)->firstOrFail();
        $typeByCode = fn (string $code) => RoomType::where('hotel_id', $hid)
            ->where('code', $code)->firstOrFail();

        $reservations = [
            // 2 confirmed future
            [
                'guest' => $guests[0], 'room' => '101', 'type' => 'STD',
                'status' => 'confirmed', 'check_in' => '2026-10-10', 'check_out' => '2026-10-13',
                'rate' => 8000, 'source' => 'direct',
            ],
            [
                'guest' => $guests[1], 'room' => '201', 'type' => 'DLX',
                'status' => 'confirmed', 'check_in' => '2026-10-15', 'check_out' => '2026-10-17',
                'rate' => 12000, 'source' => 'online',
            ],
            // 1 checked_in (in-house, for P4 demo)
            [
                'guest' => $guests[2], 'room' => '301', 'type' => 'STE',
                'status' => 'checked_in', 'check_in' => '2026-10-01', 'check_out' => '2026-10-05',
                'rate' => 25000, 'source' => 'agent',
            ],
            // 2 checked_out past
            [
                'guest' => $guests[3], 'room' => '102', 'type' => 'STD',
                'status' => 'checked_out', 'check_in' => '2026-09-20', 'check_out' => '2026-09-23',
                'rate' => 8000, 'source' => 'phone',
            ],
            [
                'guest' => $guests[4], 'room' => '202', 'type' => 'DLX',
                'status' => 'checked_out', 'check_in' => '2026-09-25', 'check_out' => '2026-09-28',
                'rate' => 12000, 'source' => 'direct',
            ],
            // 1 cancelled
            [
                'guest' => $guests[5], 'room' => '302', 'type' => 'FAM',
                'status' => 'cancelled', 'check_in' => '2026-10-20', 'check_out' => '2026-10-22',
                'rate' => 15000, 'source' => 'online',
            ],
        ];

        $counter = 1;
        foreach ($reservations as $r) {
            $room = $roomByNumber($r['room']);
            $nights = (int) (new \DateTime($r['check_in']))->diff(new \DateTime($r['check_out']))->days;

            $reservation = Reservation::firstOrCreate(
                [
                    'hotel_id' => $hid,
                    'confirmation_code' => sprintf('RSV-2026-%06d', $counter),
                ],
                [
                    'guest_id' => $r['guest']->id,
                    'room_id' => $room->id,
                    'room_type_id' => $typeByCode($r['type'])->id,
                    'status' => $r['status'],
                    'check_in' => $r['check_in'],
                    'check_out' => $r['check_out'],
                    'adults' => 2,
                    'children' => 0,
                    'nightly_rate' => $r['rate'],
                    'total_estimate' => round($r['rate'] * $nights, 2),
                    'source' => $r['source'],
                    'cancelled_at' => $r['status'] === 'cancelled' ? now()->subDays(2) : null,
                    'cancellation_reason' => $r['status'] === 'cancelled' ? 'Guest request' : null,
                    'checked_in_at' => in_array($r['status'], ['checked_in', 'checked_out'], true)
                        ? $r['check_in'] . ' 14:00:00' : null,
                    'checked_out_at' => $r['status'] === 'checked_out'
                        ? $r['check_out'] . ' 11:00:00' : null,
                ]
            );
            $counter++;

            // Keep room status consistent with the reservation.
            if ($r['status'] === 'checked_in') {
                $room->update(['status' => 'occupied']);
            } elseif (in_array($r['status'], ['reserved', 'confirmed'], true)) {
                if ($room->status === 'available') {
                    $room->update(['status' => 'reserved']);
                }
            }
        }
    }
}
