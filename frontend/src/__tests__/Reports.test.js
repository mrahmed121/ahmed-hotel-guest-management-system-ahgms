import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGet = vi.fn();

vi.mock('../api/client', () => ({
  default: {
    get: (...args) => mockGet(...args),
  },
}));

import {
  reportsApi,
  formatPKR,
  formatPct,
  num,
  todayStr,
  monthStartStr,
  calcOccupancyRate,
  calcADR,
  calcRevPAR,
  calcRevPARFromRevenue,
  DASHBOARD_VIEW_PERM,
  REPORTS_VIEW_PERM,
} from '../modules/reports/services/reportsApi';

beforeEach(() => {
  vi.clearAllMocks();
  mockGet.mockResolvedValue({ data: {} });
});

describe('reportsApi', () => {
  it('builds correct endpoint URLs', async () => {
    await reportsApi.dashboard();
    expect(mockGet).toHaveBeenCalledWith('/dashboard');

    await reportsApi.occupancy('2026-10-01', '2026-10-31');
    expect(mockGet).toHaveBeenCalledWith('/reports/occupancy', {
      params: { start_date: '2026-10-01', end_date: '2026-10-31' },
    });

    await reportsApi.adr('2026-10-01', '2026-10-31');
    expect(mockGet).toHaveBeenCalledWith('/reports/adr', {
      params: { start_date: '2026-10-01', end_date: '2026-10-31' },
    });

    await reportsApi.revpar('2026-10-01', '2026-10-31');
    expect(mockGet).toHaveBeenCalledWith('/reports/revpar', {
      params: { start_date: '2026-10-01', end_date: '2026-10-31' },
    });

    await reportsApi.revenue('2026-10-01', '2026-10-31');
    expect(mockGet).toHaveBeenCalledWith('/reports/revenue', {
      params: { start_date: '2026-10-01', end_date: '2026-10-31' },
    });

    await reportsApi.reservations('2026-10-01', '2026-10-31');
    expect(mockGet).toHaveBeenCalledWith('/reports/reservations', {
      params: { start_date: '2026-10-01', end_date: '2026-10-31' },
    });

    await reportsApi.frontDesk();
    expect(mockGet).toHaveBeenCalledWith('/reports/front-desk');

    await reportsApi.housekeeping();
    expect(mockGet).toHaveBeenCalledWith('/reports/housekeeping');

    await reportsApi.maintenance();
    expect(mockGet).toHaveBeenCalledWith('/reports/maintenance');
  });

  it('exposes permission constants', () => {
    expect(DASHBOARD_VIEW_PERM).toBe('dashboard.view');
    expect(REPORTS_VIEW_PERM).toBe('reports.view');
  });
});

describe('format helpers', () => {
  it('formatPKR formats whole amounts', () => {
    expect(formatPKR(15000)).toBe('PKR 15,000');
    expect(formatPKR(0)).toBe('PKR 0');
    expect(formatPKR('abc')).toBe('PKR 0');
  });

  it('formatPct formats percentages', () => {
    expect(formatPct(72.345)).toBe('72.3%');
    expect(formatPct('x')).toBe('—');
  });

  it('num coerces safely', () => {
    expect(num('42')).toBe(42);
    expect(num(null)).toBe(0);
    expect(num(undefined, 7)).toBe(7);
  });

  it('todayStr and monthStartStr produce YYYY-MM-DD', () => {
    expect(todayStr(new Date(2026, 9, 3))).toBe('2026-10-03');
    expect(monthStartStr(new Date(2026, 9, 15))).toBe('2026-10-01');
  });
});

describe('formula helpers', () => {
  it('calcOccupancyRate: occupied room-nights ÷ available room-nights', () => {
    // 30 occupied nights, 10 rooms × 30 nights = 300 available → 10%
    expect(calcOccupancyRate(30, 10, 30)).toBeCloseTo(10, 5);
    // 150 occupied of 300 available → 50%
    expect(calcOccupancyRate(150, 10, 30)).toBeCloseTo(50, 5);
  });

  it('calcOccupancyRate returns null with no capacity', () => {
    expect(calcOccupancyRate(0, 0, 30)).toBeNull();
    expect(calcOccupancyRate(10, 10, 0)).toBeNull();
    expect(calcOccupancyRate('x', 10, 30)).toBeNull();
  });

  it('calcADR: room revenue ÷ occupied nights', () => {
    // PKR 300,000 over 60 occupied nights → PKR 5,000
    expect(calcADR(300000, 60)).toBeCloseTo(5000, 5);
  });

  it('calcADR returns null with zero occupied nights', () => {
    expect(calcADR(100000, 0)).toBeNull();
  });

  it('calcRevPAR: ADR × occupancy fraction', () => {
    // ADR 5000 × 60% occupancy → 3000
    expect(calcRevPAR(5000, 60)).toBeCloseTo(3000, 5);
  });

  it('calcRevPARFromRevenue: revenue ÷ available nights', () => {
    // PKR 300,000 over 10 rooms × 30 nights → PKR 1,000
    expect(calcRevPARFromRevenue(300000, 10, 30)).toBeCloseTo(1000, 5);
    // Consistency: RevPAR = ADR × occupancy
    const occ = calcOccupancyRate(150, 10, 30); // 50%
    const adr = calcADR(300000, 150); // 2000
    expect(calcRevPAR(adr, occ)).toBeCloseTo(calcRevPARFromRevenue(300000, 10, 30), 5);
  });
});
