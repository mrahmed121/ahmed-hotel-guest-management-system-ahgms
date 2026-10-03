import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import RoomsPage from '../modules/inventory/pages/RoomsPage';
import * as inventoryApi from '../modules/inventory/services/inventoryApi';

vi.mock('../modules/inventory/services/inventoryApi', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    roomsApi: { list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
    floorsApi: { list: vi.fn() },
    roomTypesApi: { list: vi.fn() },
  };
});

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ hasPermission: () => true }),
}));

vi.mock('../components/PermissionGuard', () => ({
  default: ({ children }) => <>{children}</>,
}));

const mockRooms = [
  { id: 1, number: '101', floor_id: 1, room_type_id: 1, status: 'available' },
  { id: 2, number: '102', floor_id: 1, room_type_id: 2, status: 'occupied' },
  { id: 3, number: '201', floor_id: 2, room_type_id: 1, status: 'dirty' },
];

beforeEach(() => {
  vi.clearAllMocks();
  inventoryApi.roomsApi.list.mockResolvedValue({ data: mockRooms });
  inventoryApi.floorsApi.list.mockResolvedValue({
    data: [
      { id: 1, number: 1, name: 'Ground Floor' },
      { id: 2, number: 2, name: 'First Floor' },
    ],
  });
  inventoryApi.roomTypesApi.list.mockResolvedValue({
    data: [
      { id: 1, name: 'Standard' },
      { id: 2, name: 'Deluxe' },
    ],
  });
});

function renderPage() {
  return render(
    <BrowserRouter>
      <RoomsPage />
    </BrowserRouter>
  );
}

describe('RoomsPage', () => {
  it('renders room list with numbers and statuses', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('101')).toBeInTheDocument());
    expect(screen.getByText('102')).toBeInTheDocument();
    expect(screen.getByText('201')).toBeInTheDocument();
    // status badges render humanized labels
    expect(screen.getAllByText('available').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('occupied').length).toBeGreaterThanOrEqual(1);
  });

  it('filters rooms by search text', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('101')).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Search rooms'), { target: { value: '20' } });
    expect(screen.queryByText('101')).not.toBeInTheDocument();
    expect(screen.getByText('201')).toBeInTheDocument();
  });

  it('filters rooms by status', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('101')).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Filter by status'), { target: { value: 'occupied' } });
    expect(screen.queryByText('101')).not.toBeInTheDocument();
    expect(screen.getByText('102')).toBeInTheDocument();
  });

  it('shows empty state when no rooms match', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('101')).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Search rooms'), { target: { value: 'zzz' } });
    expect(screen.getByText('No rooms yet')).toBeInTheDocument();
  });
});
