import client from '../../../api/client';

function list(path, params = {}) {
  return client.get(path, { params }).then((r) => r.data);
}

export const guestsApi = {
  list: (params) => list('/guests', params),
  get: (id) => client.get(`/guests/${id}`).then((r) => r.data),
  create: (data) => client.post('/guests', data).then((r) => r.data),
  update: (id, data) => client.put(`/guests/${id}`, data).then((r) => r.data),
  remove: (id) => client.delete(`/guests/${id}`).then((r) => r.data),
  blacklist: (id) => client.post(`/guests/${id}/blacklist`).then((r) => r.data),
  unblacklist: (id) => client.post(`/guests/${id}/unblacklist`).then((r) => r.data),
  reservations: (id) => list(`/guests/${id}/reservations`),
};

export const GUEST_STATUSES = ['active', 'blacklisted'];

export const ID_TYPES = [
  'passport',
  'national_id',
  'driving_license',
  'other',
];
