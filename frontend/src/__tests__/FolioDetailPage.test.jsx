import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const mockUseAuth = vi.fn();
vi.mock('../auth/AuthContext', () => ({
  useAuth: (...args) => mockUseAuth(...args),
}));

const { mockFoliosApi } = vi.hoisted(() => ({
  mockFoliosApi: {
    list: vi.fn(),
    get: vi.fn(),
    totals: vi.fn(),
    byStay: vi.fn(),
    addCharge: vi.fn(),
    addAdjustment: vi.fn(),
    recordPayment: vi.fn(),
    runNightlyBilling: vi.fn(),
  },
}));
vi.mock('../modules/folio/services/folioApi', async (importOriginal) => {
  const actual = await importOriginal();
  const { foliosApi: _omit, ...rest } = actual;
  return { ...rest, foliosApi: mockFoliosApi };
});

import FolioDetailPage from '../modules/folio/pages/FolioDetailPage';

const FOLIO = {
  id: 12,
  folio_number: 'FL-2026-000012',
  status: 'open',
  stay: {
    id: 7,
    checked_in_at: '2026-10-01T14:00:00',
    checked_out_at: null,
    guest: { id: 3, first_name: 'Sara', last_name: 'Ahmed', phone: '03009876543' },
    room: { id: 5, number: '204' },
  },
  lines: [
    { id: 1, line_type: 'room', description: 'Room 204 — 2026-10-01', quantity: 1, unit_price: 20000, amount: 20000, service_date: '2026-10-01' },
    { id: 2, line_type: 'service', description: 'Breakfast x2', quantity: 2, unit_price: 1500, amount: 3000, service_date: '2026-10-02' },
    { id: 3, line_type: 'adjustment', adjustment_type: 'discount', description: 'Goodwill', quantity: 1, unit_price: 2000, amount: 2000, service_date: '2026-10-02' },
  ],
  payments: [
    { id: 1, receipt_number: 'RCPT-0001', method: 'cash', amount: 10000, paid_at: '2026-10-02T10:00:00' },
  ],
  totals: { charges: 23000, discounts: 2000, payments: 10000, balance: 11000, guest_credit: 0 },
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/folios/12']}>
      <Routes>
        <Route path="/folios/:id" element={<FolioDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({
    initialized: true,
    hasPermission: () => true,
    user: { name: 'Admin' },
  });
  mockFoliosApi.get.mockResolvedValue({ data: FOLIO });
});

describe('FolioDetailPage', () => {
  it('renders folio header, totals card, and tables from API data', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/FL-2026-000012/)).toBeInTheDocument();
    });

    // Header info
    expect(screen.getByText(/Sara Ahmed/)).toBeInTheDocument();
    expect(screen.getByText('Room 204 — 2026-10-01')).toBeInTheDocument();

    // Charges rows
    expect(screen.getByText('Room 204 — 2026-10-01')).toBeInTheDocument();
    expect(screen.getByText('Breakfast x2')).toBeInTheDocument();

    // Payments row
    expect(screen.getByText('RCPT-0001')).toBeInTheDocument();

    // Totals card: balance due highlighted
    expect(screen.getByText('Balance due')).toBeInTheDocument();
    expect(screen.getByText('PKR 11,000')).toBeInTheDocument();
  });

  it('computes totals client-side when server totals are absent', async () => {
    const { id, totals, ...rest } = FOLIO;
    void id;
    void totals;
    mockFoliosApi.get.mockResolvedValue({ data: { ...rest, id: 12 } });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Balance due')).toBeInTheDocument();
    });
    // 23000 charges - 2000 discount - 10000 payments = 11000
    expect(screen.getByText('PKR 11,000')).toBeInTheDocument();
  });

  it('shows action buttons only with permissions', async () => {
    mockUseAuth.mockReturnValue({
      initialized: true,
      hasPermission: () => false,
      user: { name: 'Viewer' },
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/FL-2026-000012/)).toBeInTheDocument();
    });

    expect(screen.queryByText('Add charge')).not.toBeInTheDocument();
    expect(screen.queryByText('Record payment')).not.toBeInTheDocument();
  });

  it('hides action buttons on closed folios', async () => {
    mockFoliosApi.get.mockResolvedValue({ data: { ...FOLIO, status: 'closed' } });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/FL-2026-000012/)).toBeInTheDocument();
    });

    expect(screen.queryByText('Add charge')).not.toBeInTheDocument();
    expect(screen.queryByText('Record payment')).not.toBeInTheDocument();
  });

  it('shows an empty state when folio is not found', async () => {
    const err = new Error('not found');
    err.response = { status: 404 };
    mockFoliosApi.get.mockRejectedValue(err);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Folio not found')).toBeInTheDocument();
    });
  });
});
