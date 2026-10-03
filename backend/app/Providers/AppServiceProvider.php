<?php

namespace App\Providers;

use App\Domains\Folio\Listeners\OpenFolioOnCheckIn;
use App\Domains\FrontDesk\Events\GuestCheckedIn;
use App\Domains\FrontDesk\Events\RoomBecameDirty;
use App\Domains\Housekeeping\Listeners\CreateHousekeepingTaskOnRoomDirty;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Event::listen(GuestCheckedIn::class, OpenFolioOnCheckIn::class);
        Event::listen(RoomBecameDirty::class, CreateHousekeepingTaskOnRoomDirty::class);
    }
}
