import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPut = vi.fn();
const mockDel = vi.fn();

vi.mock('../api/client', () => ({
  default: {
    get: (...args) => mockGet(...args),
    post: (...args) => mockPost(...args),
    put: (...args) => mockPut(...args),
    delete: (...args) => mockDel(...args),
  },
}));

import {
  floorsApi,
  roomTypesApi,
  roomsApi,
  amenitiesApi,
  ratePlansApi,
} from '../modules/inventory/services/inventoryApi';

beforeEach(() => {
  vi.clearAllMocks();
  mockGet.mockResolvedValue({ data: { data: [] } });
  mockPost.mockResolvedValue({ data: {} });
  mockPut.mockResolvedValue({ data: {} });
  mockDel.mockResolvedValue({ data: {} });
});

describe('inventoryApi', () => {
  it('floorsApi builds correct URLs', async () => {
    await floorsApi.list({ per_page: 50 });
    expect(mockGet).toHaveBeenCalledWith('/floors', { params: { per_page: 50 } });
    await floorsApi.create({ number: 1, name: 'Ground' });
    expect(mockPost).toHaveBeenCalledWith('/floors', { number: 1, name: 'Ground' });
    await floorsApi.update(3, { name: 'Lobby Level' });
    expect(mockPut).toHaveBeenCalledWith('/floors/3', { name: 'Lobby Level' });
    await floorsApi.remove(3);
    expect(mockDel).toHaveBeenCalledWith('/floors/3');
  });

  it('roomTypesApi builds correct URLs', async () => {
    await roomTypesApi.list();
    expect(mockGet).toHaveBeenCalledWith('/room-types', { params: {} });
    await roomTypesApi.create({ name: 'Deluxe', base_rate: 9500 });
    expect(mockPost).toHaveBeenCalledWith('/room-types', { name: 'Deluxe', base_rate: 9500 });
    await roomTypesApi.remove(7);
    expect(mockDel).toHaveBeenCalledWith('/room-types/7');
  });

  it('roomsApi builds correct URLs with filters', async () => {
    await roomsApi.list({ status: 'available', floor_id: 2 });
    expect(mockGet).toHaveBeenCalledWith('/rooms', {
      params: { status: 'available', floor_id: 2 },
    });
    await roomsApi.create({ number: '101', status: 'available' });
    expect(mockPost).toHaveBeenCalledWith('/rooms', { number: '101', status: 'available' });
  });

  it('amenitiesApi and ratePlansApi build correct URLs', async () => {
    await amenitiesApi.list();
    expect(mockGet).toHaveBeenCalledWith('/amenities', { params: {} });
    await ratePlansApi.create({ name: 'Summer', base_rate: 8000 });
    expect(mockPost).toHaveBeenCalledWith('/rate-plans', { name: 'Summer', base_rate: 8000 });
    await ratePlansApi.update(2, { base_rate: 8500 });
    expect(mockPut).toHaveBeenCalledWith('/rate-plans/2', { base_rate: 8500 });
  });
});
