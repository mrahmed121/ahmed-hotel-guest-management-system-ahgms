import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import GuestsPage from '../modules/guests/pages/GuestsPage';
import * as guestApi from '../modules/guests/services/guestApi';

vi.mock('../modules/guests/services/guestApi', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    guestsApi: {
      list: vi.fn(),
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      blacklist: vi.fn(),
      unblacklist: vi.fn(),
      reservations: vi.fn(),
    },
  };
});

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ hasPermission: () => true }),
}));

vi.mock('../components/PermissionGuard', () => ({
  default: ({ children }) => <>{children}</>,
}));

const mockGuests = [
  { id: 1, first_name: 'Ali', last_name: 'Khan', email: 'ali@example.com', phone: '+923001234567', country: 'Pakistan', vip: true, status: 'active' },
  { id: 2, first_name: 'Sara', last_name: 'Ahmed', email: 'sara@example.com', phone: '+923007654321', country: 'Pakistan', vip: false, status: 'active' },
  { id: 3, first_name: 'John', last_name: 'Doe', email: 'john@example.com', phone: '+15551234567', country: 'USA', vip: false, status: 'blacklisted' },
];

beforeEach(() => {
  vi.clearAllMocks();
  guestApi.guestsApi.list.mockResolvedValue({ data: mockGuests });
  guestApi.guestsApi.reservations.mockResolvedValue({ data: [] });
});

function renderPage() {
  return render(
    <BrowserRouter>
      <GuestsPage />
    </BrowserRouter>
  );
}

describe('GuestsPage', () => {
  it('renders the guest list', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Ali Khan')).toBeInTheDocument();
      expect(screen.getByText('Sara Ahmed')).toBeInTheDocument();
    });
  });

  it('shows VIP badge for VIP guests', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Ali Khan')).toBeInTheDocument();
    });
    expect(screen.getByText('VIP')).toBeInTheDocument();
  });

  it('filters guests by search text', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Ali Khan')).toBeInTheDocument();
    });
    const input = screen.getByLabelText('Search guests');
    fireEvent.change(input, { target: { value: 'sara' } });
    await waitFor(() => {
      expect(screen.queryByText('Ali Khan')).not.toBeInTheDocument();
      expect(screen.getByText('Sara Ahmed')).toBeInTheDocument();
    });
  });

  it('filters guests by phone number', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
    const input = screen.getByLabelText('Search guests');
    fireEvent.change(input, { target: { value: '+1555' } });
    await waitFor(() => {
      expect(screen.queryByText('Ali Khan')).not.toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
  });

  it('filters by blacklist status', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Ali Khan')).toBeInTheDocument();
    });
    const select = screen.getByLabelText('Filter by status');
    fireEvent.change(select, { target: { value: 'blacklisted' } });
    await waitFor(() => {
      expect(screen.queryByText('Ali Khan')).not.toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
  });
});
