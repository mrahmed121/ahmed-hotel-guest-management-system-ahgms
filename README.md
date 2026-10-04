# AHGMS — Ahmed Hotel & Guest Management System

> **Ahmed — Hospitality, Managed Smarter.**

A complete hotel and guest management system covering the full hospitality lifecycle:
**Room → Availability → Reservation → Guest → Check-in → Stay → Charges → Services → Folio → Payment → Check-out → Room Turnover → Housekeeping → Reporting.**

---

## Features

- **Hotel inventory** — floors, room types, rooms (9-status lifecycle), amenities, rate plans
- **Availability engine** — real overlap checking with same-day turnover support
- **Guests** — profiles, VIP/blacklist flags, stay history
- **Reservations** — 3-step booking wizard, status workflow, conflict prevention
- **Front desk** — arrivals/in-house/departures, check-in, walk-in, room moves, check-out
- **Folio & billing** — idempotent folios, nightly room charges, service charges, discounts/adjustments, append-only ledger
- **Payments** — idempotency keys, receipt numbers, overpayment as guest credit
- **Housekeeping** — task lifecycle (dirty → assigned → cleaning → inspection → ready), auto-task on checkout
- **Maintenance** — ticket workflow, room blocking, verification
- **Service catalog** — chargeable services linked to folios
- **Reports** — occupancy, ADR, RevPAR, revenue breakdown, reservations, operations
- **Dashboard** — real query-backed metrics (no fake numbers)
- **Security** — JWT auth, 9 roles with RBAC, strict hotel isolation, audit logs

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Laravel 13 (PHP 8.3), SQLite (dev) |
| API | REST under `/api/v1`, JWT (tymon/jwt-auth) |
| Frontend | React 19, Vite, Tailwind CSS |
| Auth | JWT + role-based permissions |
| Database | SQLite (ships with seed data) |

## Quick Start (Windows)

Double-click **`RUN_AHGMS.bat`** — it checks prerequisites, installs dependencies,
creates the database, seeds demo data, starts both servers, and opens the browser.

- Frontend: http://localhost:5174
- API: http://127.0.0.1:8001

## Manual Installation

### Backend

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan jwt:secret
touch database/database.sqlite   # Linux/macOS
php artisan migrate --seed
php artisan serve --port=8001
```

### Frontend

```bash
cd frontend
npm install
npm run dev        # serves on http://localhost:5174
```

## Demo Credentials

Demo hotel: **Ahmed Grand Hotel (AGH)**. All passwords are `password123`.

| Role | Email |
|---|---|
| Super Admin | super@ahgms.local |
| Hotel Admin | admin@ahmedgrand.local |
| Front Desk Manager | frontdesk@ahmedgrand.local |
| Receptionist | reception@ahmedgrand.local |
| Accountant | accounts@ahmedgrand.local |
| Housekeeping Supervisor | hk.super@ahmedgrand.local |
| Housekeeper | hk@ahmedgrand.local |
| Operations Manager | ops@ahmedgrand.local |
| Auditor | audit@ahmedgrand.local |

## API Overview

All endpoints live under `/api/v1` and require a JWT Bearer token (except login).

| Area | Examples |
|---|---|
| Auth | `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` |
| Inventory | `/rooms`, `/room-types`, `/floors`, `/rate-plans` |
| Guests | `/guests` |
| Reservations | `/reservations`, `/availability` |
| Front desk | `/stays`, `/stays/:id/check-in`, `/stays/:id/check-out` |
| Folio | `/folios`, `/folios/:id/charges`, `/folios/:id/payments`, `POST /billing/nightly` |
| Housekeeping | `/housekeeping-tasks` |
| Maintenance | `/maintenance-tickets` |
| Services | `/services` |
| Reports | `/reports/occupancy`, `/reports/adr`, `/reports/revpar`, `/reports/revenue` |
| Dashboard | `GET /dashboard` |

See `docs/API_ROUTES.md` for the full route list.

## Screenshots

See [`docs/screenshots/`](docs/screenshots/) for the full walkthrough:
Login, Dashboard, Rooms, Availability, Reservations, Guest profile, Front Desk,
Folio, Payments, Housekeeping, Maintenance, and Reports.

## Documentation

- [`AHGMS-DESIGN.md`](AHGMS-DESIGN.md) — product and architecture design
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — domain structure, hotel isolation, event flow
- [`docs/REPORTS.md`](docs/REPORTS.md) — reporting formulas (occupancy, ADR, RevPAR)
- [`docs/DEMO.md`](docs/DEMO.md) — demo walkthrough guide
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — production deployment guide
- [`docs/SECURITY.md`](docs/SECURITY.md) — auth, RBAC, isolation, financial integrity

## License

MIT — see [LICENSE](LICENSE).

---

**Developed by Ahmed**

## Windows Quick Start

Double-click `RUN_AHGMS.bat` — it handles everything automatically:
- Verifies project structure and tools (PHP, Composer, Node.js)
- Installs dependencies, creates `.env`, sets up database (first run)
- Starts backend and frontend, opens browser automatically

To stop: run `STOP_AHGMS.bat`.

Safe to run from any directory, including as Administrator.

## Troubleshooting (Windows)

### "Missing PHP extensions" but XAMPP has them enabled
The BAT now uses `scripts/check-env.php` (PHP-native `extension_loaded()`) instead of parsing `php -m`.
If you still see false "missing" errors:
1. Run `DOCTOR_AHGMS.bat` — it shows the exact php.exe path and ini file being used
2. Check if a different PHP is first in PATH: `where php` lists all found
3. Verify the ini path shown matches your XAMPP: should be `C:\xampp\php\php.ini`

### "No php.ini loaded"
1. Find your php.exe: `where php`
2. Look for `php.ini-development` next to php.exe
3. Copy it to `php.ini` (the BAT offers to do this automatically)
4. For XAMPP: `C:\xampp\php\php.ini`

### Enabling extensions in XAMPP
1. Open `C:\xampp\php\php.ini` as Administrator
2. Find the line (e.g., `;extension=curl`) and remove the `;` at the start
3. Save, restart Apache, re-run the BAT
4. Required: pdo_sqlite, mbstring, openssl, fileinfo, curl, zip

### "Port busy" — BAT picks next free port automatically
If 8001 is busy, it tries 8002, 8003, etc. The frontend .env is updated automatically.

### Bypass checks (advanced)
Run: `RUN_AHGMS.bat --skip-checks`
