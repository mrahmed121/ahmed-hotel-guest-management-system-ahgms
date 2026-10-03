<?php

namespace App\Http\Controllers\Api\V1;

use App\Domains\Inventory\Models\RatePlan;
use App\Domains\Inventory\Services\RatePlanService;
use App\Http\Requests\Api\V1\StoreRatePlanRequest;
use App\Http\Requests\Api\V1\UpdateRatePlanRequest;
use Illuminate\Http\Request;

class RatePlanController
{
    public function index(Request $request)
    {
        $query = RatePlan::with('roomType')->orderBy('name');
        if ($request->filled('room_type_id')) {
            $query->where('room_type_id', $request->integer('room_type_id'));
        }
        if ($request->boolean('active_only')) {
            $query->where('is_active', true);
        }
        return response()->json($query->paginate(15));
    }

    public function store(StoreRatePlanRequest $request, RatePlanService $service)
    {
        $plan = $service->create($request->validated());
        return response()->json(['data' => $plan->load('roomType')], 201);
    }

    public function show(RatePlan $ratePlan)
    {
        $data = $ratePlan->load('roomType')->toArray();
        $data['nightly_total'] = $ratePlan->nightlyTotal();
        return response()->json(['data' => $data]);
    }

    public function update(UpdateRatePlanRequest $request, RatePlan $ratePlan, RatePlanService $service)
    {
        return response()->json(['data' => $service->update($ratePlan, $request->validated())]);
    }

    public function destroy(RatePlan $ratePlan, RatePlanService $service)
    {
        $service->delete($ratePlan);
        return response()->json(['message' => 'Rate plan deleted.']);
    }
}
