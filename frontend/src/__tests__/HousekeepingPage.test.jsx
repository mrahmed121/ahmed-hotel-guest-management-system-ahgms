import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockUseAuth = vi.fn();
vi.mock('../auth/AuthContext', () => ({
  useAuth: (...args) => mockUseAuth(...args),
}));

const { mockHousekeepingApi } = vi.hoisted(() => ({
  mockHousekeepingApi: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    assign: vi.fn(),
    start: vi.fn(),
    complete: vi.fn(),
    inspect: vi.fn(),
  },
}));
vi.mock('../modules/operations/services/operationsApi', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, housekeepingApi: mockHousekeepingApi, usersApi: { list: vi.fn().mockResolvedValue({ data: [] }) } };
});

vi.mock('../modules/inventory/services/inventoryApi', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, roomsApi: { list: vi.fn().mockResolvedValue({ data: [] }) } };
});

import HousekeepingPage from '../modules/operations/pages/HousekeepingPage';

const TASKS = [
  { id: 1, status: 'dirty', priority: 'high', room: { id: 11, number: '101' }, notes: 'Checkout clean' },
  { id: 2, status: 'dirty', priority: 'normal', room: { id: 12, number: '102' } },
  { id: 3, status: 'assigned', priority: 'urgent', room: { id: 13, number: '201' }, assigned_to: { name: 'Sara' } },
  { id: 4, status: 'cleaning', priority: 'low', room: { id: 14, number: '202' } },
  { id: 5, status: 'inspection', priority: 'normal', room: { id: 15, number: '301' } },
  { id: 6, status: 'ready', priority: 'normal', room: { id: 16, number: '302' } },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({ hasPermission: () => true });
  mockHousekeepingApi.list.mockResolvedValue({ data: { data: TASKS } });
});

describe('HousekeepingPage', () => {
  it('renders all five status groups with counts', async () => {
    render(<HousekeepingPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Housekeeping' })).toBeInTheDocument();
    });

    for (const label of ['Dirty', 'Assigned', 'Cleaning', 'Inspection', 'Ready']) {
      expect(screen.getByLabelText(new RegExp(`${label} tasks`, 'i'))).toBeInTheDocument();
    }

    // Dirty group has 2 tasks
    const dirtyGroup = screen.getByLabelText(/dirty tasks/i);
    expect(within(dirtyGroup).getByText('Room 101')).toBeInTheDocument();
    expect(within(dirtyGroup).getByText('Room 102')).toBeInTheDocument();
  });

  it('shows empty state when no tasks exist', async () => {
    mockHousekeepingApi.list.mockResolvedValue({ data: { data: [] } });
    render(<HousekeepingPage />);
    await waitFor(() => {
      expect(screen.getByText(/no housekeeping tasks/i)).toBeInTheDocument();
    });
  });

  it('shows per-status action buttons for manage permission', async () => {
    const user = userEvent.setup();
    render(<HousekeepingPage />);

    await waitFor(() => {
      expect(screen.getByText('Room 101')).toBeInTheDocument();
    });

    // dirty → Assign
    expect(screen.getAllByRole('button', { name: /assign/i }).length).toBeGreaterThan(0);
    // assigned → Start Cleaning
    expect(screen.getByRole('button', { name: /start cleaning/i })).toBeInTheDocument();
    // cleaning → Complete
    expect(screen.getByRole('button', { name: /^complete$/i })).toBeInTheDocument();
    // inspection → Pass / Fail
    expect(screen.getByRole('button', { name: /^pass$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^fail$/i })).toBeInTheDocument();

    // Start Cleaning triggers API call
    await user.click(screen.getByRole('button', { name: /start cleaning/i }));
    await waitFor(() => {
      expect(mockHousekeepingApi.start).toHaveBeenCalledWith(3);
    });
  });

  it('hides action buttons without manage permission', async () => {
    mockUseAuth.mockReturnValue({ hasPermission: () => false });
    render(<HousekeepingPage />);
    await waitFor(() => {
      expect(screen.getByText('Room 101')).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: /start cleaning/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /new task/i })).not.toBeInTheDocument();
  });
});
