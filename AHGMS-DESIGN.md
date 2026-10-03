# AHGMS — Product & Architecture Design (P0)

> **Ahmed — Hospitality, Managed Smarter.**

## A. Product Overview

AHGMS (Ahmed Hotel & Guest Management System) is a complete hotel operations platform
covering the full guest lifecycle: room inventory → availability → reservation →
guest → check-in → stay → charges → folio → payment → check-out → room turnover →
housekeeping → reporting.

It is a multi-hotel SaaS-style system: each hotel organization is strictly isolated.
A hotel must never see another hotel's guests, rooms, reservations, folios, or reports.

## B. User Roles

| Role | Scope |
|------|-------|
| Super Admin | Platform-wide, manages hotels |
| Hotel Admin | Full control of one hotel |
| Front Desk Manager | Front desk ops, overrides |
| Receptionist | Check-in/out, reservations, folios |
| Accountant | Payments, folios, reports (financial) |
| Housekeeping Supervisor | Housekeeping queue, assignments, inspections |
| Housekeeper | Own assigned cleaning tasks |
| Manager / Operations | Reports, dashboards, read-mostly |
| Auditor | Read-only everything |

No guest role — guest-facing features are out of scope for v1 (noted as future).

## C. Module Map

```
P1 Foundation      auth, users, roles, permissions, hotels, audit, settings
P2 Inventory       hotels → floors → room types → rooms → amenities, rate plans
P3 Guests+Res      guests, reservations, availability engine
P4 Front Desk      check-in, stay, room move, check-out
P5 Folio           folios, charges (room/service), adjustments, payments, receipts
P6 Operations      housekeeping tasks, maintenance tickets, service catalog
P7 Reporting       occupancy, ADR, RevPAR, revenue, arrivals/departures, queues
P8 Hardening       audit, tests, screenshots, docs, launcher, GitHub
```

## D. Business Workflows

### Reservation → Stay
```
INQUIRY → RESERVED → CONFIRMED → CHECKED_IN → CHECKED_OUT
                                    ↓
                              CANCELLED / NO_SHOW (terminal)
```

### Room status lifecycle
```
available ⇄ reserved → occupied → dirty → cleaning → inspection → ready → available
                              ↘ maintenance / out_of_service (blocks assignment)
```

### Housekeeping task lifecycle
```
DIRTY → ASSIGNED → CLEANING → INSPECTION → READY
```

### Maintenance ticket lifecycle
```
OPEN → TRIAGED → ASSIGNED → IN_PROGRESS → COMPLETED → VERIFIED → CLOSED
```

### Folio flow
```
STAY → FOLIO → ROOM CHARGE (nightly) + SERVICE CHARGE ± ADJUSTMENT
     → PAYMENT → BALANCE → CHECK-OUT (settled or authorized outstanding)
```

## E. Entity Relationship Design

```
hotels (id, name, code, address, phone, email, settings JSON)
  → floors (id, hotel_id, number, name)
  → room_types (id, hotel_id, name, code, base_rate, max_occupancy, amenities JSON)
  → rooms (id, hotel_id, floor_id, room_type_id, number UNIQUE per hotel,
           status, features JSON)
  → amenities (id, hotel_id, name, icon)
  → rate_plans (id, hotel_id, room_type_id, name, base_rate,
                valid_from, valid_to, tax_percent, service_charge_percent)

guests (id, hotel_id, first_name, last_name, email, phone, country,
        id_type, id_number, address, notes, vip flag, status)

reservations (id, hotel_id, guest_id, room_id NULLABLE, room_type_id,
  confirmation_code UNIQUE (RSV-...), status, check_in DATE, check_out DATE,
  adults, children, rate_plan_id, nightly_rate, total_estimate,
  source, notes, cancelled_at, no_show_at)

stays (id, hotel_id, reservation_id UNIQUE, guest_id, room_id,
  checked_in_at, checked_out_at NULLABLE, status, notes)
stay_room_history (id, stay_id, from_room_id, to_room_id, reason, actor_id, at)

folios (id, hotel_id, stay_id UNIQUE, folio_number UNIQUE (FL-...),
  status: open/closed, opened_at, closed_at)
folio_lines (id, folio_id, line_type: room/service/adjustment/tax/fee,
  description, quantity, unit_price, amount, service_date, ref)
payments (id, hotel_id, folio_id, receipt_number UNIQUE (RCPT-...),
  method: cash/card/bank_transfer/other, amount, paid_at, reference, idempotency_key UNIQUE)
folio_adjustments (id, folio_id, type: discount/charge/correction,
  amount signed, reason, actor_id, at)

housekeeping_tasks (id, hotel_id, room_id, assigned_to NULLABLE,
  status, priority, notes, started_at, completed_at,
  inspected_by NULLABLE, inspected_at NULLABLE)
maintenance_tickets (id, hotel_id, room_id NULLABLE, ticket_number (MT-...),
  category, priority, status, description, assigned_to NULLABLE, ...)

services (id, hotel_id, name, code, unit_price, taxable, active)
documents (id, hotel_id, parent_type, parent_id, filename, path, mime, size)
audit_logs (id, hotel_id NULLABLE, actor_id, action, subject_type/id, context JSON, at)
```

### Key constraints
- `rooms.number` UNIQUE per hotel.
- `reservations.confirmation_code` UNIQUE globally.
- No overlapping active reservations per room: enforced in service layer with
  DB transaction + row lock (SQLite: transactional check; documented limitation
  for true parallelism on MySQL/PostgreSQL).
- `stay.reservation_id` UNIQUE (one stay per reservation).
- `folio.stay_id` UNIQUE (one folio per stay).
- `payments.idempotency_key` UNIQUE (prevent duplicate posting).
- Folio lines: append-only. Corrections via adjustment lines, never UPDATE/DELETE
  of posted charge lines.
- Rooms with status `maintenance`/`out_of_service` cannot be assigned.

## F. API Architecture

- Base: `/api/v1`, JSON only.
- Auth: JWT (tymon/jwt-auth). `POST /api/v1/auth/login`, `/logout`, `/refresh`, `/me`.
- Health: `GET /api/v1/health` (public).
- RBAC: `permission:{ability}` middleware on every route except login/health.
- Hotel scoping: `BelongsToHotel` global scope on all hotel-owned models.
  Cross-hotel access → 404.
- Controllers thin; domain services own logic under `app/Domains/{Inventory,Guests,
  Reservations,FrontDesk,Folio,Housekeeping,Maintenance,Reports,Shared}`.

### Endpoint groups (planned)
```
auth, hotels, floors, room-types, rooms, amenities, rate-plans,
guests, reservations, availability, stays, room-moves,
folios, folio-lines, payments, receipts,
housekeeping-tasks, maintenance-tickets, services,
documents, reports, dashboard, users, audit-logs, settings
```

## G. Frontend Architecture

- React 18 + Vite + Tailwind. Dark executive theme:
  Charcoal `#12161d`, Ahmed Gold `#d4af37`, Copper `#b87333`.
- `src/modules/{inventory,guests,reservations,frontdesk,folio,housekeeping,maintenance,reports,settings}`
- Shared: `DataTable`, `StatusBadge`, `EmptyState`, `Spinner`, `PermissionGuard`, `Modal`.
- React Router with `RequireAuth` + `RequirePermission` guards.
- Availability calendar component for reservations.

## H. Permissions (planned, ~60)

```
hotels.view/manage, floors.*, room-types.*, rooms.*,
amenities.*, rate-plans.*, guests.*, reservations.*,
availability.view, stays.*, check-in, check-out, room-move,
folios.*, charges.create, adjustments.create/approve,
payments.create/refund, receipts.view,
housekeeping.*, maintenance.*, services.*,
documents.*, reports.*, dashboard.view,
users.*, audit.view, settings.*
```

## I. Validation Rules

- Reservation: check_out > check_in; room exists & assignable; no overlap.
- Check-in: reservation CONFIRMED; room AVAILABLE/RESERVED; guest present.
- Check-out: folio balance settled OR manager override with reason.
- Payment: amount > 0; not exceeding outstanding + explicit credit handling.
- Nightly charge: idempotent per (stay_id, service_date).
- Room status transitions: only legal transitions (state machine).

## J. Edge Cases

- Same-day check-in/check-out (room turnover).
- Reservation for today with immediate check-in.
- Room move mid-stay: nightly charges follow the room actually occupied that night.
- No-show: room released back to available; no charges.
- Cancellation after check-in started: blocked, must check out.
- Overpayment: recorded as guest credit, not negative balance.
- Walk-in (no reservation): creates reservation + stay in one flow.

## K. Testing Strategy

- PHPUnit: domain unit tests (availability overlap, folio math, state machines),
  API feature tests (auth, RBAC, hotel isolation, CRUD, workflows),
  financial tests (nightly idempotency, payment idempotency, balance).
- Vitest: component tests, permission-guard tests, critical-flow tests.
- Live E2E via HTTP against seeded DB.
- Honest counts only.

## L. UI/UX Structure

```
Sidebar: Dashboard, Front Desk, Reservations, Guests, Rooms,
         Folios, Housekeeping, Maintenance, Reports, Services, Settings
Front Desk: arrivals today, departures today, in-house list,
            quick check-in, quick check-out
Availability: date range + room type → grid of available rooms
```

## M. GitHub Structure

```
ahmed-hotel-guest-management-system-ahgms/
  backend/ (Laravel 11)
  frontend/ (React 18)
  docs/ (API, ARCHITECTURE, DATABASE, DEPLOYMENT, SECURITY, DEMO)
  docs/screenshots/
  README.md, CHANGELOG.md, LICENSE (MIT), .gitignore
  RUN_AHGMS.bat
```

## N. README Structure

hero, badges, title, tagline, screenshots, nav, Executive Overview,
Key Features, Design System, Demo Credentials, Architecture,
Getting Started, Environment, Project Structure, Tech Stack,
Testing, Contributing, MIT, Developed by Ahmed.

## O. Implementation Roadmap

P1 → P2 → P3 → P4 → P5 → P6 → P7 → P8, each committed separately.
No GitHub push until final P8 verification (Ahmed authorizes).
```

**Status:** P0 complete. Proceeding to P1 automatically.
