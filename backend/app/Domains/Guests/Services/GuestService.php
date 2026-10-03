<?php

namespace App\Domains\Guests\Services;

use App\Domains\Guests\Models\Guest;
use App\Domains\Shared\Services\AuditService;
use Illuminate\Validation\ValidationException;

class GuestService
{
    public function __construct(private AuditService $audit) {}

    public function create(array $data): Guest
    {
        $duplicate = Guest::where('phone', $data['phone'])->first();
        $guest = Guest::create($data);
        $this->audit->log('guest.created', $guest, [
            'name' => $guest->full_name,
            'duplicate_phone_warning' => (bool) $duplicate,
        ]);

        return $guest;
    }

    public function update(Guest $guest, array $data): Guest
    {
        $guest->update($data);
        $this->audit->log('guest.updated', $guest, ['name' => $guest->full_name]);

        return $guest->fresh();
    }

    public function blacklist(Guest $guest, ?string $reason = null): Guest
    {
        if ($guest->status === 'blacklisted') {
            throw ValidationException::withMessages([
                'guest' => ['Guest is already blacklisted.'],
            ]);
        }
        $guest->update(['status' => 'blacklisted']);
        $this->audit->log('guest.blacklisted', $guest, [
            'name' => $guest->full_name, 'reason' => $reason,
        ]);

        return $guest->fresh();
    }

    public function unblacklist(Guest $guest): Guest
    {
        if ($guest->status !== 'blacklisted') {
            throw ValidationException::withMessages([
                'guest' => ['Guest is not blacklisted.'],
            ]);
        }
        $guest->update(['status' => 'active']);
        $this->audit->log('guest.unblacklisted', $guest, ['name' => $guest->full_name]);

        return $guest->fresh();
    }

    public function delete(Guest $guest): void
    {
        if ($guest->reservations()->exists()) {
            throw ValidationException::withMessages([
                'guest' => ['Cannot delete a guest with reservations. Blacklist instead.'],
            ]);
        }
        $this->audit->log('guest.deleted', $guest, ['name' => $guest->full_name]);
        $guest->delete();
    }
}
