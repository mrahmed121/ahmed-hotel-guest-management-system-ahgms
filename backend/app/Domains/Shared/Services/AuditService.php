<?php

namespace App\Domains\Shared\Services;

use App\Domains\Shared\Models\AuditLog;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;

/**
 * AuditService — append-only audit trail for all mutations.
 */
class AuditService
{
    public function log(string $action, ?Model $subject = null, array $context = []): AuditLog
    {
        $user = Auth::user();

        return AuditLog::withoutGlobalScopes()->create([
            'hotel_id' => $user?->hotel_id ?? $subject?->getAttribute('hotel_id'),
            'actor_id' => $user?->id,
            'action' => $action,
            'subject_type' => $subject ? get_class($subject) : null,
            'subject_id' => $subject?->getKey(),
            'context' => $context ?: null,
            'created_at' => now(),
        ]);
    }
}
