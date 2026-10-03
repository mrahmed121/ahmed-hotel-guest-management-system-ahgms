import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { RequireAuth } from '../auth/guards';
import PermissionGuard from '../components/PermissionGuard';
import * as AuthContext from '../auth/AuthContext';

function renderWithAuth(ui, { authValue, route = '/' } = {}) {
  vi.spyOn(AuthContext, 'useAuth').mockReturnValue(authValue);
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/login" element={<div>Login Page</div>} />
        <Route path="/" element={ui} />
      </Routes>
    </MemoryRouter>
  );
}

describe('RequireAuth', () => {
  it('redirects to /login when unauthenticated', () => {
    renderWithAuth(
      <RequireAuth>
        <div>Secret Content</div>
      </RequireAuth>,
      {
        authValue: { isAuthenticated: false, loading: false, initialized: true },
      }
    );
    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Secret Content')).not.toBeInTheDocument();
  });

  it('renders children when authenticated', () => {
    renderWithAuth(
      <RequireAuth>
        <div>Secret Content</div>
      </RequireAuth>,
      {
        authValue: { isAuthenticated: true, loading: false, initialized: true },
      }
    );
    expect(screen.getByText('Secret Content')).toBeInTheDocument();
  });

  it('shows a spinner while auth is loading', () => {
    renderWithAuth(
      <RequireAuth>
        <div>Secret Content</div>
      </RequireAuth>,
      {
        authValue: { isAuthenticated: false, loading: true, initialized: false },
      }
    );
    expect(screen.getByRole('status', { name: /loading/i })).toBeInTheDocument();
  });
});

describe('PermissionGuard', () => {
  const guardValue = (permissions) => ({
    initialized: true,
    hasPermission: (slug) => {
      if (!slug) return true;
      if (Array.isArray(slug)) return slug.every((s) => permissions.includes(s));
      return permissions.includes(slug);
    },
  });

  it('hides content when the user lacks the permission', () => {
    renderWithAuth(
      <PermissionGuard permission="rooms.view">
        <div>Rooms Panel</div>
      </PermissionGuard>,
      { authValue: guardValue(['dashboard.view']) }
    );
    expect(screen.queryByText('Rooms Panel')).not.toBeInTheDocument();
  });

  it('shows content when the user has the permission', () => {
    renderWithAuth(
      <PermissionGuard permission="rooms.view">
        <div>Rooms Panel</div>
      </PermissionGuard>,
      { authValue: guardValue(['rooms.view']) }
    );
    expect(screen.getByText('Rooms Panel')).toBeInTheDocument();
  });

  it('renders the fallback when provided and permission is missing', () => {
    renderWithAuth(
      <PermissionGuard permission="folios.view" fallback={<div>No access</div>}>
        <div>Folio Panel</div>
      </PermissionGuard>,
      { authValue: guardValue([]) }
    );
    expect(screen.getByText('No access')).toBeInTheDocument();
    expect(screen.queryByText('Folio Panel')).not.toBeInTheDocument();
  });
});
