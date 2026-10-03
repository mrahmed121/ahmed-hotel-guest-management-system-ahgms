import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../auth/AuthContext';
import { authApi } from '../api/client';

vi.mock('../api/client', () => ({
  authApi: { me: vi.fn(), login: vi.fn(), logout: vi.fn() },
  getToken: () => 'fake-token',
  setToken: vi.fn(),
}));

// Mirrors the REAL backend shape: permissions nested on the singular role object,
// NOT a top-level user.permissions array.
const backendUser = {
  id: 1,
  name: 'Hotel Admin',
  email: 'admin@ahmedgrand.local',
  role_id: 2,
  role: {
    id: 2,
    slug: 'hotel_admin',
    permissions: [
      { slug: 'dashboard.view', name: 'View dashboard' },
      { slug: 'rooms.view', name: 'View rooms' },
    ],
  },
};

function Probe() {
  const { hasPermission, permissions } = useAuth();
  return (
    <div>
      <span data-testid="count">{permissions.length}</span>
      <span data-testid="dashboard">{hasPermission('dashboard.view') ? 'yes' : 'no'}</span>
      <span data-testid="other">{hasPermission('rooms.view') ? 'yes' : 'no'}</span>
      <span data-testid="denied">{hasPermission('users.manage') ? 'yes' : 'no'}</span>
    </div>
  );
}

describe('AuthContext permission extraction (backend shape)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('extracts permissions from user.role.permissions (real API shape)', async () => {
    authApi.me.mockResolvedValue({ data: backendUser });
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('2'));
    expect(screen.getByTestId('dashboard')).toHaveTextContent('yes');
    expect(screen.getByTestId('other')).toHaveTextContent('yes');
    expect(screen.getByTestId('denied')).toHaveTextContent('no');
  });

  it('still supports a top-level user.permissions array', async () => {
    authApi.me.mockResolvedValue({
      data: { ...backendUser, permissions: [{ slug: 'x.y' }], role: { slug: 'r', permissions: [] } },
    });
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('1'));
  });

  it('yields no permissions when neither shape is present', async () => {
    authApi.me.mockResolvedValue({ data: { id: 9, role: { slug: 'x' } } });
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('0'));
    expect(screen.getByTestId('dashboard')).toHaveTextContent('no');
  });
});
