import client from '../../../api/client';

function list(path, params = {}) {
  return client.get(path, { params }).then((r) => r.data);
}

/**
 * Operations API — housekeeping, maintenance, and hotel services.
 *
 * Contract (backend P6):
 *  Housekeeping:
 *   GET    /housekeeping-tasks                 paginated tasks w/ room, assigned user
 *   POST   /housekeeping-tasks                 {room_id, priority?, notes?}
 *   GET    /housekeeping-tasks/:id
 *   PUT    /housekeeping-tasks/:id             {priority?, notes?}
 *   POST   /housekeeping-tasks/:id/assign      {user_id}
 *   POST   /housekeeping-tasks/:id/start
 *   POST   /housekeeping-tasks/:id/complete
 *   POST   /housekeeping-tasks/:id/inspect     {passed: bool, notes?}
 *  Maintenance:
 *   GET    /maintenance-tickets                paginated tickets w/ room, assignee
 *   POST   /maintenance-tickets                {room_id?, category, priority, title, description}
 *   GET    /maintenance-tickets/:id
 *   PUT    /maintenance-tickets/:id
 *   DELETE /maintenance-tickets/:id
 *   POST   /maintenance-tickets/:id/assign     {user_id}
 *   POST   /maintenance-tickets/:id/complete
 *   POST   /maintenance-tickets/:id/verify
 *  Services:
 *   GET    /services                           service catalog
 *   POST   /services                           {name, code, unit_price, taxable?, active?}
 *   GET    /services/:id
 *   PUT    /services/:id
 *   DELETE /services/:id
 *  Users (for assignment dropdowns):
 *   GET    /users                              user list
 */
export const housekeepingApi = {
  list: (params) => list('/housekeeping-tasks', params),
  get: (id) => client.get(`/housekeeping-tasks/${id}`).then((r) => r.data),
  create: (data) => client.post('/housekeeping-tasks', data).then((r) => r.data),
  update: (id, data) => client.put(`/housekeeping-tasks/${id}`, data).then((r) => r.data),
  assign: (id, userId) =>
    client.post(`/housekeeping-tasks/${id}/assign`, { user_id: userId }).then((r) => r.data),
  start: (id) => client.post(`/housekeeping-tasks/${id}/start`).then((r) => r.data),
  complete: (id) => client.post(`/housekeeping-tasks/${id}/complete`).then((r) => r.data),
  inspect: (id, passed, notes) =>
    client
      .post(`/housekeeping-tasks/${id}/inspect`, { passed, notes: notes ?? null })
      .then((r) => r.data),
};

export const maintenanceApi = {
  list: (params) => list('/maintenance-tickets', params),
  get: (id) => client.get(`/maintenance-tickets/${id}`).then((r) => r.data),
  create: (data) => client.post('/maintenance-tickets', data).then((r) => r.data),
  update: (id, data) => client.put(`/maintenance-tickets/${id}`, data).then((r) => r.data),
  remove: (id) => client.delete(`/maintenance-tickets/${id}`).then((r) => r.data),
  assign: (id, userId) =>
    client.post(`/maintenance-tickets/${id}/assign`, { user_id: userId }).then((r) => r.data),
  complete: (id) => client.post(`/maintenance-tickets/${id}/complete`).then((r) => r.data),
  verify: (id) => client.post(`/maintenance-tickets/${id}/verify`).then((r) => r.data),
};

export const servicesApi = {
  list: (params) => list('/services', params),
  get: (id) => client.get(`/services/${id}`).then((r) => r.data),
  create: (data) => client.post('/services', data).then((r) => r.data),
  update: (id, data) => client.put(`/services/${id}`, data).then((r) => r.data),
  remove: (id) => client.delete(`/services/${id}`).then((r) => r.data),
};

export const usersApi = {
  list: (params) => list('/users', params),
};

export const HOUSEKEEPING_VIEW_PERM = 'housekeeping.view';
export const HOUSEKEEPING_MANAGE_PERM = 'housekeeping.manage';
export const MAINTENANCE_VIEW_PERM = 'maintenance.view';
export const MAINTENANCE_MANAGE_PERM = 'maintenance.manage';
export const SERVICES_VIEW_PERM = 'services.view';
export const SERVICES_MANAGE_PERM = 'services.manage';

export const TASK_STATUSES = ['dirty', 'assigned', 'cleaning', 'inspection', 'ready'];
export const TASK_PRIORITIES = ['low', 'normal', 'high', 'urgent'];
export const TICKET_STATUSES = ['open', 'triaged', 'assigned', 'in_progress', 'completed', 'verified', 'closed'];
export const TICKET_CATEGORIES = ['ac', 'plumbing', 'electrical', 'furniture', 'tv', 'water', 'other'];
export const TICKET_PRIORITIES = ['low', 'normal', 'high', 'urgent'];

/** Extract a list of rows from a paginated or plain API payload. */
export function unwrapList(payload) {
  const data = payload?.data ?? payload ?? [];
  if (Array.isArray(data)) return data;
  const inner = data?.data;
  return Array.isArray(inner) ? inner : [];
}

/** Extract pagination meta when present. */
export function unwrapMeta(payload) {
  const data = payload?.data;
  const meta = data?.meta ?? payload?.meta ?? null;
  return meta;
}

/** Human-readable priority label with dot color class. */
export const PRIORITY_DOT = {
  low: 'bg-slate-400',
  normal: 'bg-sky-400',
  high: 'bg-amber-400',
  urgent: 'bg-red-500',
};

export function formatDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
