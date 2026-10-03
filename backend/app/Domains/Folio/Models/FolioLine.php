<?php

namespace App\Domains\Folio\Models;

use App\Domains\Shared\Models\User;
use Illuminate\Database\Eloquent\Model;

/**
 * FolioLine — append-only. Posted lines are never updated or deleted;
 * corrections are made with new adjustment/discount lines.
 */
class FolioLine extends Model
{
    public const TYPES = ['room', 'service', 'tax', 'fee', 'adjustment', 'discount'];

    /** Line types that count as charges (vs. discounts). */
    public const CHARGE_TYPES = ['room', 'service', 'tax', 'fee'];

    protected $fillable = [
        'folio_id', 'line_type', 'description',
        'quantity', 'unit_price', 'amount',
        'service_date', 'ref_type', 'ref_id', 'created_by',
    ];

    protected $casts = [
        'quantity' => 'decimal:2',
        'unit_price' => 'decimal:2',
        'amount' => 'decimal:2',
        'service_date' => 'date',
    ];

    public function folio()
    {
        return $this->belongsTo(Folio::class);
    }

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function isDiscount(): bool
    {
        return $this->line_type === 'discount';
    }
}
