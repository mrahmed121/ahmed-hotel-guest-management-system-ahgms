<?php

namespace App\Http\Controllers\Api\V1;

use App\Domains\Housekeeping\Models\MaintenanceTicket;
use App\Domains\Housekeeping\Services\MaintenanceService;
use App\Http\Requests\Api\V1\StoreMaintenanceTicketRequest;
use Illuminate\Http\Request;

class MaintenanceTicketController
{
    public function index(Request $request, MaintenanceService $service)
    {
        return response()->json($service->list($request->only(['status', 'category', 'room_id', 'per_page'])));
    }

    public function store(StoreMaintenanceTicketRequest $request, MaintenanceService $service)
    {
        return response()->json(['data' => $service->create($request->validated())], 201);
    }

    public function show(MaintenanceTicket $maintenanceTicket)
    {
        return response()->json(['data' => $maintenanceTicket->load(['room', 'assignee', 'reporter', 'verifier'])]);
    }

    public function update(Request $request, MaintenanceTicket $maintenanceTicket, MaintenanceService $service)
    {
        $request->validate([
            'title' => ['sometimes', 'string', 'max:160'],
            'description' => ['nullable', 'string', 'max:4000'],
            'category' => ['sometimes', 'in:ac,plumbing,electrical,furniture,tv,water,other'],
            'priority' => ['sometimes', 'in:low,normal,high,urgent'],
            'room_id' => ['sometimes', 'nullable', 'integer', 'exists:rooms,id'],
        ]);

        return response()->json(['data' => $service->update($maintenanceTicket, $request->validated())]);
    }

    public function transition(Request $request, MaintenanceTicket $maintenanceTicket, MaintenanceService $service)
    {
        $request->validate([
            'status' => ['required', 'in:triaged,assigned,in_progress,completed,verified,closed'],
        ]);

        return response()->json(['data' => $service->transition($maintenanceTicket->id, $request->input('status'))]);
    }

    public function assign(Request $request, MaintenanceTicket $maintenanceTicket, MaintenanceService $service)
    {
        $request->validate(['assigned_to' => ['required', 'integer', 'exists:users,id']]);

        return response()->json(['data' => $service->assign($maintenanceTicket->id, $request->input('assigned_to'))]);
    }
}
