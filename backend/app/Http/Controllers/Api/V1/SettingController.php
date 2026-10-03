<?php

namespace App\Http\Controllers\Api\V1;

use App\Domains\Shared\Models\Setting;
use App\Domains\Shared\Services\AuditService;
use Illuminate\Http\Request;

class SettingController
{
    public function index()
    {
        $settings = Setting::orderBy('key')->get();
        return response()->json(['data' => $settings]);
    }

    public function upsert(Request $request, AuditService $audit)
    {
        $data = $request->validate([
            'key' => 'required|string|max:80',
            'value' => 'nullable',
        ]);

        $user = $request->user('api');
        $hotelId = $user->hotel_id;

        if (! $hotelId) {
            $request->validate(['hotel_id' => 'required|exists:hotels,id']);
            $hotelId = $request->input('hotel_id');
        }

        $setting = Setting::withoutGlobalScopes()->updateOrCreate(
            ['hotel_id' => $hotelId, 'key' => $data['key']],
            ['value' => $data['value'] ?? null]
        );

        $audit->log('setting.updated', $setting, ['key' => $setting->key]);

        return response()->json(['data' => $setting]);
    }
}
