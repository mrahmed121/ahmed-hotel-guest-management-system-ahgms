<?php

namespace App\Domains\Folio\Listeners;

use App\Domains\Folio\Services\FolioService;
use App\Domains\FrontDesk\Events\GuestCheckedIn;

/**
 * Open a folio automatically when a guest checks in.
 * FolioService::openForStay is idempotent, so replays are safe.
 */
class OpenFolioOnCheckIn
{
    public function __construct(private FolioService $folios) {}

    public function handle(GuestCheckedIn $event): void
    {
        $this->folios->openForStay($event->stay->id);
    }
}
