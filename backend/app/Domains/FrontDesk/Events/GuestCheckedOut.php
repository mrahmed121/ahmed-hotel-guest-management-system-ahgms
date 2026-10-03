<?php

namespace App\Domains\FrontDesk\Events;

use App\Domains\FrontDesk\Models\Stay;
use Illuminate\Foundation\Events\Dispatchable;

class GuestCheckedOut
{
    use Dispatchable;

    public function __construct(public Stay $stay) {}
}
