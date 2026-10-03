import client from '../../../api/client';

function list(path, params = {}) {
  return client.get(path, { params }).then((r) => r.data);
}

export const floorsApi = {
  list: (params) => list('/floors', params),
  get: (id) => client.get(`/floors/${id}`).then((r) => r.data),
  create: (data) => client.post('/floors', data).then((r) => r.data),
  update: (id, data) => client.put(`/floors/${id}`, data).then((r) => r.data),
  remove: (id) => client.delete(`/floors/${id}`).then((r) => r.data),
};

export const roomTypesApi = {
  list: (params) => list('/room-types', params),
  get: (id) => client.get(`/room-types/${id}`).then((r) => r.data),
  create: (data) => client.post('/room-types', data).then((r) => r.data),
  update: (id, data) => client.put(`/room-types/${id}`, data).then((r) => r.data),
  remove: (id) => client.delete(`/room-types/${id}`).then((r) => r.data),
};

export const roomsApi = {
  list: (params) => list('/rooms', params),
  get: (id) => client.get(`/rooms/${id}`).then((r) => r.data),
  create: (data) => client.post('/rooms', data).then((r) => r.data),
  update: (id, data) => client.put(`/rooms/${id}`, data).then((r) => r.data),
  remove: (id) => client.delete(`/rooms/${id}`).then((r) => r.data),
};

export const amenitiesApi = {
  list: (params) => list('/amenities', params),
  create: (data) => client.post('/amenities', data).then((r) => r.data),
  update: (id, data) => client.put(`/amenities/${id}`, data).then((r) => r.data),
  remove: (id) => client.delete(`/amenities/${id}`).then((r) => r.data),
};

export const ratePlansApi = {
  list: (params) => list('/rate-plans', params),
  get: (id) => client.get(`/rate-plans/${id}`).then((r) => r.data),
  create: (data) => client.post('/rate-plans', data).then((r) => r.data),
  update: (id, data) => client.put(`/rate-plans/${id}`, data).then((r) => r.data),
  remove: (id) => client.delete(`/rate-plans/${id}`).then((r) => r.data),
};

export const ROOM_STATUSES = [
  'available',
  'reserved',
  'occupied',
  'dirty',
  'cleaning',
  'maintenance',
  'out_of_service',
];

export const MANAGEABLE_ROOM_STATUSES = ['available', 'maintenance', 'out_of_service'];
