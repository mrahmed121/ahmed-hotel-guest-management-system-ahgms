<?php

namespace App\Domains\Folio\Models;

use App\Domains\Shared\Models\User;
use App\Domains\Shared\Traits\BelongsToHotel;
use Illuminate\Database\Eloquent\Model;

class Payment extends Model
{
    use BelongsToHotel;

    public const METHODS = ['cash', 'card', 'bank_transfer', 'other'];

    protected $fillable = [
        'hotel_id', 'folio_id', 'receipt_number',
        'method', 'amount', 'paid_at', 'reference',
        'idempotency_key', 'received_by', 'notes',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'paid_at' => 'datetime',
    ];

    public function folio()
    {
        return $this->belongsTo(Folio::class);
    }

    public function receivedBy()
    {
        return $this->belongsTo(User::class, 'received_by');
    }
}
