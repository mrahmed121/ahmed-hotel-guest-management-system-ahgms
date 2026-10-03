<?php

namespace App\Domains\FrontDesk\Services;

use App\Domains\Folio\Models\Folio;
use App\Domains\Folio\Services\FolioService;
use App\Domains\FrontDesk\Models\Stay;

/**
 * FrontDeskBilling — folio integration for check-out.
 *
 * Backed by the real P5 FolioService: outstanding balance is read from the
 * stay's folio. Stays without a folio (should not happen — folios open on
 * check-in via OpenFolioOnCheckIn) report zero.
 */
class FrontDeskBilling
{
    public function outstandingBalance(Stay $stay): float
    {
        $folio = app(FolioService::class)->folioForStay($stay->id);

        if (! $folio) {
            return 0.0;
        }

        return app(FolioService::class)->outstandingBalance($folio->id);
    }

    public function folioModulePresent(): bool
    {
        return true;
    }

    public function folioForStay(Stay $stay): ?Folio
    {
        return app(FolioService::class)->folioForStay($stay->id);
    }
}
