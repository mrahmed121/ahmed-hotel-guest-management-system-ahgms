import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Login from '../pages/Login';

const mockLogin = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ login: mockLogin }),
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useNavigate: () => mockNavigate };
});

describe('Login page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders AHGMS branding, email + password fields, and sign-in button', () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );
    expect(screen.getByText('AHGMS')).toBeInTheDocument();
    expect(screen.getByText(/Ahmed Hotel & Guest Management System/)).toBeInTheDocument();
    expect(screen.getByText(/Hospitality, Managed Smarter/)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByText(/Developed by Ahmed/)).toBeInTheDocument();
  });

  it('submits email + password and navigates on success', async () => {
    const user = userEvent.setup();
    mockLogin.mockResolvedValue({ name: 'Admin' });
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText(/email/i), 'admin@hotel.test');
    await user.type(screen.getByLabelText(/password/i), 'secret123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('admin@hotel.test', 'secret123');
    });
    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
  });

  it('shows an error message when login fails', async () => {
    const user = userEvent.setup();
    mockLogin.mockRejectedValue({ response: { data: { message: 'Invalid credentials.' } } });
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText(/email/i), 'admin@hotel.test');
    await user.type(screen.getByLabelText(/password/i), 'wrong');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Invalid credentials.');
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
