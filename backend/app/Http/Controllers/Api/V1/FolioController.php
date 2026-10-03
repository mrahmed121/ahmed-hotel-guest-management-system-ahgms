<?php

namespace App\Http\Controllers\Api\V1;

use App\Domains\Folio\Models\Folio;
use App\Domains\Folio\Services\FolioService;
use Illuminate\Http\Request;

class FolioController
{
    public function index(Request $request)
    {
        $query = Folio::with(['stay.guest', 'stay.room'])->orderByDesc('opened_at');

        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }
        if ($request->filled('stay_id')) {
            $query->where('stay_id', $request->integer('stay_id'));
        }

        return response()->json($query->paginate(15));
    }

    public function show(Folio $folio, FolioService $folios)
    {
        $folio->load([
            'stay.guest', 'stay.room', 'stay.reservation',
            'lines' => fn ($q) => $q->orderBy('service_date')->orderBy('id'),
            'payments' => fn ($q) => $q->orderByDesc('paid_at'),
            'adjustments',
        ]);

        return response()->json([
            'data' => $folio,
            'meta' => ['totals' => $folios->totals($folio->id)],
        ]);
    }

    public function totals(Folio $folio, FolioService $folios)
    {
        return response()->json(['data' => $folios->totals($folio->id)]);
    }
}
