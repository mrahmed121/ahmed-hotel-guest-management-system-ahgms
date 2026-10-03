import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ hasPermission: () => true, user: { name: 'Test' } }),
}));

const { mockReportsApi } = vi.hoisted(() => ({
  mockReportsApi: {
    dashboard: vi.fn(),
  },
}));

vi.mock('../modules/reports/services/reportsApi', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, reportsApi: mockReportsApi };
});

import DashboardPage from '../modules/reports/pages/DashboardPage';

const DASHBOARD_DATA = {
  occupancy_today: 72.5,
  arrivals_today: 4,
  departures_today: 3,
  in_house: 18,
  total_rooms: 25,
  revenue_mtd: { room: 450000, service: 80000, total: 530000 },
  outstanding_balance: 45000,
  housekeeping_queue: { dirty: 3, assigned: 2, cleaning: 1, inspection: 1 },
  maintenance_open: 2,
  recent_stays: [
    { id: 1, guest_name: 'Ali Khan', room_number: '101' },
    { id: 2, guest_name: 'Sara Ahmed', room_number: '205' },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockReportsApi.dashboard.mockResolvedValue({ data: DASHBOARD_DATA });
});

describe('DashboardPage', () => {
  it('renders metric cards from API data', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('72.5%')).toBeInTheDocument();
    });

    expect(screen.getByText('Occupancy today')).toBeInTheDocument();
    expect(screen.getByText("Arrivals today")).toBeInTheDocument();
    expect(screen.getByText('In-house guests')).toBeInTheDocument();
    expect(screen.getByText('PKR 530,000')).toBeInTheDocument();
    expect(screen.getByText('PKR 45,000')).toBeInTheDocument();
    expect(screen.getByText('Housekeeping queue')).toBeInTheDocument();
    expect(screen.getByText('Ali Khan')).toBeInTheDocument();
    expect(screen.getByText('Sara Ahmed')).toBeInTheDocument();
  });

  it('shows empty state when there are no stays', async () => {
    mockReportsApi.dashboard.mockResolvedValue({ data: { ...DASHBOARD_DATA, recent_stays: [] } });
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('No stays yet')).toBeInTheDocument();
    });
  });

  it('shows error message when the API fails', async () => {
    mockReportsApi.dashboard.mockRejectedValue({ response: { data: { message: 'Server error' } } });
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeInTheDocument();
    });
  });
});
