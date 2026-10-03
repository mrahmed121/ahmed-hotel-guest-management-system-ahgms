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
  staysApi,
  todayStr,
  unwrapList,
  unwrapOne,
  isDepartureToday,
  CHECK_IN_PERM,
  CHECK_OUT_PERM,
  ROOM_MOVE_PERM,
  STAYS_VIEW_PERM,
} from '../modules/frontdesk/services/frontdeskApi';

beforeEach(() => {
  vi.clearAllMocks();
  mockGet.mockResolvedValue({ data: { data: [] } });
  mockPost.mockResolvedValue({ data: {} });
  mockPut.mockResolvedValue({ data: {} });
  mockDel.mockResolvedValue({ data: {} });
});

describe('staysApi', () => {
  it('builds correct stay URLs', async () => {
    await staysApi.list({ status: 'in_house' });
    expect(mockGet).toHaveBeenCalledWith('/stays', { params: { status: 'in_house' } });

    await staysApi.get(7);
    expect(mockGet).toHaveBeenCalledWith('/stays/7');

    await staysApi.checkIn({ reservation_id: 3, room_id: 5, notes: 'Early arrival' });
    expect(mockPost).toHaveBeenCalledWith('/stays/check-in', {
      reservation_id: 3,
      room_id: 5,
      notes: 'Early arrival',
    });

    await staysApi.walkIn({
      first_name: 'Ali',
      last_name: 'Khan',
      phone: '03001234567',
      room_type_id: 2,
      check_out: '2026-10-05',
    });
    expect(mockPost).toHaveBeenCalledWith(
      '/stays/walk-in',
      expect.objectContaining({ first_name: 'Ali', room_type_id: 2, check_out: '2026-10-05' })
    );

    await staysApi.checkOut(7, { notes: 'Minibar checked' });
    expect(mockPost).toHaveBeenCalledWith('/stays/7/check-out', { notes: 'Minibar checked' });

    await staysApi.roomMove(7, { new_room_id: 9, reason: 'AC not working' });
    expect(mockPost).toHaveBeenCalledWith('/stays/7/room-move', {
      new_room_id: 9,
      reason: 'AC not working',
    });
  });
});

describe('permission constants', () => {
  it('uses the documented permission slugs', () => {
    expect(STAYS_VIEW_PERM).toBe('stays.view');
    expect(CHECK_IN_PERM).toBe('check-in');
    expect(CHECK_OUT_PERM).toBe('check-out');
    expect(ROOM_MOVE_PERM).toBe('room-move');
  });
});

describe('todayStr', () => {
  it('formats a fixed date as YYYY-MM-DD', () => {
    expect(todayStr(new Date(2026, 9, 3))).toBe('2026-10-03');
  });

  it('zero-pads month and day', () => {
    expect(todayStr(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('returns a 10-char date string by default', () => {
    expect(todayStr()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('unwrapList', () => {
  it('unwraps Laravel paginated payloads', () => {
    expect(unwrapList({ data: { data: [{ id: 1 }] } })).toEqual([{ id: 1 }]);
  });

  it('unwraps {data: []} payloads', () => {
    expect(unwrapList({ data: [{ id: 2 }] })).toEqual([{ id: 2 }]);
  });

  it('passes through plain arrays', () => {
    expect(unwrapList([{ id: 3 }])).toEqual([{ id: 3 }]);
  });

  it('returns [] for null/undefined', () => {
    expect(unwrapList(null)).toEqual([]);
    expect(unwrapList(undefined)).toEqual([]);
  });
});

describe('unwrapOne', () => {
  it('unwraps nested data payloads', () => {
    expect(unwrapOne({ data: { data: { id: 1 } } })).toEqual({ id: 1 });
  });

  it('unwraps single data payloads', () => {
    expect(unwrapOne({ data: { id: 2 } })).toEqual({ id: 2 });
  });

  it('passes through plain objects', () => {
    expect(unwrapOne({ id: 3 })).toEqual({ id: 3 });
  });
});

describe('isDepartureToday', () => {
  const today = '2026-10-03';

  it('is true for in-house stays checking out today', () => {
    expect(
      isDepartureToday({ status: 'in_house', reservation: { check_out: '2026-10-03' } }, today)
    ).toBe(true);
  });

  it('is false for a different checkout date', () => {
    expect(
      isDepartureToday({ status: 'in_house', reservation: { check_out: '2026-10-04' } }, today)
    ).toBe(false);
  });

  it('is false for checked-out stays even with today checkout', () => {
    expect(
      isDepartureToday({ status: 'checked_out', reservation: { check_out: '2026-10-03' } }, today)
    ).toBe(false);
  });

  it('is false when reservation is missing', () => {
    expect(isDepartureToday({ status: 'in_house' }, today)).toBe(false);
  });
});
