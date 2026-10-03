import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const mockUseAuth = vi.fn();
vi.mock('../auth/AuthContext', () => ({
  useAuth: (...args) => mockUseAuth(...args),
}));

const { mockStaysApi } = vi.hoisted(() => ({
  mockStaysApi: {
    list: vi.fn(),
    get: vi.fn(),
    checkIn: vi.fn(),
    walkIn: vi.fn(),
    checkOut: vi.fn(),
    roomMove: vi.fn(),
  },
}));
vi.mock('../modules/frontdesk/services/frontdeskApi', async (importOriginal) => {
  const actual = await importOriginal();
  const { staysApi: _omit, ...rest } = actual;
  return { ...rest, staysApi: mockStaysApi };
});

const { mockReservationsApi } = vi.hoisted(() => ({
  mockReservationsApi: { list: vi.fn() },
}));
vi.mock('../modules/reservations/services/reservationApi', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, reservationsApi: mockReservationsApi };
});

const { mockGuestsApi } = vi.hoisted(() => ({
  mockGuestsApi: { list: vi.fn() },
}));
vi.mock('../modules/guests/services/guestApi', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, guestsApi: mockGuestsApi };
});

vi.mock('../modules/inventory/services/inventoryApi', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    roomTypesApi: { list: vi.fn().mockResolvedValue({ data: [] }) },
    roomsApi: { list: vi.fn().mockResolvedValue({ data: [] }) },
  };
});

vi.mock('../modules/guests/pages/GuestsPage', () => ({
  guestDisplayName: (g) => `${g?.first_name ?? ''} ${g?.last_name ?? ''}`.trim(),
}));

import FrontDeskPage from '../modules/frontdesk/pages/FrontDeskPage';

const GUEST = { id: 1, first_name: 'Ali', last_name: 'Khan', phone: '03001234567' };
const TODAY = (() => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
})();
const DAY_AFTER = (() => {
  const d = new Date();
  d.setDate(d.getDate() + 2);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
})();
const RESERVATION = {
  id: 10,
  confirmation_code: 'RSV-000001',
  guest_id: 1,
  room_type_id: 2,
  check_in: TODAY,
  check_out: DAY_AFTER,
  nightly_rate: 9500,
  status: 'confirmed',
};
const STAY = {
  id: 20,
  guest_id: 1,
  room_id: 5,
  status: 'in_house',
  checked_in_at: '2026-10-03T14:00:00',
  reservation: { ...RESERVATION },
};

function setup() {
  mockUseAuth.mockReturnValue({
    hasPermission: () => true,
    initialized: true,
    user: { name: 'Receptionist' },
  });
  mockReservationsApi.list.mockResolvedValue({ data: [RESERVATION] });
  mockStaysApi.list.mockResolvedValue({ data: [STAY] });
  mockGuestsApi.list.mockResolvedValue({ data: [GUEST] });
}

function renderPage() {
  return render(
    <MemoryRouter>
      <FrontDeskPage />
    </MemoryRouter>
  );
}

describe('FrontDeskPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setup();
  });

  it('renders all three sections as tabs', async () => {
    renderPage();
    expect(screen.getByRole('tab', { name: /arrivals today/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /in-house/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /departures today/i })).toBeInTheDocument();
  });

  it('shows arrivals today with a check-in button', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('RSV-000001')).toBeInTheDocument();
    });
    // Header action + one per arrival row.
    const checkInButtons = screen.getAllByRole('button', { name: /^check-in$/i });
    expect(checkInButtons.length).toBeGreaterThanOrEqual(2);
  });

  it('shows in-house stays when switching to the In-House tab', async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /in-house/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole('tab', { name: /in-house/i }));
    await waitFor(() => {
      expect(screen.getByText('Ali Khan')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /check-out/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /room move/i })).toBeInTheDocument();
  });

  it('opens the check-in modal and submits the reservation check-in', async () => {
    const user = userEvent.setup();
    mockStaysApi.checkIn.mockResolvedValue({ data: { id: 20 } });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('RSV-000001')).toBeInTheDocument();
    });
    // The row-level check-in button (last of the exact "Check-in" buttons).
    const checkInButtons = screen.getAllByRole('button', { name: /^check-in$/i });
    await user.click(checkInButtons[checkInButtons.length - 1]);
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
    // Reservation is pre-selected from the row button.
    await user.click(screen.getByRole('button', { name: /confirm check-in/i }));
    await waitFor(() => {
      expect(mockStaysApi.checkIn).toHaveBeenCalledWith(
        expect.objectContaining({ reservation_id: 10 })
      );
    });
  });

  it('check-out flow asks for confirmation and posts', async () => {
    const user = userEvent.setup();
    mockStaysApi.checkOut.mockResolvedValue({ data: { id: 20, status: 'checked_out' } });
    renderPage();
    await user.click(screen.getByRole('tab', { name: /in-house/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /check-out/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /check-out/i }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/folio balance/i)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: /confirm check-out/i }));
    await waitFor(() => {
      expect(mockStaysApi.checkOut).toHaveBeenCalledWith(20, expect.anything());
    });
  });

  it('shows an empty state when there are no arrivals', async () => {
    mockReservationsApi.list.mockResolvedValue({ data: [] });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/no arrivals today/i)).toBeInTheDocument();
    });
  });
});
