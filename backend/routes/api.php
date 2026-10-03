<?php

use App\Http\Controllers\Api\V1\AuditLogController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\AmenityController;
use App\Http\Controllers\Api\V1\AvailabilityController;
use App\Http\Controllers\Api\V1\CheckInController;
use App\Http\Controllers\Api\V1\CheckOutController;
use App\Http\Controllers\Api\V1\FloorController;
use App\Http\Controllers\Api\V1\FolioChargeController;
use App\Http\Controllers\Api\V1\FolioController;
use App\Http\Controllers\Api\V1\GuestController;
use App\Http\Controllers\Api\V1\HotelController;
use App\Http\Controllers\Api\V1\HousekeepingTaskController;
use App\Http\Controllers\Api\V1\MaintenanceTicketController;
use App\Http\Controllers\Api\V1\NightlyBillingController;
use App\Http\Controllers\Api\V1\PaymentController;
use App\Http\Controllers\Api\V1\RatePlanController;
use App\Http\Controllers\Api\V1\ReportController;
use App\Http\Controllers\Api\V1\DashboardController;
use App\Http\Controllers\Api\V1\ReservationController;
use App\Http\Controllers\Api\V1\RoleController;
use App\Http\Controllers\Api\V1\RoomController;
use App\Http\Controllers\Api\V1\RoomMoveController;
use App\Http\Controllers\Api\V1\RoomTypeController;
use App\Http\Controllers\Api\V1\ServiceController;
use App\Http\Controllers\Api\V1\SettingController;
use App\Http\Controllers\Api\V1\StayController;
use App\Http\Controllers\Api\V1\UserController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    // Public
    Route::get('health', function () {
        return response()->json(['status' => 'ok', 'app' => 'AHGMS']);
    });
    Route::post('auth/login', [AuthController::class, 'login']);

    // Authenticated (JWT)
    Route::middleware('auth:api')->group(function () {
        Route::post('auth/logout', [AuthController::class, 'logout']);
        Route::post('auth/refresh', [AuthController::class, 'refresh']);
        Route::get('auth/me', [AuthController::class, 'me']);

        // Hotels
        Route::get('hotels', [HotelController::class, 'index'])->middleware('permission:hotels.view');
        Route::post('hotels', [HotelController::class, 'store'])->middleware('permission:hotels.manage');
        Route::get('hotels/{hotel}', [HotelController::class, 'show'])->middleware('permission:hotels.view');
        Route::put('hotels/{hotel}', [HotelController::class, 'update'])->middleware('permission:hotels.manage');

        // Users
        Route::get('users', [UserController::class, 'index'])->middleware('permission:users.view');
        Route::post('users', [UserController::class, 'store'])->middleware('permission:users.create');
        Route::get('users/{user}', [UserController::class, 'show'])->middleware('permission:users.view');
        Route::put('users/{user}', [UserController::class, 'update'])->middleware('permission:users.manage');

        // Roles (read-only list)
        Route::get('roles', [RoleController::class, 'index'])->middleware('permission:users.view');

        // Audit logs (read-only)
        Route::get('audit-logs', [AuditLogController::class, 'index'])->middleware('permission:audit.view');

        // Settings
        Route::get('settings', [SettingController::class, 'index'])->middleware('permission:settings.view');
        Route::post('settings', [SettingController::class, 'upsert'])->middleware('permission:settings.manage');

        // Inventory — Floors
        Route::get('floors', [FloorController::class, 'index'])->middleware('permission:floors.view');
        Route::post('floors', [FloorController::class, 'store'])->middleware('permission:floors.create');
        Route::get('floors/{floor}', [FloorController::class, 'show'])->middleware('permission:floors.view');
        Route::put('floors/{floor}', [FloorController::class, 'update'])->middleware('permission:floors.manage');
        Route::delete('floors/{floor}', [FloorController::class, 'destroy'])->middleware('permission:floors.manage');

        // Inventory — Room types
        Route::get('room-types', [RoomTypeController::class, 'index'])->middleware('permission:room-types.view');
        Route::post('room-types', [RoomTypeController::class, 'store'])->middleware('permission:room-types.create');
        Route::get('room-types/{room_type}', [RoomTypeController::class, 'show'])->middleware('permission:room-types.view');
        Route::put('room-types/{room_type}', [RoomTypeController::class, 'update'])->middleware('permission:room-types.manage');
        Route::delete('room-types/{room_type}', [RoomTypeController::class, 'destroy'])->middleware('permission:room-types.manage');

        // Inventory — Rooms
        Route::get('rooms', [RoomController::class, 'index'])->middleware('permission:rooms.view');
        Route::post('rooms', [RoomController::class, 'store'])->middleware('permission:rooms.create');
        Route::get('rooms/{room}', [RoomController::class, 'show'])->middleware('permission:rooms.view');
        Route::put('rooms/{room}', [RoomController::class, 'update'])->middleware('permission:rooms.manage');
        Route::delete('rooms/{room}', [RoomController::class, 'destroy'])->middleware('permission:rooms.manage');
        Route::post('rooms/{room}/status', [RoomController::class, 'setStatus'])->middleware('permission:rooms.status');

        // Inventory — Amenities
        Route::get('amenities', [AmenityController::class, 'index'])->middleware('permission:amenities.view');
        Route::post('amenities', [AmenityController::class, 'store'])->middleware('permission:amenities.manage');
        Route::get('amenities/{amenity}', [AmenityController::class, 'show'])->middleware('permission:amenities.view');
        Route::put('amenities/{amenity}', [AmenityController::class, 'update'])->middleware('permission:amenities.manage');
        Route::delete('amenities/{amenity}', [AmenityController::class, 'destroy'])->middleware('permission:amenities.manage');

        // Inventory — Rate plans
        Route::get('rate-plans', [RatePlanController::class, 'index'])->middleware('permission:rate-plans.view');
        Route::post('rate-plans', [RatePlanController::class, 'store'])->middleware('permission:rate-plans.manage');
        Route::get('rate-plans/{rate_plan}', [RatePlanController::class, 'show'])->middleware('permission:rate-plans.view');
        Route::put('rate-plans/{rate_plan}', [RatePlanController::class, 'update'])->middleware('permission:rate-plans.manage');
        Route::delete('rate-plans/{rate_plan}', [RatePlanController::class, 'destroy'])->middleware('permission:rate-plans.manage');

        // Guests
        Route::get('guests', [GuestController::class, 'index'])->middleware('permission:guests.view');
        Route::post('guests', [GuestController::class, 'store'])->middleware('permission:guests.create');
        Route::get('guests/{guest}', [GuestController::class, 'show'])->middleware('permission:guests.view');
        Route::put('guests/{guest}', [GuestController::class, 'update'])->middleware('permission:guests.manage');
        Route::delete('guests/{guest}', [GuestController::class, 'destroy'])->middleware('permission:guests.manage');
        Route::post('guests/{guest}/blacklist', [GuestController::class, 'blacklist'])->middleware('permission:guests.manage');
        Route::post('guests/{guest}/unblacklist', [GuestController::class, 'unblacklist'])->middleware('permission:guests.manage');

        // Reservations
        Route::get('reservations', [ReservationController::class, 'index'])->middleware('permission:reservations.view');
        Route::post('reservations', [ReservationController::class, 'store'])->middleware('permission:reservations.create');
        Route::get('reservations/{reservation}', [ReservationController::class, 'show'])->middleware('permission:reservations.view');
        Route::put('reservations/{reservation}', [ReservationController::class, 'update'])->middleware('permission:reservations.manage');
        Route::delete('reservations/{reservation}', [ReservationController::class, 'destroy'])->middleware('permission:reservations.manage');
        Route::post('reservations/{reservation}/confirm', [ReservationController::class, 'confirm'])->middleware('permission:reservations.manage');
        Route::post('reservations/{reservation}/cancel', [ReservationController::class, 'cancel'])->middleware('permission:reservations.cancel');
        Route::post('reservations/{reservation}/no-show', [ReservationController::class, 'noShow'])->middleware('permission:reservations.manage');

        // Front Desk — Stays
        // NOTE: /stays/check-in and /stays/walk-in MUST be registered before
        // /stays/{stay} so they are not captured as route-model binding.
        Route::post('stays/check-in', [CheckInController::class, 'checkIn'])->middleware('permission:check-in');
        Route::post('stays/walk-in', [CheckInController::class, 'walkIn'])->middleware('permission:check-in');
        Route::get('stays', [StayController::class, 'index'])->middleware('permission:stays.view');
        Route::get('stays/{stay}', [StayController::class, 'show'])->middleware('permission:stays.view');
        Route::post('stays/{stay}/check-out', [CheckOutController::class, 'checkOut'])->middleware('permission:check-out');
        Route::post('stays/{stay}/room-move', [RoomMoveController::class, 'move'])->middleware('permission:room-move');

        // Availability
        Route::get('availability', [AvailabilityController::class, 'search'])->middleware('permission:availability.view');

        // Folios
        Route::get('folios', [FolioController::class, 'index'])->middleware('permission:folios.view');
        Route::get('folios/{folio}', [FolioController::class, 'show'])->middleware('permission:folios.view');
        Route::get('folios/{folio}/totals', [FolioController::class, 'totals'])->middleware('permission:folios.view');
        Route::post('folios/{folio}/charges', [FolioChargeController::class, 'store'])->middleware('permission:charges.create');
        Route::post('folios/{folio}/adjustments', [FolioChargeController::class, 'storeAdjustment'])->middleware('permission:adjustments.create');

        // Payments
        Route::post('folios/{folio}/payments', [PaymentController::class, 'store'])->middleware('permission:payments.create');
        Route::get('folios/{folio}/receipts', [PaymentController::class, 'index'])->middleware('permission:receipts.view');
        Route::get('payments/{payment}/receipt', [PaymentController::class, 'receipt'])->middleware('permission:receipts.view');

        // Nightly billing (system job, triggered manually)
        Route::post('billing/nightly', [NightlyBillingController::class, 'run'])->middleware('permission:folios.manage');

        // Housekeeping
        Route::get('housekeeping-tasks', [HousekeepingTaskController::class, 'index'])->middleware('permission:housekeeping.view');
        Route::post('housekeeping-tasks', [HousekeepingTaskController::class, 'store'])->middleware('permission:housekeeping.manage');
        Route::get('housekeeping-tasks/{housekeepingTask}', [HousekeepingTaskController::class, 'show'])->middleware('permission:housekeeping.view');
        Route::post('housekeeping-tasks/{housekeepingTask}/assign', [HousekeepingTaskController::class, 'assign'])->middleware('permission:housekeeping.assign');
        Route::post('housekeeping-tasks/{housekeepingTask}/start', [HousekeepingTaskController::class, 'start'])->middleware('permission:housekeeping.manage');
        Route::post('housekeeping-tasks/{housekeepingTask}/complete', [HousekeepingTaskController::class, 'complete'])->middleware('permission:housekeeping.manage');
        Route::post('housekeeping-tasks/{housekeepingTask}/inspect', [HousekeepingTaskController::class, 'inspect'])->middleware('permission:housekeeping.manage');

        // Maintenance
        Route::get('maintenance-tickets', [MaintenanceTicketController::class, 'index'])->middleware('permission:maintenance.view');
        Route::post('maintenance-tickets', [MaintenanceTicketController::class, 'store'])->middleware('permission:maintenance.create');
        Route::get('maintenance-tickets/{maintenanceTicket}', [MaintenanceTicketController::class, 'show'])->middleware('permission:maintenance.view');
        Route::put('maintenance-tickets/{maintenanceTicket}', [MaintenanceTicketController::class, 'update'])->middleware('permission:maintenance.manage');
        Route::post('maintenance-tickets/{maintenanceTicket}/transition', [MaintenanceTicketController::class, 'transition'])->middleware('permission:maintenance.manage');
        Route::post('maintenance-tickets/{maintenanceTicket}/assign', [MaintenanceTicketController::class, 'assign'])->middleware('permission:maintenance.manage');

        // Service catalog
        Route::get('services', [ServiceController::class, 'index'])->middleware('permission:services.view');
        Route::get('services/active', [ServiceController::class, 'active'])->middleware('permission:services.view');
        Route::post('services', [ServiceController::class, 'store'])->middleware('permission:services.manage');
        Route::get('services/{service}', [ServiceController::class, 'show'])->middleware('permission:services.view');
        Route::put('services/{service}', [ServiceController::class, 'update'])->middleware('permission:services.manage');
        Route::delete('services/{service}', [ServiceController::class, 'destroy'])->middleware('permission:services.manage');

        // Reports + dashboard (P7)
        Route::get('reports/occupancy', [ReportController::class, 'occupancy'])->middleware('permission:reports.view');
        Route::get('reports/adr', [ReportController::class, 'adr'])->middleware('permission:reports.view');
        Route::get('reports/revpar', [ReportController::class, 'revpar'])->middleware('permission:reports.view');
        Route::get('reports/revenue', [ReportController::class, 'revenue'])->middleware('permission:reports.view');
        Route::get('reports/reservations', [ReportController::class, 'reservations'])->middleware('permission:reports.view');
        Route::get('reports/front-desk', [ReportController::class, 'frontDesk'])->middleware('permission:reports.view');
        Route::get('reports/housekeeping', [ReportController::class, 'housekeeping'])->middleware('permission:reports.view');
        Route::get('reports/maintenance', [ReportController::class, 'maintenance'])->middleware('permission:reports.view');
        Route::get('dashboard', [DashboardController::class, 'show'])->middleware('permission:dashboard.view');
    });
});
