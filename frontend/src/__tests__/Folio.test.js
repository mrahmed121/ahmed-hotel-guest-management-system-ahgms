import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGet = vi.fn();
const mockPost = vi.fn();

vi.mock('../api/client', () => ({
  default: {
    get: (...args) => mockGet(...args),
    post: (...args) => mockPost(...args),
  },
}));

import {
  foliosApi,
  computeFolioTotals,
  newIdempotencyKey,
  formatPKR,
  unwrapList,
  unwrapOne,
  todayStr,
  FOLIOS_VIEW_PERM,
  CHARGES_CREATE_PERM,
  ADJUSTMENTS_CREATE_PERM,
  PAYMENTS_CREATE_PERM,
  NIGHTLY_BILLING_PERM,
} from '../modules/folio/services/folioApi';

beforeEach(() => {
  vi.clearAllMocks();
  mockGet.mockResolvedValue({ data: {} });
  mockPost.mockResolvedValue({ data: {} });
});

describe('foliosApi', () => {
  it('builds correct folio URLs', async () => {
    await foliosApi.list({ status: 'open' });
    expect(mockGet).toHaveBeenCalledWith('/folios', { params: { status: 'open' } });

    await foliosApi.get(12);
    expect(mockGet).toHaveBeenCalledWith('/folios/12');

    await foliosApi.totals(12);
    expect(mockGet).toHaveBeenCalledWith('/folios/12/totals');

    await foliosApi.addCharge(12, {
      line_type: 'service',
      description: 'Minibar',
      quantity: 2,
      unit_price: 500,
    });
    expect(mockPost).toHaveBeenCalledWith('/folios/12/charges', {
      line_type: 'service',
      description: 'Minibar',
      quantity: 2,
      unit_price: 500,
    });

    await foliosApi.addAdjustment(12, {
      type: 'discount',
      amount: 1500,
      reason: 'Goodwill',
    });
    expect(mockPost).toHaveBeenCalledWith('/folios/12/adjustments', {
      type: 'discount',
      amount: 1500,
      reason: 'Goodwill',
    });

    await foliosApi.recordPayment(12, {
      method: 'card',
      amount: 10000,
      idempotency_key: 'key-123',
    });
    expect(mockPost).toHaveBeenCalledWith(
      '/folios/12/payments',
      expect.objectContaining({ method: 'card', amount: 10000, idempotency_key: 'key-123' })
    );

    await foliosApi.runNightlyBilling('2026-10-03');
    expect(mockPost).toHaveBeenCalledWith('/billing/nightly', { date: '2026-10-03' });
  });

  it('byStay queries folios by stay_id and returns the first match', async () => {
    mockGet.mockResolvedValue({ data: { data: [{ id: 5, folio_number: 'FL-0001' }] } });
    const folio = await foliosApi.byStay(9);
    expect(mockGet).toHaveBeenCalledWith('/folios', { params: { stay_id: 9, per_page: 1 } });
    expect(folio).toEqual({ id: 5, folio_number: 'FL-0001' });
  });

  it('byStay returns null when no folio exists', async () => {
    mockGet.mockResolvedValue({ data: { data: [] } });
    expect(await foliosApi.byStay(9)).toBeNull();
  });
});

describe('permission constants', () => {
  it('uses the documented permission slugs', () => {
    expect(FOLIOS_VIEW_PERM).toBe('folios.view');
    expect(CHARGES_CREATE_PERM).toBe('charges.create');
    expect(ADJUSTMENTS_CREATE_PERM).toBe('adjustments.create');
    expect(PAYMENTS_CREATE_PERM).toBe('payments.create');
    expect(NIGHTLY_BILLING_PERM).toBe('folios.manage');
  });
});

describe('computeFolioTotals', () => {
  const lines = [
    { line_type: 'room', amount: 20000 },
    { line_type: 'room', amount: 20000 },
    { line_type: 'service', amount: 2500 },
    { line_type: 'adjustment', adjustment_type: 'discount', amount: 2000 },
    { line_type: 'adjustment', adjustment_type: 'additional_charge', amount: 500 },
  ];
  const payments = [{ amount: 15000 }, { amount: 5000 }];

  it('computes charges - discounts + extra charges - payments = balance', () => {
    const t = computeFolioTotals(lines, payments);
    expect(t.charges).toBe(42500);
    expect(t.discounts).toBe(2000);
    expect(t.payments).toBe(20000);
    // 42500 - 2000 + 500 - 20000 = 21000
    expect(t.balance).toBe(21000);
    expect(t.guestCredit).toBe(0);
  });

  it('computes guest credit when overpaid', () => {
    const t = computeFolioTotals([{ line_type: 'room', amount: 10000 }], [{ amount: 12000 }]);
    expect(t.balance).toBe(-2000);
    expect(t.guestCredit).toBe(2000);
  });

  it('handles empty lines and payments', () => {
    const t = computeFolioTotals([], []);
    expect(t).toEqual({
      charges: 0,
      discounts: 0,
      extraCharges: 0,
      payments: 0,
      balance: 0,
      guestCredit: 0,
    });
  });

  it('rounds to 2 decimals', () => {
    const t = computeFolioTotals([{ line_type: 'service', amount: 100.005 }], []);
    expect(t.charges).toBe(100.01);
  });
});

describe('newIdempotencyKey', () => {
  it('generates unique UUID-like keys', () => {
    const a = newIdempotencyKey();
    const b = newIdempotencyKey();
    expect(typeof a).toBe('string');
    expect(a.length).toBeGreaterThan(10);
    expect(a).not.toBe(b);
  });

  it('matches UUID format when crypto.randomUUID is available', () => {
    const key = newIdempotencyKey();
    expect(key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });
});

describe('formatPKR', () => {
  it('formats amounts with PKR prefix and thousands separators', () => {
    expect(formatPKR(12500)).toBe('PKR 12,500');
    expect(formatPKR(0)).toBe('PKR 0');
  });

  it('handles null/undefined as zero', () => {
    expect(formatPKR(null)).toBe('PKR 0');
    expect(formatPKR(undefined)).toBe('PKR 0');
  });
});

describe('unwrapList / unwrapOne', () => {
  it('unwraps Laravel paginated payloads', () => {
    expect(unwrapList({ data: { data: [{ id: 1 }] } })).toEqual([{ id: 1 }]);
    expect(unwrapOne({ data: { data: { id: 2 } } })).toEqual({ id: 2 });
  });

  it('returns [] for null lists', () => {
    expect(unwrapList(null)).toEqual([]);
  });
});

describe('todayStr', () => {
  it('formats a fixed date as YYYY-MM-DD', () => {
    expect(todayStr(new Date(2026, 9, 3))).toBe('2026-10-03');
  });
});
