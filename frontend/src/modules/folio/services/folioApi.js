import client from '../../../api/client';

function list(path, params = {}) {
  return client.get(path, { params }).then((r) => r.data);
}

/**
 * Folio API — hotel guest folio (bill) management.
 *
 * Contract (backend P5):
 *  GET    /folios?status=open|closed        paginated folios w/ stay, guest, room
 *  GET    /folios/:id                      folio with lines[], payments[], totals{}
 *  GET    /folios/:id/totals               totals only
 *  POST   /folios/:id/charges              {line_type: room|service, description, quantity, unit_price, service_date?}
 *  POST   /folios/:id/adjustments          {type: discount|additional_charge|correction, amount, reason}
 *  POST   /folios/:id/payments             {method, amount, reference?, idempotency_key, notes?}
 *  POST   /billing/nightly                   {date} → {charged, skipped}
 */
export const foliosApi = {
  list: (params) => list('/folios', params),
  get: (id) => client.get(`/folios/${id}`).then((r) => r.data),
  /** GET /folios?stay_id=:id — folio for a stay (first match). */
  byStay: (stayId) =>
    client.get('/folios', { params: { stay_id: stayId, per_page: 1 } }).then((r) => {
      const payload = r.data;
      const data = payload?.data ?? payload ?? [];
      const rows = Array.isArray(data) ? data : data.data ?? [];
      return rows[0] ?? null;
    }),
  totals: (id) => client.get(`/folios/${id}/totals`).then((r) => r.data),
  addCharge: (id, data) => client.post(`/folios/${id}/charges`, data).then((r) => r.data),
  addAdjustment: (id, data) => client.post(`/folios/${id}/adjustments`, data).then((r) => r.data),
  recordPayment: (id, data) => client.post(`/folios/${id}/payments`, data).then((r) => r.data),
  /** POST /billing/nightly {date} → {charged, skipped} */
  runNightlyBilling: (billingDate) =>
    client.post('/billing/nightly', { date: billingDate }).then((r) => r.data),
};

export const FOLIOS_VIEW_PERM = 'folios.view';
export const CHARGES_CREATE_PERM = 'charges.create';
export const ADJUSTMENTS_CREATE_PERM = 'adjustments.create';
export const PAYMENTS_CREATE_PERM = 'payments.create';
export const NIGHTLY_BILLING_PERM = 'folios.manage';

export const FOLIO_STATUSES = ['open', 'closed'];
export const CHARGE_TYPES = ['room', 'service'];
export const ADJUSTMENT_TYPES = ['discount', 'additional_charge', 'correction'];
export const PAYMENT_METHODS = ['cash', 'card', 'bank_transfer', 'other'];

/** Generate a client-side idempotency key for payment posting. */
export function newIdempotencyKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback: timestamp + random hex (no crypto.randomUUID available)
  const hex = () =>
    Math.floor(Math.random() * 0xffffffff)
      .toString(16)
      .padStart(8, '0');
  return `${hex().slice(0, 8)}-${hex().slice(0, 4)}-4${hex().slice(1, 4)}-${hex().slice(0, 4)}-${hex()}${hex().slice(0, 4)}`;
}

/** PKR money formatting: 12500 -> "PKR 12,500". */
export function formatPKR(amount) {
  const n = Number(amount ?? 0);
  return `PKR ${n.toLocaleString('en-PK', { maximumFractionDigits: 2, minimumFractionDigits: 0 })}`;
}

/**
 * Compute folio totals from raw lines + payments (mirrors backend math).
 * charges: sum of room+service line amounts
 * discounts: sum of discount adjustment amounts (positive numbers)
 * payments: sum of payment amounts
 * balance = charges - discounts + additional/correction adjustments - payments
 * guestCredit = max(0, -balance)
 */
export function computeFolioTotals(lines = [], payments = []) {
  let charges = 0;
  let discounts = 0;
  let extraCharges = 0;
  for (const line of lines) {
    const amt = Number(line.amount ?? 0);
    if (line.line_type === 'room' || line.line_type === 'service') {
      charges += amt;
    } else if (line.line_type === 'adjustment') {
      if (line.adjustment_type === 'discount') discounts += amt;
      else extraCharges += amt;
    }
  }
  const paid = payments.reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const balance = charges - discounts + extraCharges - paid;
  return {
    charges: round2(charges),
    discounts: round2(discounts),
    extraCharges: round2(extraCharges),
    payments: round2(paid),
    balance: round2(balance),
    guestCredit: round2(Math.max(0, -balance)),
  };
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Unwrap paginated or plain list payloads. */
export function unwrapList(payload) {
  const data = payload?.data ?? payload ?? [];
  return Array.isArray(data) ? data : data.data ?? [];
}

/** Unwrap a single-resource payload ({data: {...}} or {...}). */
export function unwrapOne(payload) {
  return payload?.data?.data ?? payload?.data ?? payload;
}

/** Local YYYY-MM-DD. */
export function todayStr(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function guestDisplayName(guest = {}) {
  const name = `${guest.first_name ?? ''} ${guest.last_name ?? ''}`.trim();
  return name || guest.email || guest.phone || '—';
}
