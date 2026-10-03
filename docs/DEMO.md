# AHGMS Demo Guide

Log in as **Hotel Admin** (`admin@ahmedgrand.local` / `password123`) at
http://localhost:5174 and walk through the lifecycle in this order:

## 1. Rooms (Inventory)
Open **Rooms**. 24 seeded rooms across 3 floors and 4 room types
(Standard 8,000 · Deluxe 12,000 · Family 15,000 · Suite 25,000 PKR/night).
Try the status filter — each room follows a strict lifecycle.

## 2. Availability
Open **Availability**, pick dates, and search. The engine applies the real
overlap rule; try dates that clash with a seeded reservation to see conflicts,
and same-day checkout/check-in to see turnover allowed.

## 3. Guest + Reservation
- Open **Guests** — 8 seeded profiles (one blacklisted; blacklisted guests
  cannot be reserved).
- Create a **Reservation** via the 3-step wizard: guest → room/dates → confirm.
  Watch the confirmation code (`RSV-YYYY-NNNNNN`).

## 4. Front Desk — Check-in
Open **Front Desk** → **Arrivals Today**. Check in the reservation.
A folio (`FL-YYYY-NNNNNN`) opens automatically and the room goes `occupied`.

## 5. Charges & Services
- Open the stay's **Folio** → **Add Charge** (e.g. breakfast 1,500 PKR).
- Run **nightly billing** to post room charges (idempotent — run it twice,
  the second run posts nothing new).

## 6. Payment
**Record Payment** on the folio. Note the receipt number
(`RCPT-YYYY-NNNNNN`) and idempotency key — submitting the same key twice
returns the original payment instead of duplicating it.

## 7. Check-out
Check out from **Front Desk**. The room becomes `dirty` and a housekeeping
task is created automatically. Try checking out with an unpaid balance —
the system blocks it unless a manager overrides.

## 8. Housekeeping & Maintenance
- Open **Housekeeping**: work the task dirty → assigned → cleaning →
  inspection → ready. The room becomes bookable again at `ready`.
- Open **Maintenance**: create a ticket for a room; the room goes into
  maintenance and drops out of availability.

## 9. Reports & Dashboard
- **Dashboard** (`/`) shows live occupancy, arrivals/departures, revenue MTD.
- **Reports** shows occupancy %, ADR, RevPAR with documented formulas, plus
  revenue and reservation breakdowns.

## Role walkthroughs
- **Housekeeper** (`hk@ahmedgrand.local`): Housekeeping board, own tasks.
- **Accountant** (`accounts@ahmedgrand.local`): Folios, payments, reports.
- **Auditor** (`audit@ahmedgrand.local`): read-only access across modules.
