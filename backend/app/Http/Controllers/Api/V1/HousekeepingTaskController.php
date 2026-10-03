<?php

namespace App\Http\Controllers\Api\V1;

use App\Domains\Housekeeping\Models\HousekeepingTask;
use App\Domains\Housekeeping\Services\HousekeepingService;
use App\Http\Requests\Api\V1\StoreHousekeepingTaskRequest;
use Illuminate\Http\Request;

class HousekeepingTaskController
{
    public function index(Request $request, HousekeepingService $service)
    {
        return response()->json($service->list($request->only(['status', 'room_id', 'assigned_to', 'per_page'])));
    }

    public function store(StoreHousekeepingTaskRequest $request, HousekeepingService $service)
    {
        return response()->json(['data' => $service->createTask(
            $request->validated()['room_id'],
            $request->validated()
        )], 201);
    }

    public function show(HousekeepingTask $housekeepingTask)
    {
        return response()->json(['data' => $housekeepingTask->load(['room', 'assignee', 'inspector'])]);
    }

    public function assign(Request $request, HousekeepingTask $housekeepingTask, HousekeepingService $service)
    {
        $request->validate(['assigned_to' => ['required', 'integer', 'exists:users,id']]);

        return response()->json(['data' => $service->assign($housekeepingTask->id, $request->input('assigned_to'))]);
    }

    public function start(HousekeepingTask $housekeepingTask, HousekeepingService $service)
    {
        return response()->json(['data' => $service->startCleaning($housekeepingTask->id)]);
    }

    public function complete(HousekeepingTask $housekeepingTask, HousekeepingService $service)
    {
        return response()->json(['data' => $service->complete($housekeepingTask->id)]);
    }

    public function inspect(Request $request, HousekeepingTask $housekeepingTask, HousekeepingService $service)
    {
        $request->validate([
            'passed' => ['required', 'boolean'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        return response()->json(['data' => $service->inspect(
            $housekeepingTask->id,
            $request->boolean('passed'),
            $request->input('notes')
        )]);
    }
}
