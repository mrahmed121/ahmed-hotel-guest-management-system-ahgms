# AHGMS Architecture

## Domain structure

The backend (`backend/app/Domains/`) is organized as vertical domain slices.
Each domain owns its models, services, events, and listeners — no code is
shared with or copied from any other project.

```
app/Domains/
├── Shared/         hotels, users, roles, permissions, settings, audit logs,
│                   BelongsToHotel global scope, traits, shared services
├── Inventory/      floors, room types, rooms, amenities, rate plans
├── Guests/         guest profiles, blacklist/VIP flags
├── Reservations/   reservations, availability engine
├── FrontDesk/      stays, check-in/check-out, walk-in, room moves
│                   Events: GuestCheckedIn, GuestCheckedOut, RoomBecameDirty
├── Folio/          folios, folio lines (append-only), payments, adjustments
│                   Listeners: OpenFolioOnCheckIn
├── Housekeeping/   housekeeping tasks, maintenance tickets, service catalog
│                   Listeners: CreateHousekeepingTaskOnRoomDirty
└── Reports/        occupancy/ADR/RevPAR, revenue, dashboard snapshot
```

Controllers are thin (`app/Http/Controllers/Api/V1/`); all business rules
live in domain services. All APIs are versioned under `/api/v1`.

## Hotel isolation

Every domain table carries `hotel_id` and uses the `BelongsToHotel` global
scope (`app/Domains/Shared/Scopes/`). Queries are automatically restricted to
the authenticated user's hotel. Super admins (`hotel_id = null`) bypass the
scope. Cross-hotel access returns 404; role-based authorization failures
return 403.

## Event flow (the stay lifecycle)

```
RoomBecameDirty ──▶ CreateHousekeepingTaskOnRoomDirty (auto housekeeping task)
GuestCheckedIn  ──▶ OpenFolioOnCheckIn (folio opens automatically)
GuestCheckedOut ──▶ folio closed if settled; room → dirty → housekeeping task
```

## Key invariants

- **Overlap rule:** `new.check_in < existing.check_out AND new.check_out > existing.check_in`.
  Cancelled/no-show reservations and maintenance/out-of-service rooms never
  block availability. Same-day turnover is allowed.
- **Financial records are append-only.** Corrections are adjustments
  (signed lines), never edits or deletes of posted lines.
- **Folio totals:** charges + signed discounts/adjustments − payments = balance.
  Overpayment becomes guest credit, never a negative outstanding balance.
- **Nightly billing** is idempotent per (folio, service_date) and uses the
  `reservation.nightly_rate` frozen at booking time.
- **Check-out is blocked** on outstanding balance unless a manager overrides
  with a reason.
- **Numbering:** folios `FL-YYYY-NNNNNN`, receipts `RCPT-YYYY-NNNNNN`,
  reservations `RSV-YYYY-NNNNNN`, maintenance tickets `MT-YYYY-NNNNNN`.

## Frontend

`frontend/src/` — React 19 + Vite + Tailwind. Feature modules under
`src/modules/{inventory,guests,reservations,frontdesk,folio,operations,reports}/`,
each with `services/` (API clients), `pages/`, and shared UI in `src/components/`.
Route guards enforce authentication and permission slugs; the API client uses
relative `/api/v1` with a Vite dev proxy to the Laravel server.
