import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPut = vi.fn();
const mockDelete = vi.fn();

vi.mock('../api/client', () => ({
  default: {
    get: (...args) => mockGet(...args),
    post: (...args) => mockPost(...args),
    put: (...args) => mockPut(...args),
    delete: (...args) => mockDelete(...args),
  },
}));

import {
  housekeepingApi,
  maintenanceApi,
  servicesApi,
  usersApi,
  unwrapList,
  unwrapMeta,
  TASK_STATUSES,
  TICKET_STATUSES,
  TICKET_CATEGORIES,
  HOUSEKEEPING_VIEW_PERM,
  HOUSEKEEPING_MANAGE_PERM,
  MAINTENANCE_VIEW_PERM,
  MAINTENANCE_MANAGE_PERM,
  SERVICES_VIEW_PERM,
  SERVICES_MANAGE_PERM,
  formatDateTime,
} from '../modules/operations/services/operationsApi';

beforeEach(() => {
  vi.clearAllMocks();
  mockGet.mockResolvedValue({ data: {} });
  mockPost.mockResolvedValue({ data: {} });
  mockPut.mockResolvedValue({ data: {} });
  mockDelete.mockResolvedValue({ data: {} });
});

describe('housekeepingApi', () => {
  it('builds correct housekeeping URLs', async () => {
    await housekeepingApi.list({ status: 'dirty' });
    expect(mockGet).toHaveBeenCalledWith('/housekeeping-tasks', { params: { status: 'dirty' } });

    await housekeepingApi.get(7);
    expect(mockGet).toHaveBeenCalledWith('/housekeeping-tasks/7');

    await housekeepingApi.create({ room_id: 3, priority: 'high' });
    expect(mockPost).toHaveBeenCalledWith('/housekeeping-tasks', { room_id: 3, priority: 'high' });

    await housekeepingApi.update(7, { priority: 'urgent' });
    expect(mockPut).toHaveBeenCalledWith('/housekeeping-tasks/7', { priority: 'urgent' });

    await housekeepingApi.assign(7, 42);
    expect(mockPost).toHaveBeenCalledWith('/housekeeping-tasks/7/assign', { user_id: 42 });

    await housekeepingApi.start(7);
    expect(mockPost).toHaveBeenCalledWith('/housekeeping-tasks/7/start');

    await housekeepingApi.complete(7);
    expect(mockPost).toHaveBeenCalledWith('/housekeeping-tasks/7/complete');

    await housekeepingApi.inspect(7, true, 'All good');
    expect(mockPost).toHaveBeenCalledWith('/housekeeping-tasks/7/inspect', {
      passed: true,
      notes: 'All good',
    });

    await housekeepingApi.inspect(8, false);
    expect(mockPost).toHaveBeenCalledWith('/housekeeping-tasks/8/inspect', {
      passed: false,
      notes: null,
    });
  });
});

describe('maintenanceApi', () => {
  it('builds correct maintenance URLs', async () => {
    await maintenanceApi.list({ status: 'open' });
    expect(mockGet).toHaveBeenCalledWith('/maintenance-tickets', { params: { status: 'open' } });

    await maintenanceApi.get(5);
    expect(mockGet).toHaveBeenCalledWith('/maintenance-tickets/5');

    await maintenanceApi.create({ title: 'AC broken', category: 'ac', priority: 'high', description: 'x' });
    expect(mockPost).toHaveBeenCalledWith(
      '/maintenance-tickets',
      expect.objectContaining({ title: 'AC broken', category: 'ac' })
    );

    await maintenanceApi.update(5, { status: 'triaged' });
    expect(mockPut).toHaveBeenCalledWith('/maintenance-tickets/5', { status: 'triaged' });

    await maintenanceApi.remove(5);
    expect(mockDelete).toHaveBeenCalledWith('/maintenance-tickets/5');

    await maintenanceApi.assign(5, 9);
    expect(mockPost).toHaveBeenCalledWith('/maintenance-tickets/5/assign', { user_id: 9 });

    await maintenanceApi.complete(5);
    expect(mockPost).toHaveBeenCalledWith('/maintenance-tickets/5/complete');

    await maintenanceApi.verify(5);
    expect(mockPost).toHaveBeenCalledWith('/maintenance-tickets/5/verify');
  });
});

describe('servicesApi', () => {
  it('builds correct service catalog URLs', async () => {
    await servicesApi.list();
    expect(mockGet).toHaveBeenCalledWith('/services', { params: {} });

    await servicesApi.get(3);
    expect(mockGet).toHaveBeenCalledWith('/services/3');

    await servicesApi.create({ name: 'Breakfast', code: 'BRKFST', unit_price: 1500 });
    expect(mockPost).toHaveBeenCalledWith(
      '/services',
      expect.objectContaining({ name: 'Breakfast', code: 'BRKFST' })
    );

    await servicesApi.update(3, { active: false });
    expect(mockPut).toHaveBeenCalledWith('/services/3', { active: false });

    await servicesApi.remove(3);
    expect(mockDelete).toHaveBeenCalledWith('/services/3');
  });
});

describe('usersApi', () => {
  it('lists users for assignment dropdowns', async () => {
    await usersApi.list({ per_page: 100 });
    expect(mockGet).toHaveBeenCalledWith('/users', { params: { per_page: 100 } });
  });
});

describe('operations helpers', () => {
  it('exposes task and ticket status constants', () => {
    expect(TASK_STATUSES).toEqual(['dirty', 'assigned', 'cleaning', 'inspection', 'ready']);
    expect(TICKET_STATUSES).toContain('open');
    expect(TICKET_STATUSES).toContain('closed');
    expect(TICKET_CATEGORIES).toContain('plumbing');
  });

  it('exposes permission constants', () => {
    expect(HOUSEKEEPING_VIEW_PERM).toBe('housekeeping.view');
    expect(HOUSEKEEPING_MANAGE_PERM).toBe('housekeeping.manage');
    expect(MAINTENANCE_VIEW_PERM).toBe('maintenance.view');
    expect(MAINTENANCE_MANAGE_PERM).toBe('maintenance.manage');
    expect(SERVICES_VIEW_PERM).toBe('services.view');
    expect(SERVICES_MANAGE_PERM).toBe('services.manage');
  });

  it('unwrapList handles paginated and plain payloads', () => {
    expect(unwrapList({ data: { data: [{ id: 1 }], meta: {} } })).toEqual([{ id: 1 }]);
    expect(unwrapList({ data: [{ id: 2 }] })).toEqual([{ id: 2 }]);
    expect(unwrapList(null)).toEqual([]);
  });

  it('unwrapMeta returns pagination meta when present', () => {
    expect(unwrapMeta({ data: { data: [], meta: { total: 5 } } })).toEqual({ total: 5 });
    expect(unwrapMeta({})).toBeNull();
  });

  it('formatDateTime handles null and invalid values', () => {
    expect(formatDateTime(null)).toBe('—');
    expect(formatDateTime('not-a-date')).toBe('not-a-date');
    expect(formatDateTime('2026-10-03T10:00:00Z')).toContain('Oct');
  });
});
