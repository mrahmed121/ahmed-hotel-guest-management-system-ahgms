<?php

namespace App\Domains\Shared\Models;

use App\Domains\Shared\Traits\BelongsToHotel;
use Illuminate\Database\Eloquent\Model;

class AuditLog extends Model
{
    use BelongsToHotel;

    public $timestamps = false;

    protected $fillable = ['hotel_id', 'actor_id', 'action', 'subject_type', 'subject_id', 'context', 'created_at'];

    protected $casts = [
        'context' => 'array',
        'created_at' => 'datetime',
    ];

    public function actor()
    {
        return $this->belongsTo(User::class, 'actor_id');
    }
}
