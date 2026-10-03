import client from '../../../api/client';

function list(path, params = {}) {
  return client.get(path, { params }).then((r) => r.data);
}

export const staysApi = {
  /** GET /stays?status=in_house — paginated stays with guest, room, reservation. */
  list: (params) => list('/stays', params),
  /** GET /stays/:id — stay with guest, room, reservation, room_history. */
  get: (id) => client.get(`/stays/${id}`).then((r) => r.data),
  /** POST /stays/check-in {reservation_id, room_id?, notes?} */
  checkIn: (data) => client.post('/stays/check-in', data).then((r) => r.data),
  /** POST /stays/walk-in {first_name, last_name, phone, email?, room_type_id, room_id?, check_out, adults?, children?, notes?} */
  walkIn: (data) => client.post('/stays/walk-in', data).then((r) => r.data),
  /** POST /stays/:id/check-out {notes?} */
  checkOut: (id, data = {}) => client.post(`/stays/${id}/check-out`, data).then((r) => r.data),
  /** POST /stays/:id/room-move {new_room_id, reason} */
  roomMove: (id, data) => client.post(`/stays/${id}/room-move`, data).then((r) => r.data),
};

export const STAY_STATUSES = ['in_house', 'checked_out'];

export const CHECK_IN_PERM = 'check-in';
export const CHECK_OUT_PERM = 'check-out';
export const ROOM_MOVE_PERM = 'room-move';
export const STAYS_VIEW_PERM = 'stays.view';

/** Local YYYY-MM-DD (avoids UTC-shift bugs from toISOString). */
export function todayStr(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
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

/** Stay is expected to depart on the given date (reservation.check_out). */
export function isDepartureToday(stay, today = todayStr()) {
  const res = stay.reservation ?? {};
  return res.check_out === today && stay.status === 'in_house';
}
