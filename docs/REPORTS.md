# AHGMS Reporting — Formulas & Definitions

All figures are computed live from the database. Nothing is hardcoded.
Every endpoint is hotel-scoped (the `BelongsToHotel` global scope restricts
queries to the authenticated user's hotel; super admins bypass).

## Occupancy — `GET /reports/occupancy?start_date=&end_date=`

```
nights               = inclusive calendar days in [start_date, end_date]
occupied_room_nights = Σ over each date D: distinct rooms with a stay where
                       D >= date(checked_in_at)
                       AND (checked_out_at IS NULL OR D < date(checked_out_at))
                       AND stay.status IN ('in_house', 'checked_out')
occupancy_rate       = occupied_room_nights / (total_rooms × nights) × 100
```

The checkout day is NOT counted (standard "room nights sold" definition).
Ranges are capped at 366 nights. Zero rooms or zero nights → rate 0, not an error.

Note: nightly room attribution uses each stay's current room. Mid-stay room
moves are recorded in `stay_room_history` but are not split per-night here
(documented simplification).

## ADR (Average Daily Rate) — `GET /reports/adr`

```
total_room_revenue = SUM(folio_lines.amount)
                     WHERE line_type = 'room'
                       AND service_date IN range
                       AND folio belongs to hotel
ADR                = total_room_revenue / occupied_room_nights
```

Zero occupied nights → ADR 0.

## RevPAR (Revenue Per Available Room) — `GET /reports/revpar`

```
RevPAR = total_room_revenue / (total_rooms × nights)
       = ADR × occupancy_rate / 100
```

The API returns RevPAR from the direct formula; the ADR×occupancy identity
holds up to rounding (money 2dp, rates 2dp) and is covered by tests.

## Revenue — `GET /reports/revenue`

```
breakdown[line_type] = SUM(amount) per line_type IN
                       ('room','service','tax','fee','discount','adjustment')
                       for service_date IN range, hotel-scoped via folio
gross_charges        = room + service + tax + fee
net_revenue          = gross_charges + discount + adjustment
                       (discounts stored negative, adjustments signed)
payments_total       = SUM(payments.amount) WHERE paid_at IN range
outstanding_balance  = Σ over open folios of max(balance, 0)
balance (per folio)  = charges + discounts + adjustments − payments
```

Overpayment is guest credit (negative balance), never negative outstanding —
same convention as `FolioService::totals()`.

## Reservations — `GET /reports/reservations`

Counts grouped by status for reservations whose stay window overlaps the range
(`check_in <= end AND check_out >= start`), plus:

```
active_pipeline_value = SUM(total_estimate)
                        WHERE status IN ('inquiry','reserved','confirmed','checked_in')
```

## Front desk today — `GET /reports/front-desk`

- arrivals: reservations with `status = 'confirmed'` and `check_in = today`
- departures: stays with `status = 'in_house'` and `expected_checkout = today`
- in_house: all stays with `status = 'in_house'` (count + up to 50 listed)

## Housekeeping — `GET /reports/housekeeping`

- by_status: task counts grouped by status
- overdue: tasks created > 24h ago with status != 'ready'

## Maintenance — `GET /reports/maintenance`

- by_status: ticket counts grouped by status
- critical_open: tickets with priority high/urgent and status not in
  (completed, verified, closed)

## Dashboard — `GET /dashboard`

Aggregates: today's occupancy, arrivals/departures counts, in-house count,
month-to-date revenue (room/service/net), total outstanding balance,
housekeeping queue counts, open maintenance count, 5 most recent stays.

## Permissions

- `reports.view` — all `/reports/*` endpoints
- `dashboard.view` — `/dashboard`
