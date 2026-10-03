<?php

namespace App\Domains\Shared\Scopes;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Scope;
use Illuminate\Support\Facades\Auth;

/**
 * HotelScope — restricts queries to the authenticated user's hotel.
 * Super admins (hotel_id NULL) bypass the scope.
 */
class HotelScope implements Scope
{
    public function apply(Builder $builder, Model $model): void
    {
        $user = Auth::user();

        if (! $user) {
            return;
        }

        if (method_exists($user, 'isSuperAdmin') && $user->isSuperAdmin()) {
            return;
        }

        $builder->where($model->getTable() . '.hotel_id', $user->hotel_id);
    }
}
