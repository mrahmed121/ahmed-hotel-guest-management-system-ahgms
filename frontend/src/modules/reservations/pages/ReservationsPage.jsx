import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import DataTable from '../../../components/DataTable';
import PageHeader from '../../../components/PageHeader';
import Modal from '../../../components/Modal';
import StatusBadge from '../../../components/StatusBadge';
import PermissionGuard from '../../../components/PermissionGuard';
import {
  reservationsApi,
  RESERVATION_STATUSES,
  ACTIVE_RESERVATION_STATUSES,
  nightsBetween,
  formatMoney,
} from '../services/reservationApi';
import { guestsApi } from '../../guests/services/guestApi';
import { roomTypesApi, roomsApi } from '../../inventory/services/inventoryApi';
import { guestDisplayName } from '../../guests/pages/GuestsPage';
import { Field, inputCls, btnPrimary, btnSecondary, btnDanger } from '../components/form';

export default function ReservationsPage() {
  const navigate = useNavigate();
  const [reservations, setReservations] = useState([]);
  const [guests, setGuests] = useState([]);
  const [roomTypes, setRoomTypes] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [filters, setFilters] = useState({ search: '', status: '', from: '', to: '' });
  const [actionTarget, setActionTarget] = useState(null); // {reservation, action}
  const [cancelReason, setCancelReason] = useState('');
  const [acting, setActing] = useState(false);
  const [actionError, setActionError] = useState('');

  const load = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [r, g, t, rm] = await Promise.all([
        reservationsApi.list({ per_page: 200 }),
        guestsApi.list({ per_page: 500 }),
        roomTypesApi.list({ per_page: 100 }),
        roomsApi.list({ per_page: 500 }),
      ]);
      setReservations(r.data || []);
      setGuests(g.data || []);
      setRoomTypes(t.data || []);
      setRooms(rm.data || []);
    } catch {
      setLoadError('Could not load reservations. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const guestById = useCallback((id) => guests.find((g) => g.id === id), [guests]);
  const typeName = (id) => roomTypes.find((t) => t.id === id)?.name || '—';
  const roomNumber = (id) => rooms.find((r) => r.id === id)?.number || '—';

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return reservations.filter((r) => {
      if (filters.status && r.status !== filters.status) return false;
      if (filters.from && r.check_in < filters.from) return false;
      if (filters.to && r.check_out > filters.to) return false;
      if (q) {
        const g = guestById(r.guest_id);
        const hay = `${r.confirmation_code} ${g ? guestDisplayName(g) : ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [reservations, filters, guestById]);

  const openAction = (reservation, action) => {
    setActionTarget({ reservation, action });
    setCancelReason('');
    setActionError('');
  };

  const performAction = async () => {
    if (!actionTarget) return;
    const { reservation, action } = actionTarget;
    setActing(true);
    setActionError('');
    try {
      if (action === 'confirm') await reservationsApi.confirm(reservation.id);
      else if (action === 'no-show') await reservationsApi.noShow(reservation.id);
      else if (action === 'cancel') await reservationsApi.cancel(reservation.id, { reason: cancelReason });
      setActionTarget(null);
      await load();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Action failed.');
    } finally {
      setActing(false);
    }
  };

  const canAct = (r, action) => {
    if (action === 'confirm') return r.status === 'reserved';
    if (action === 'cancel') return ACTIVE_RESERVATION_STATUSES.includes(r.status);
    if (action === 'no-show') return ['reserved', 'confirmed'].includes(r.status);
    return false;
  };

  const actionTitle = {
    confirm: 'Confirm reservation',
    cancel: 'Cancel reservation',
    'no-show': 'Mark as no-show',
  };

  const actionCopy = {
    confirm: (r) => `Confirm reservation ${r.confirmation_code}? The guest is expected to arrive on ${r.check_in}.`,
    cancel: (r) => `Cancel reservation ${r.confirmation_code}? The room will be released back to availability.`,
    'no-show': (r) => `Mark reservation ${r.confirmation_code} as no-show? The guest did not arrive and the room will be released.`,
  };

  return (
    <div>
      <PageHeader
        title="Reservations"
        subtitle="Search availability, create and manage reservations."
        actions={
          <PermissionGuard permission="reservations.manage">
            <button type="button" onClick={() => navigate('/reservations/new')} className={btnPrimary}>
              + New Reservation
            </button>
          </PermissionGuard>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <input
          className={inputCls}
          placeholder="Search code or guest…"
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          aria-label="Search reservations"
        />
        <select
          className={inputCls}
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          {RESERVATION_STATUSES.map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <input
          type="date"
          className={inputCls}
          value={filters.from}
          onChange={(e) => setFilters({ ...filters, from: e.target.value })}
          aria-label="Arrivals from"
        />
        <input
          type="date"
          className={inputCls}
          value={filters.to}
          onChange={(e) => setFilters({ ...filters, to: e.target.value })}
          aria-label="Departures to"
        />
      </div>

      {loadError && (
        <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
          {loadError}{' '}
          <button type="button" onClick={load} className="underline">
            Retry
          </button>
        </div>
      )}

      <DataTable
        columns={[
          {
            key: 'confirmation_code',
            label: 'Code',
            sortable: true,
            render: (r) => (
              <Link to={`/reservations/${r.id}`} className="font-semibold text-gold-300 hover:underline">
                {r.confirmation_code}
              </Link>
            ),
          },
          {
            key: 'guest_id',
            label: 'Guest',
            render: (r) => {
              const g = guestById(r.guest_id);
              return g ? (
                <Link to="/guests" className="hover:underline">{guestDisplayName(g)}</Link>
              ) : '—';
            },
          },
          {
            key: 'check_in',
            label: 'Dates',
            render: (r) => (
              <span className="text-sm">
                {r.check_in} → {r.check_out}
                <span className="ml-1 text-slate-500">({nightsBetween(r.check_in, r.check_out)}n)</span>
              </span>
            ),
          },
          {
            key: 'room',
            label: 'Room / Type',
            render: (r) => (r.room_id ? `${roomNumber(r.room_id)} · ${typeName(r.room_type_id)}` : typeName(r.room_type_id)),
          },
          {
            key: 'total',
            label: 'Total est.',
            render: (r) => formatMoney(r.total_estimate ?? nightsBetween(r.check_in, r.check_out) * Number(r.nightly_rate || 0)),
          },
          {
            key: 'status',
            label: 'Status',
            render: (r) => <StatusBadge value={r.status} />,
          },
          {
            key: 'actions',
            label: '',
            render: (r) => (
              <PermissionGuard permission="reservations.manage">
                <div className="flex justify-end gap-2">
                  {canAct(r, 'confirm') && (
                    <button type="button" onClick={() => openAction(r, 'confirm')} className={btnSecondary}>
                      Confirm
                    </button>
                  )}
                  {canAct(r, 'no-show') && (
                    <button type="button" onClick={() => openAction(r, 'no-show')} className={btnSecondary}>
                      No-show
                    </button>
                  )}
                  {canAct(r, 'cancel') && (
                    <button type="button" onClick={() => openAction(r, 'cancel')} className={btnDanger}>
                      Cancel
                    </button>
                  )}
                </div>
              </PermissionGuard>
            ),
          },
        ]}
        rows={filtered}
        loading={loading}
        emptyTitle="No reservations yet"
        emptyMessage="Create your first reservation to start filling rooms."
      />

      <Modal
        open={!!actionTarget}
        onClose={() => setActionTarget(null)}
        title={actionTarget ? actionTitle[actionTarget.action] : ''}
      >
        <div className="p-5">
          <p className="text-sm text-slate-300">
            {actionTarget && actionCopy[actionTarget.action](actionTarget.reservation)}
          </p>
          {actionTarget?.action === 'cancel' && (
            <Field label="Cancellation reason" className="mt-4">
              <textarea
                className={inputCls}
                rows={2}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Guest requested cancellation…"
              />
            </Field>
          )}
          {actionError && <p className="mt-2 text-sm text-red-400">{actionError}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setActionTarget(null)} className={btnSecondary} disabled={acting}>
              Back
            </button>
            <button
              type="button"
              onClick={performAction}
              disabled={acting || (actionTarget?.action === 'cancel' && !cancelReason.trim())}
              className={actionTarget?.action === 'confirm' ? btnPrimary : btnDanger}
            >
              {acting ? 'Working…' : actionTarget ? actionTitle[actionTarget.action] : ''}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
