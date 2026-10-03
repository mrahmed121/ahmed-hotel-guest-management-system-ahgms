import client from '../../../api/client';

function list(path, params = {}) {
  return client.get(path, { params }).then((r) => r.data);
}

export const reservationsApi = {
  list: (params) => list('/reservations', params),
  get: (id) => client.get(`/reservations/${id}`).then((r) => r.data),
  create: (data) => client.post('/reservations', data).then((r) => r.data),
  update: (id, data) => client.put(`/reservations/${id}`, data).then((r) => r.data),
  remove: (id) => client.delete(`/reservations/${id}`).then((r) => r.data),
  confirm: (id) => client.post(`/reservations/${id}/confirm`).then((r) => r.data),
  cancel: (id, data) => client.post(`/reservations/${id}/cancel`, data).then((r) => r.data),
  noShow: (id) => client.post(`/reservations/${id}/no-show`).then((r) => r.data),
};

export function availabilitySearch(params) {
  return client.get('/availability', { params }).then((r) => r.data);
}

export const RESERVATION_STATUSES = [
  'inquiry',
  'reserved',
  'confirmed',
  'checked_in',
  'checked_out',
  'cancelled',
  'no_show',
];

export const ACTIVE_RESERVATION_STATUSES = ['inquiry', 'reserved', 'confirmed'];

export const RESERVATION_SOURCES = [
  'walk_in',
  'phone',
  'website',
  'ota',
  'corporate',
  'travel_agent',
  'other',
];

/** Nights between two YYYY-MM-DD dates. Same-day = 0 (not a valid stay). */
export function nightsBetween(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  const a = new Date(`${checkIn}T00:00:00`);
  const b = new Date(`${checkOut}T00:00:00`);
  const diff = Math.round((b - a) / 86400000);
  return Number.isFinite(diff) && diff > 0 ? diff : 0;
}

/** Total estimate = nights × nightly rate. */
export function estimateTotal(checkIn, checkOut, nightlyRate) {
  const nights = nightsBetween(checkIn, checkOut);
  const rate = Number(nightlyRate) || 0;
  return nights * rate;
}

export function formatMoney(value, currency = 'PKR') {
  const n = Number(value) || 0;
  return `${currency} ${n.toLocaleString('en-PK', { maximumFractionDigits: 0 })}`;
}
