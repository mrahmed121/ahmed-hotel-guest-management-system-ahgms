<?php

namespace App\Domains\Reservations\Services;

use App\Domains\Inventory\Models\RatePlan;
use App\Domains\Inventory\Models\Room;
use App\Domains\Reservations\Models\Reservation;
use Illuminate\Validation\ValidationException;

class AvailabilityService
{
    /**
     * Find rooms available for the FULL date range.
     *
     * A room is unavailable when:
     *  - its status is maintenance / out_of_service / occupied / dirty /
     *    cleaning / inspection (only available / reserved / ready are bookable), or
     *  - any ACTIVE reservation overlaps the range for that room.
     *
     * Same-day turnover is allowed: a reservation checking out on $checkIn
     * does not overlap (overlap rule is strictly < / >, not <= / >=).
     *
     * Returns rooms with room_type and the applicable nightly rate.
     */
    public function search(int $hotelId, string $checkIn, string $checkOut, ?int $roomTypeId = null, ?int $adults = null): array
    {
        if ($checkOut <= $checkIn) {
            throw ValidationException::withMessages([
                'check_out' => ['Check-out date must be after check-in date.'],
            ]);
        }

        $query = Room::withoutGlobalScopes()
            ->where('hotel_id', $hotelId)
            ->whereIn('status', ['available', 'reserved', 'ready'])
            ->with('roomType')
            ->orderBy('number');

        if ($roomTypeId !== null) {
            $query->where('room_type_id', $roomTypeId);
        }
        if ($adults !== null) {
            $query->whereHas('roomType', fn ($q) => $q->where('max_occupancy', '>=', $adults));
        }

        $rooms = $query->get()->filter(function (Room $room) use ($checkIn, $checkOut) {
            return ! Reservation::overlaps($room->id, $checkIn, $checkOut)->exists();
        })->values();

        $nights = (int) (new \DateTime($checkIn))->diff(new \DateTime($checkOut))->days;

        return [
            'check_in' => $checkIn,
            'check_out' => $checkOut,
            'nights' => $nights,
            'rooms' => $rooms->map(function (Room $room) use ($checkIn, $hotelId) {
                $rate = $this->nightlyRateFor($room, $hotelId, $checkIn);
                return [
                    'id' => $room->id,
                    'number' => $room->number,
                    'status' => $room->status,
                    'room_type' => [
                        'id' => $room->roomType->id,
                        'name' => $room->roomType->name,
                        'code' => $room->roomType->code,
                        'max_occupancy' => $room->roomType->max_occupancy,
                    ],
                    'nightly_rate' => $rate['nightly_rate'],
                    'rate_plan_id' => $rate['rate_plan_id'],
                ];
            })->values(),
        ];
    }

    /**
     * Resolve the applicable nightly rate: active rate plan covering the
     * check-in date wins, otherwise the room type base rate.
     */
    private function nightlyRateFor(Room $room, int $hotelId, string $checkIn): array
    {
        $plan = RatePlan::withoutGlobalScopes()
            ->where('hotel_id', $hotelId)
            ->where('room_type_id', $room->room_type_id)
            ->where('is_active', true)
            ->where('valid_from', '<=', $checkIn)
            ->where(function ($q) use ($checkIn) {
                $q->whereNull('valid_to')->orWhere('valid_to', '>=', $checkIn);
            })
            ->orderBy('base_rate')
            ->first();

        if ($plan) {
            return [
                'nightly_rate' => number_format((float) $plan->base_rate, 2, '.', ''),
                'rate_plan_id' => $plan->id,
            ];
        }

        return [
            'nightly_rate' => number_format((float) $room->roomType->base_rate, 2, '.', ''),
            'rate_plan_id' => null,
        ];
    }
}
