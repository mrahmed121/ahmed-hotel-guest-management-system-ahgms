<?php

namespace App\Http\Controllers\Api\V1;

use App\Domains\Shared\Models\AuditLog;

class AuditLogController
{
    public function index()
    {
        $logs = AuditLog::with('actor:id,name')
            ->orderByDesc('created_at')
            ->paginate(25);
        return response()->json($logs);
    }
}
