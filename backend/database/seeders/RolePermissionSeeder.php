<?php

namespace Database\Seeders;

use App\Domains\Shared\Models\Permission;
use App\Domains\Shared\Models\Role;
use Illuminate\Database\Seeder;

class RolePermissionSeeder extends Seeder
{
    /**
     * [slug, name, group]
     */
    private array $permissions = [
        // hotels
        ['hotels.view', 'View hotels', 'hotels'],
        ['hotels.manage', 'Manage hotels', 'hotels'],
        // floors
        ['floors.view', 'View floors', 'floors'],
        ['floors.create', 'Create floors', 'floors'],
        ['floors.manage', 'Manage floors', 'floors'],
        // room types
        ['room-types.view', 'View room types', 'room-types'],
        ['room-types.create', 'Create room types', 'room-types'],
        ['room-types.manage', 'Manage room types', 'room-types'],
        // rooms
        ['rooms.view', 'View rooms', 'rooms'],
        ['rooms.create', 'Create rooms', 'rooms'],
        ['rooms.manage', 'Manage rooms', 'rooms'],
        ['rooms.status', 'Change room status', 'rooms'],
        // amenities
        ['amenities.view', 'View amenities', 'amenities'],
        ['amenities.manage', 'Manage amenities', 'amenities'],
        // rate plans
        ['rate-plans.view', 'View rate plans', 'rate-plans'],
        ['rate-plans.manage', 'Manage rate plans', 'rate-plans'],
        // guests
        ['guests.view', 'View guests', 'guests'],
        ['guests.create', 'Create guests', 'guests'],
        ['guests.manage', 'Manage guests', 'guests'],
        // reservations
        ['reservations.view', 'View reservations', 'reservations'],
        ['reservations.create', 'Create reservations', 'reservations'],
        ['reservations.manage', 'Manage reservations', 'reservations'],
        ['reservations.cancel', 'Cancel reservations', 'reservations'],
        // availability
        ['availability.view', 'View availability', 'availability'],
        // stays
        ['stays.view', 'View stays', 'stays'],
        ['stays.manage', 'Manage stays', 'stays'],
        // front desk
        ['check-in', 'Check guests in', 'front-desk'],
        ['check-out', 'Check guests out', 'front-desk'],
        ['room-move', 'Move guest to another room', 'front-desk'],
        // folios
        ['folios.view', 'View folios', 'folios'],
        ['folios.manage', 'Manage folios', 'folios'],
        // charges
        ['charges.create', 'Post charges', 'charges'],
        // adjustments
        ['adjustments.create', 'Create adjustments', 'adjustments'],
        ['adjustments.approve', 'Approve adjustments', 'adjustments'],
        // payments
        ['payments.create', 'Record payments', 'payments'],
        ['payments.refund', 'Refund payments', 'payments'],
        // receipts
        ['receipts.view', 'View receipts', 'receipts'],
        // housekeeping
        ['housekeeping.view', 'View housekeeping', 'housekeeping'],
        ['housekeeping.assign', 'Assign housekeeping tasks', 'housekeeping'],
        ['housekeeping.manage', 'Manage housekeeping', 'housekeeping'],
        // maintenance
        ['maintenance.view', 'View maintenance tickets', 'maintenance'],
        ['maintenance.create', 'Create maintenance tickets', 'maintenance'],
        ['maintenance.manage', 'Manage maintenance tickets', 'maintenance'],
        // services
        ['services.view', 'View services', 'services'],
        ['services.manage', 'Manage services', 'services'],
        // documents
        ['documents.view', 'View documents', 'documents'],
        ['documents.upload', 'Upload documents', 'documents'],
        ['documents.manage', 'Manage documents', 'documents'],
        // reports
        ['reports.view', 'View reports', 'reports'],
        ['reports.financial', 'View financial reports', 'reports'],
        // dashboard
        ['dashboard.view', 'View dashboard', 'dashboard'],
        // users
        ['users.view', 'View users', 'users'],
        ['users.create', 'Create users', 'users'],
        ['users.manage', 'Manage users', 'users'],
        // audit
        ['audit.view', 'View audit logs', 'audit'],
        // settings
        ['settings.view', 'View settings', 'settings'],
        ['settings.manage', 'Manage settings', 'settings'],
    ];

    public function run(): void
    {
        foreach ($this->permissions as [$slug, $name, $group]) {
            Permission::firstOrCreate(['slug' => $slug], ['name' => $name, 'group' => $group]);
        }

        $all = Permission::pluck('id')->all();

        $roles = [
            'super_admin' => [
                'name' => 'Super Admin',
                'permissions' => $all,
            ],
            'hotel_admin' => [
                'name' => 'Hotel Admin',
                'permissions' => $this->slugsExcept(['hotels.manage']),
            ],
            'front_desk_manager' => [
                'name' => 'Front Desk Manager',
                'permissions' => $this->slugsOnly([
                    'hotels.view', 'floors.view', 'room-types.view', 'rooms.view', 'rooms.status',
                    'amenities.view', 'rate-plans.view',
                    'guests.view', 'guests.create', 'guests.manage',
                    'reservations.view', 'reservations.create', 'reservations.manage', 'reservations.cancel',
                    'availability.view', 'stays.view', 'stays.manage',
                    'check-in', 'check-out', 'room-move',
                    'folios.view', 'folios.manage', 'charges.create',
                    'adjustments.create', 'adjustments.approve',
                    'payments.create', 'payments.refund', 'receipts.view',
                    'housekeeping.view', 'maintenance.view', 'maintenance.create',
                    'services.view', 'documents.view', 'documents.upload',
                    'reports.view', 'dashboard.view',
                ]),
            ],
            'receptionist' => [
                'name' => 'Receptionist',
                'permissions' => $this->slugsOnly([
                    'hotels.view', 'floors.view', 'room-types.view', 'rooms.view',
                    'amenities.view', 'rate-plans.view',
                    'guests.view', 'guests.create', 'guests.manage',
                    'reservations.view', 'reservations.create', 'reservations.manage',
                    'availability.view', 'stays.view',
                    'check-in', 'check-out',
                    'folios.view', 'charges.create', 'payments.create', 'receipts.view',
                    'housekeeping.view', 'services.view',
                    'documents.view', 'documents.upload', 'dashboard.view',
                ]),
            ],
            'accountant' => [
                'name' => 'Accountant',
                'permissions' => $this->slugsOnly([
                    'guests.view', 'reservations.view', 'stays.view',
                    'folios.view', 'folios.manage', 'charges.create',
                    'adjustments.create', 'adjustments.approve',
                    'payments.create', 'payments.refund', 'receipts.view',
                    'reports.view', 'reports.financial', 'dashboard.view',
                    'settings.view',
                ]),
            ],
            'housekeeping_supervisor' => [
                'name' => 'Housekeeping Supervisor',
                'permissions' => $this->slugsOnly([
                    'rooms.view', 'rooms.status',
                    'housekeeping.view', 'housekeeping.assign', 'housekeeping.manage',
                    'maintenance.view', 'maintenance.create', 'maintenance.manage',
                    'dashboard.view',
                ]),
            ],
            'housekeeper' => [
                'name' => 'Housekeeper',
                'permissions' => $this->slugsOnly([
                    'rooms.view', 'housekeeping.view', 'housekeeping.manage', 'dashboard.view',
                ]),
            ],
            'operations_manager' => [
                'name' => 'Manager / Operations',
                'permissions' => $this->slugsOnly([
                    'hotels.view', 'rooms.view', 'guests.view', 'reservations.view',
                    'stays.view', 'folios.view', 'payments.create', 'receipts.view',
                    'housekeeping.view', 'maintenance.view', 'services.view',
                    'reports.view', 'reports.financial', 'dashboard.view',
                    'settings.view',
                ]),
            ],
            'auditor' => [
                'name' => 'Auditor',
                'permissions' => $this->viewOnly(),
            ],
        ];

        foreach ($roles as $slug => $def) {
            $role = Role::firstOrCreate(['slug' => $slug, 'hotel_id' => null], ['name' => $def['name']]);
            $role->permissions()->sync($def['permissions']);
        }
    }

    private function slugsOnly(array $slugs): array
    {
        return Permission::whereIn('slug', $slugs)->pluck('id')->all();
    }

    private function slugsExcept(array $slugs): array
    {
        return Permission::whereNotIn('slug', $slugs)->pluck('id')->all();
    }

    private function viewOnly(): array
    {
        return Permission::where('slug', 'like', '%.view')
            ->orWhere('slug', 'audit.view')
            ->pluck('id')->all();
    }
}
