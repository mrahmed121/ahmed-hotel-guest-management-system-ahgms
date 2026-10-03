<?php

namespace App\Domains\Folio\Models;

use App\Domains\Shared\Models\User;
use Illuminate\Database\Eloquent\Model;

/**
 * FolioAdjustment — audited adjustment record. Each adjustment also creates a
 * corresponding FolioLine (line_type adjustment/discount) so the folio stays
 * a complete append-only ledger.
 */
class FolioAdjustment extends Model
{
    public const TYPES = ['discount', 'additional_charge', 'correction'];

    protected $fillable = [
        'folio_id', 'type', 'amount', 'reason',
        'created_by', 'approved_by',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
    ];

    public function folio()
    {
        return $this->belongsTo(Folio::class);
    }

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function approvedBy()
    {
        return $this->belongsTo(User::class, 'approved_by');
    }
}
