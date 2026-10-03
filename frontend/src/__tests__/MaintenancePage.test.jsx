import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockUseAuth = vi.fn();
vi.mock('../auth/AuthContext', () => ({
  useAuth: (...args) => mockUseAuth(...args),
}));

const { mockMaintenanceApi } = vi.hoisted(() => ({
  mockMaintenanceApi: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    assign: vi.fn(),
    complete: vi.fn(),
    verify: vi.fn(),
  },
}));
vi.mock('../modules/operations/services/operationsApi', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, maintenanceApi: mockMaintenanceApi, usersApi: { list: vi.fn().mockResolvedValue({ data: [] }) } };
});

vi.mock('../modules/inventory/services/inventoryApi', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, roomsApi: { list: vi.fn().mockResolvedValue({ data: [] }) } };
});

import MaintenancePage from '../modules/operations/pages/MaintenancePage';

const TICKETS = [
  { id: 1, ticket_number: 'MT-2026-0001', room: { number: '101' }, category: 'ac', priority: 'high', status: 'open', title: 'AC not cooling', assigned_to: null },
  { id: 2, ticket_number: 'MT-2026-0002', room: { number: '205' }, category: 'plumbing', priority: 'urgent', status: 'assigned', title: 'Leaking tap', assigned_to: { name: 'Omar' } },
  { id: 3, ticket_number: 'MT-2026-0003', room: null, category: 'electrical', priority: 'normal', status: 'completed', title: 'Lobby lights', assigned_to: { name: 'Omar' } },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({ hasPermission: () => true });
  mockMaintenanceApi.list.mockResolvedValue({ data: { data: TICKETS, meta: { current_page: 1, per_page: 15, total: 3 } } });
});

describe('MaintenancePage', () => {
  it('renders ticket table with number, room, category, priority, status', async () => {
    render(<MaintenancePage />);

    await waitFor(() => {
      expect(screen.getByText('MT-2026-0001')).toBeInTheDocument();
    });

    expect(screen.getByText('Room 101')).toBeInTheDocument();
    expect(screen.getByText('AC not cooling')).toBeInTheDocument();
    // status badge for the open ticket (scoped to avoid the filter <option>)
    const badges = screen.getAllByText('open');
    expect(badges.some((el) => el.tagName === 'SPAN')).toBe(true);
  });

  it('applies status filter on change', async () => {
    const user = userEvent.setup();
    render(<MaintenancePage />);

    await waitFor(() => {
      expect(screen.getByText('MT-2026-0001')).toBeInTheDocument();
    });

    const statusSelect = screen.getByLabelText(/filter by status/i);
    await user.selectOptions(statusSelect, 'open');

    await waitFor(() => {
      expect(mockMaintenanceApi.list).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'open', page: 1 })
      );
    });
  });

  it('applies category filter on change', async () => {
    const user = userEvent.setup();
    render(<MaintenancePage />);

    await waitFor(() => {
      expect(screen.getByText('MT-2026-0001')).toBeInTheDocument();
    });

    const catSelect = screen.getByLabelText(/filter by category/i);
    await user.selectOptions(catSelect, 'plumbing');

    await waitFor(() => {
      expect(mockMaintenanceApi.list).toHaveBeenCalledWith(
        expect.objectContaining({ category: 'plumbing', page: 1 })
      );
    });
  });

  it('shows next workflow action per status', async () => {
    render(<MaintenancePage />);

    await waitFor(() => {
      expect(screen.getByText('MT-2026-0001')).toBeInTheDocument();
    });

    // open → Triage, assigned → Start Work, completed → Verify
    expect(screen.getByRole('button', { name: /triage/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start work/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /verify/i })).toBeInTheDocument();
  });

  it('triage action updates ticket status', async () => {
    const user = userEvent.setup();
    render(<MaintenancePage />);

    await waitFor(() => {
      expect(screen.getByText('MT-2026-0001')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /triage/i }));
    await waitFor(() => {
      expect(mockMaintenanceApi.update).toHaveBeenCalledWith(1, { status: 'triaged' });
    });
  });

  it('opens create modal and validates required fields', async () => {
    const user = userEvent.setup();
    render(<MaintenancePage />);

    await waitFor(() => {
      expect(screen.getByText('MT-2026-0001')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /new ticket/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Submit without title → validation error
    await user.click(screen.getByRole('button', { name: /create ticket/i }));
    await waitFor(() => {
      expect(screen.getByText(/title is required/i)).toBeInTheDocument();
    });
    expect(mockMaintenanceApi.create).not.toHaveBeenCalled();
  });
});
