<?php

namespace App\Domains\Shared\Models;

use Illuminate\Database\Eloquent\Model;

class Permission extends Model
{
    protected $fillable = ['slug', 'name', 'group'];

    public function roles()
    {
        return $this->belongsToMany(Role::class, 'permission_role');
    }
}
