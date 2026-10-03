# LinkedIn Post Draft — AHGMS (factual build story)

> Ahmed publishes this himself. This is a draft only — never post on his behalf.

---

**Post:**

I built a complete Hotel & Guest Management System from scratch — and this
time the whole thing runs on my own engineering standard.

**AHGMS** — Ahmed Hotel & Guest Management System
*"Ahmed — Hospitality, Managed Smarter."*

It covers the full hospitality lifecycle end to end:
room inventory → availability → reservations → guests → check-in → stays →
charges & services → folio → payments → check-out → room turnover →
housekeeping → maintenance → reporting.

What I'm proud of technically:

- **Real availability engine** — proper overlap math, same-day turnover,
  maintenance rooms excluded, cancelled/no-show reservations don't block.
- **Folio system with real financial integrity** — append-only ledger,
  idempotent nightly billing, payment idempotency keys, overpayments become
  guest credit (never negative balances), checkout blocked on unpaid folios.
- **Query-backed reporting** — occupancy, ADR, RevPAR computed live with
  documented formulas. Zero fake dashboard numbers.
- **Strict multi-hotel isolation** at the query layer, 9 roles with real RBAC,
  full audit logging.

Stack: Laravel API + React 19 SPA (Vite + Tailwind), JWT auth.

Verified, not claimed: 121 backend tests / 497 assertions passing, 112
frontend tests passing, full end-to-end walkthrough from reservation to
checkout to reporting against a fresh seeded database.

Repository: https://github.com/mrahmed121/ahmed-hotel-guest-management-system-ahgms

#SoftwareEngineering #Laravel #React #HotelTech #FullStack #OpenSource

---

**Notes for Ahmed:**
- Fill in the real GitHub URL after publishing (placeholder above).
- Adjust test counts only if they changed after this draft was written.
- Post only facts from the verified build — no users, revenue, or deployment claims.
