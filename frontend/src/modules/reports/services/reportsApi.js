import client from '../../../api/client';

/**
 * Reports & Dashboard API — AHGMS P7.
 *
 * Contract:
 *  GET /dashboard
 *    → { occupancy_today, arrivals_today, departures_today, in_house,
 *        revenue_mtd: { room, service, total }, outstanding_balance,
 *        housekeeping_queue: { dirty, assigned, cleaning, inspection },
 *        maintenance_open, recent_stays: [] }
 *  GET /reports/occupancy?start_date=&end_date=
 *    → { nights, total_rooms, occupied_room_nights, occupancy_rate }
 *  GET /reports/adr?start_date=&end_date=
 *    → { total_room_revenue, occupied_room_nights, adr }
 *  GET /reports/revpar?start_date=&end_date=
 *    → { revpar }
 *  GET /reports/revenue?start_date=&end_date=
 *    → { by_type: { room, service, ... }, payments_total, outstanding }
 *  GET /reports/reservations?start_date=&end_date=
 *    → { by_status: {...}, total_estimate }
 *  GET /reports/front-desk → { arrivals[], departures[], in_house_count }
 *  GET /reports/housekeeping → { by_status: {...}, overdue[] }
 *  GET /reports/maintenance → { by_status: {...}, urgent_open[] }
 */

export const DASHBOARD_VIEW_PERM = 'dashboard.view';
export const REPORTS_VIEW_PERM = 'reports.view';

export function formatPKR(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 'PKR 0';
  return 'PKR ' + v.toLocaleString('en-PK', { maximumFractionDigits: 0 });
}

export function formatPct(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return v.toFixed(1) + '%';
}

export function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Today as YYYY-MM-DD (local). */
export function todayStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** First day of the current month as YYYY-MM-DD. */
export function monthStartStr(d = new Date()) {
  return todayStr(new Date(d.getFullYear(), d.getMonth(), 1));
}

/**
 * Occupancy rate: occupied room-nights ÷ available room-nights × 100.
 * Returns null when there is nothing to divide (no rooms / no nights).
 */
export function calcOccupancyRate(occupiedRoomNights, totalRooms, nights) {
  const occupied = Number(occupiedRoomNights);
  const rooms = Number(totalRooms);
  const n = Number(nights);
  if (!Number.isFinite(occupied) || !Number.isFinite(rooms) || !Number.isFinite(n)) return null;
  const available = rooms * n;
  if (available <= 0) return null;
  return (occupied / available) * 100;
}

/**
 * ADR (Average Daily Rate): total room revenue ÷ occupied room-nights.
 * Returns null when occupied nights is zero.
 */
export function calcADR(totalRoomRevenue, occupiedRoomNights) {
  const rev = Number(totalRoomRevenue);
  const nights = Number(occupiedRoomNights);
  if (!Number.isFinite(rev) || !Number.isFinite(nights) || nights <= 0) return null;
  return rev / nights;
}

/**
 * RevPAR (Revenue Per Available Room): ADR × occupancy rate (as fraction).
 * Also equals total room revenue ÷ available room-nights.
 */
export function calcRevPAR(adr, occupancyRatePct) {
  const a = Number(adr);
  const occ = Number(occupancyRatePct);
  if (!Number.isFinite(a) || !Number.isFinite(occ)) return null;
  return a * (occ / 100);
}

export function calcRevPARFromRevenue(totalRoomRevenue, totalRooms, nights) {
  const rev = Number(totalRoomRevenue);
  const rooms = Number(totalRooms);
  const n = Number(nights);
  if (!Number.isFinite(rev) || !Number.isFinite(rooms) || !Number.isFinite(n)) return null;
  const available = rooms * n;
  if (available <= 0) return null;
  return rev / available;
}

export const reportsApi = {
  dashboard: () => client.get('/dashboard').then((r) => r.data),
  occupancy: (startDate, endDate) =>
    client.get('/reports/occupancy', { params: { start_date: startDate, end_date: endDate } }).then((r) => r.data),
  adr: (startDate, endDate) =>
    client.get('/reports/adr', { params: { start_date: startDate, end_date: endDate } }).then((r) => r.data),
  revpar: (startDate, endDate) =>
    client.get('/reports/revpar', { params: { start_date: startDate, end_date: endDate } }).then((r) => r.data),
  revenue: (startDate, endDate) =>
    client.get('/reports/revenue', { params: { start_date: startDate, end_date: endDate } }).then((r) => r.data),
  reservations: (startDate, endDate) =>
    client.get('/reports/reservations', { params: { start_date: startDate, end_date: endDate } }).then((r) => r.data),
  frontDesk: () => client.get('/reports/front-desk').then((r) => r.data),
  housekeeping: () => client.get('/reports/housekeeping').then((r) => r.data),
  maintenance: () => client.get('/reports/maintenance').then((r) => r.data),
};
