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
  reservationsApi,
  availabilitySearch,
  nightsBetween,
  estimateTotal,
  formatMoney,
} from '../modules/reservations/services/reservationApi';
import { guestsApi } from '../modules/guests/services/guestApi';

beforeEach(() => {
  vi.clearAllMocks();
  mockGet.mockResolvedValue({ data: { data: [] } });
  mockPost.mockResolvedValue({ data: {} });
  mockPut.mockResolvedValue({ data: {} });
  mockDel.mockResolvedValue({ data: {} });
});

describe('reservationsApi', () => {
  it('builds correct reservation URLs', async () => {
    await reservationsApi.list({ status: 'confirmed' });
    expect(mockGet).toHaveBeenCalledWith('/reservations', { params: { status: 'confirmed' } });

    await reservationsApi.create({ guest_id: 1, check_in: '2026-10-10', check_out: '2026-10-12' });
    expect(mockPost).toHaveBeenCalledWith('/reservations', {
      guest_id: 1,
      check_in: '2026-10-10',
      check_out: '2026-10-12',
    });

    await reservationsApi.confirm(5);
    expect(mockPost).toHaveBeenCalledWith('/reservations/5/confirm');

    await reservationsApi.cancel(5, { reason: 'Guest request' });
    expect(mockPost).toHaveBeenCalledWith('/reservations/5/cancel', { reason: 'Guest request' });

    await reservationsApi.noShow(5);
    expect(mockPost).toHaveBeenCalledWith('/reservations/5/no-show');
  });

  it('availabilitySearch builds the correct URL and params', async () => {
    mockGet.mockResolvedValue({ data: { data: [{ room: { id: 1 } }] } });
    await availabilitySearch({
      check_in: '2026-10-10',
      check_out: '2026-10-12',
      room_type_id: 2,
      adults: 2,
    });
    expect(mockGet).toHaveBeenCalledWith('/availability', {
      params: {
        check_in: '2026-10-10',
        check_out: '2026-10-12',
        room_type_id: 2,
        adults: 2,
      },
    });
  });

  it('guestsApi builds correct URLs', async () => {
    await guestsApi.list({ search: 'ali' });
    expect(mockGet).toHaveBeenCalledWith('/guests', { params: { search: 'ali' } });

    await guestsApi.blacklist(3);
    expect(mockPost).toHaveBeenCalledWith('/guests/3/blacklist');

    await guestsApi.unblacklist(3);
    expect(mockPost).toHaveBeenCalledWith('/guests/3/unblacklist');
  });
});

describe('nightsBetween', () => {
  it('counts nights for a normal stay', () => {
    expect(nightsBetween('2026-10-10', '2026-10-12')).toBe(2);
  });

  it('counts 1 night for consecutive dates', () => {
    expect(nightsBetween('2026-10-10', '2026-10-11')).toBe(1);
  });

  it('returns 0 for same-day or inverted dates', () => {
    expect(nightsBetween('2026-10-10', '2026-10-10')).toBe(0);
    expect(nightsBetween('2026-10-12', '2026-10-10')).toBe(0);
  });

  it('returns 0 for missing dates', () => {
    expect(nightsBetween(null, '2026-10-10')).toBe(0);
    expect(nightsBetween('2026-10-10', '')).toBe(0);
  });

  it('handles month boundaries', () => {
    expect(nightsBetween('2026-10-30', '2026-11-02')).toBe(3);
  });
});

describe('estimateTotal', () => {
  it('multiplies nights by nightly rate', () => {
    expect(estimateTotal('2026-10-10', '2026-10-13', 9500)).toBe(28500);
  });

  it('returns 0 for invalid dates', () => {
    expect(estimateTotal('2026-10-10', '2026-10-10', 9500)).toBe(0);
  });

  it('returns 0 for missing rate', () => {
    expect(estimateTotal('2026-10-10', '2026-10-12', null)).toBe(0);
  });

  it('handles string rates', () => {
    expect(estimateTotal('2026-10-10', '2026-10-12', '5000')).toBe(10000);
  });
});

describe('formatMoney', () => {
  it('formats with PKR prefix', () => {
    expect(formatMoney(28500)).toBe('PKR 28,500');
  });

  it('handles zero and null', () => {
    expect(formatMoney(0)).toBe('PKR 0');
    expect(formatMoney(null)).toBe('PKR 0');
  });
});
