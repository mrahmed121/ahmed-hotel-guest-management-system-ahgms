# AHGMS Security

## Authentication
- JWT Bearer tokens (tymon/jwt-auth), issued at `POST /api/v1/auth/login`.
- Logout invalidates the token server-side. Passwords are bcrypt-hashed.

## Authorization (RBAC)
- 9 roles, each with a curated permission set: Super Admin, Hotel Admin,
  Front Desk Manager, Receptionist, Accountant, Housekeeping Supervisor,
  Housekeeper, Operations Manager, Auditor.
- Every API route carries a `permission:<slug>` middleware; the SPA hides
  UI actions via the same slugs. Server-side enforcement is the real gate —
  UI gating is a convenience only.

## Hotel isolation
- The `BelongsToHotel` global scope restricts every domain query to the
  authenticated user's hotel. Cross-hotel lookups return 404, never another
  hotel's data. Super admins (no hotel) are the only bypass.
- Verified by tests: same resource ID under a different hotel → 404.

## Financial integrity
- Folio lines and payments are append-only: no update or delete endpoints
  exist for posted financial records. Corrections use signed adjustment lines.
- Check-out is blocked while a folio has an outstanding balance; override
  requires a manager-level permission and a recorded reason.
- Payment retries use client-generated idempotency keys; replays return the
  original payment instead of double-charging.
- Overpayments become guest credit, never negative outstanding balances.

## Audit
- Sensitive operations (logins, CRUD on inventory/guests/reservations,
  check-in/out, charges, payments, housekeeping/maintenance transitions)
  are written to `audit_logs` with actor, hotel, and timestamp.

## Operational notes
- Concurrency behavior is verified on SQLite only; row-locking semantics on
  MySQL/PostgreSQL should be re-verified before production use.
- Report the secret-rotation procedure: regenerate `JWT_SECRET` and
  `APP_KEY` on staff compromise or at least annually.
- Never commit `.env`, `*.sqlite`, or credentials. `git ls-files` should
  never list them — this is checked in CI/release reviews.
