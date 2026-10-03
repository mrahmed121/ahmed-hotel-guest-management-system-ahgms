import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../../../components/PageHeader';
import DataTable from '../../../components/DataTable';
import StatusBadge from '../../../components/StatusBadge';
import Modal from '../../../components/Modal';
import PermissionGuard from '../../../components/PermissionGuard';
import {
  staysApi,
  todayStr,
  unwrapList,
  isDepartureToday,
  CHECK_IN_PERM,
  CHECK_OUT_PERM,
  ROOM_MOVE_PERM,
} from '../services/frontdeskApi';
import { reservationsApi, nightsBetween, formatMoney } from '../../reservations/services/reservationApi';
import { guestsApi } from '../../guests/services/guestApi';
import { roomTypesApi, roomsApi } from '../../inventory/services/inventoryApi';
import { guestDisplayName } from '../../guests/pages/GuestsPage';
import {
  Field,
  inputCls,
  btnPrimary,
  btnSecondary,
  btnDanger,
  firstError,
} from '../../reservations/components/form';

const TABS = [
  { key: 'arrivals', label: 'Arrivals Today' },
  { key: 'inhouse', label: 'In-House' },
  { key: 'departures', label: 'Departures Today' },
];

const emptyCheckIn = { reservation_id: '', room_id: '', notes: '' };
const emptyWalkIn = {
  first_name: '',
  last_name: '',
  phone: '',
  email: '',
  room_type_id: '',
  room_id: '',
  check_out: '',
  adults: '1',
  children: '0',
  notes: '',
};

export default function FrontDeskPage() {
  const today = todayStr();
  const [tab, setTab] = useState('arrivals');
  const [reservations, setReservations] = useState([]);
  const [stays, setStays] = useState([]);
  const [guests, setGuests] = useState([]);
  const [roomTypes, setRoomTypes] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // Modals: null | {kind:'checkin'} | {kind:'checkout', stay} | {kind:'roommove', stay}
  const [modal, setModal] = useState(null);
  const [walkInMode, setWalkInMode] = useState(false);
  const [checkInForm, setCheckInForm] = useState(emptyCheckIn);
  const [walkInForm, setWalkInForm] = useState(emptyWalkIn);
  const [moveForm, setMoveForm] = useState({ new_room_id: '', reason: '' });
  const [checkOutNotes, setCheckOutNotes] = useState('');
  const [acting, setActing] = useState(false);
  const [errors, setErrors] = useState({});
  const [actionError, setActionError] = useState('');

  const load = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [r, s, g, t, rm] = await Promise.all([
        reservationsApi.list({ per_page: 300 }),
        staysApi.list({ status: 'in_house', per_page: 300 }),
        guestsApi.list({ per_page: 500 }),
        roomTypesApi.list({ per_page: 100 }),
        roomsApi.list({ per_page: 500 }),
      ]);
      setReservations(unwrapList(r));
      setStays(unwrapList(s));
      setGuests(unwrapList(g));
      setRoomTypes(unwrapList(t));
      setRooms(unwrapList(rm));
    } catch {
      setLoadError('Could not load front desk data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const guestById = (id) => guests.find((g) => g.id === id);
  const typeName = (id) => roomTypes.find((t) => t.id === id)?.name || '—';
  const roomById = (id) => rooms.find((r) => r.id === id);
  const roomNumber = (id) => roomById(id)?.number || '—';

  const arrivals = useMemo(
    () =>
      reservations.filter(
        (r) => r.status === 'confirmed' && (r.check_in === today || r.check_in?.startsWith?.(today))
      ),
    [reservations, today]
  );
  const departures = useMemo(() => stays.filter((s) => isDepartureToday(s, today)), [stays, today]);
  const availableRooms = useMemo(() => rooms.filter((r) => r.status === 'available'), [rooms]);

  const openCheckIn = (reservationId = '') => {
    setModal({ kind: 'checkin' });
    setWalkInMode(false);
    setCheckInForm({ ...emptyCheckIn, reservation_id: reservationId ? String(reservationId) : '' });
    setWalkInForm(emptyWalkIn);
    setErrors({});
    setActionError('');
  };

  const openCheckOut = (stay) => {
    setModal({ kind: 'checkout', stay });
    setCheckOutNotes('');
    setActionError('');
  };

  const openRoomMove = (stay) => {
    setModal({ kind: 'roommove', stay });
    setMoveForm({ new_room_id: '', reason: '' });
    setErrors({});
    setActionError('');
  };

  const handleCheckIn = async () => {
    setActing(true);
    setErrors({});
    setActionError('');
    try {
      if (walkInMode) {
        const payload = {
          ...walkInForm,
          adults: Number(walkInForm.adults) || 1,
          children: Number(walkInForm.children) || 0,
          room_type_id: Number(walkInForm.room_type_id) || undefined,
          room_id: walkInForm.room_id ? Number(walkInForm.room_id) : undefined,
        };
        await staysApi.walkIn(payload);
      } else {
        await staysApi.checkIn({
          reservation_id: Number(checkInForm.reservation_id),
          room_id: checkInForm.room_id ? Number(checkInForm.room_id) : undefined,
          notes: checkInForm.notes || undefined,
        });
      }
      setModal(null);
      await load();
    } catch (err) {
      setErrors(err.response?.data?.errors || {});
      setActionError(err.response?.data?.message || 'Check-in failed.');
    } finally {
      setActing(false);
    }
  };

  const handleCheckOut = async () => {
    const stay = modal?.stay;
    if (!stay) return;
    setActing(true);
    setActionError('');
    try {
      await staysApi.checkOut(stay.id, { notes: checkOutNotes || undefined });
      setModal(null);
      await load();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Check-out failed.');
    } finally {
      setActing(false);
    }
  };

  const handleRoomMove = async () => {
    const stay = modal?.stay;
    if (!stay) return;
    setActing(true);
    setErrors({});
    setActionError('');
    try {
      await staysApi.roomMove(stay.id, {
        new_room_id: Number(moveForm.new_room_id),
        reason: moveForm.reason,
      });
      setModal(null);
      await load();
    } catch (err) {
      setErrors(err.response?.data?.errors || {});
      setActionError(err.response?.data?.message || 'Room move failed.');
    } finally {
      setActing(false);
    }
  };

  const walkInRooms = useMemo(() => {
    if (!walkInForm.room_type_id) return availableRooms;
    return availableRooms.filter((r) => String(r.room_type_id) === String(walkInForm.room_type_id));
  }, [availableRooms, walkInForm.room_type_id]);

  const checkInReservation = checkInForm.reservation_id
    ? reservations.find((r) => String(r.id) === String(checkInForm.reservation_id))
    : null;

  return (
    <div>
      <PageHeader
        title="Front Desk"
        subtitle="Today's arrivals, in-house stays, and departures."
        actions={
          <PermissionGuard permission={CHECK_IN_PERM}>
            <div className="flex gap-2">
              <button type="button" onClick={() => openCheckIn()} className={btnSecondary}>
                Check-in
              </button>
              <button
                type="button"
                onClick={() => {
                  openCheckIn();
                  setWalkInMode(true);
                }}
                className={btnPrimary}
              >
                + Walk-in
              </button>
            </div>
          </PermissionGuard>
        }
      />

      {/* Tabs */}
      <div className="mb-4 flex gap-1 overflow-x-auto rounded-lg border border-charcoal-700 bg-charcoal-900 p-1" role="tablist" aria-label="Front desk views">
        {TABS.map((t) => {
          const count =
            t.key === 'arrivals' ? arrivals.length : t.key === 'inhouse' ? stays.length : departures.length;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={active}
              type="button"
              onClick={() => setTab(t.key)}
              className={`flex-1 whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-gold-500 ${
                active ? 'bg-gold-500 text-charcoal-950' : 'text-slate-300 hover:bg-charcoal-800'
              }`}
            >
              {t.label}
              <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${active ? 'bg-charcoal-950/20' : 'bg-charcoal-700'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {loadError && (
        <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
          {loadError}{' '}
          <button type="button" onClick={load} className="underline">
            Retry
          </button>
        </div>
      )}

      {tab === 'arrivals' && (
        <DataTable
          columns={[
            {
              key: 'confirmation_code',
              label: 'Reservation',
              render: (r) => (
                <Link to={`/reservations/${r.id}`} className="font-semibold text-gold-300 hover:underline">
                  {r.confirmation_code}
                </Link>
              ),
            },
            {
              key: 'guest',
              label: 'Guest',
              render: (r) => {
                const g = guestById(r.guest_id);
                return g ? guestDisplayName(g) : '—';
              },
            },
            {
              key: 'room',
              label: 'Room / Type',
              render: (r) => (r.room_id ? `${roomNumber(r.room_id)} · ` : '') + typeName(r.room_type_id),
            },
            {
              key: 'dates',
              label: 'Stay',
              render: (r) => (
                <span className="text-sm">
                  {r.check_in} → {r.check_out} ({nightsBetween(r.check_in, r.check_out)}n)
                </span>
              ),
            },
            {
              key: 'total',
              label: 'Est. total',
              render: (r) => formatMoney(r.total_estimate ?? nightsBetween(r.check_in, r.check_out) * Number(r.nightly_rate || 0)),
            },
            {
              key: 'actions',
              label: '',
              render: (r) => (
                <PermissionGuard permission={CHECK_IN_PERM}>
                  <div className="flex justify-end">
                    <button type="button" onClick={() => openCheckIn(r.id)} className={btnPrimary}>
                      Check-in
                    </button>
                  </div>
                </PermissionGuard>
              ),
            },
          ]}
          rows={arrivals}
          loading={loading}
          emptyTitle="No arrivals today"
          emptyMessage="No confirmed reservations are checking in today."
        />
      )}

      {tab === 'inhouse' && (
        <DataTable
          columns={[
            {
              key: 'room',
              label: 'Room',
              render: (s) => (
                <Link to={`/stays/${s.id}`} className="font-semibold text-gold-300 hover:underline">
                  {roomNumber(s.room_id)}
                </Link>
              ),
            },
            {
              key: 'guest',
              label: 'Guest',
              render: (s) => {
                const g = s.guest ?? guestById(s.guest_id);
                return g ? guestDisplayName(g) : '—';
              },
            },
            {
              key: 'dates',
              label: 'Stay',
              render: (s) => {
                const res = s.reservation ?? {};
                return (
                  <span className="text-sm">
                    {res.check_in} → {res.check_out}
                  </span>
                );
              },
            },
            {
              key: 'checked_in',
              label: 'Checked in',
              render: (s) => <span className="text-sm text-slate-400">{s.checked_in_at?.slice(0, 16).replace('T', ' ') ?? '—'}</span>,
            },
            {
              key: 'status',
              label: 'Status',
              render: (s) => <StatusBadge value={s.status} />,
            },
            {
              key: 'actions',
              label: '',
              render: (s) => (
                <div className="flex justify-end gap-2">
                  <PermissionGuard permission={ROOM_MOVE_PERM}>
                    <button type="button" onClick={() => openRoomMove(s)} className={btnSecondary}>
                      Room move
                    </button>
                  </PermissionGuard>
                  <PermissionGuard permission={CHECK_OUT_PERM}>
                    <button type="button" onClick={() => openCheckOut(s)} className={btnDanger}>
                      Check-out
                    </button>
                  </PermissionGuard>
                </div>
              ),
            },
          ]}
          rows={stays}
          loading={loading}
          emptyTitle="No in-house guests"
          emptyMessage="Checked-in stays will appear here."
        />
      )}

      {tab === 'departures' && (
        <DataTable
          columns={[
            {
              key: 'room',
              label: 'Room',
              render: (s) => (
                <Link to={`/stays/${s.id}`} className="font-semibold text-gold-300 hover:underline">
                  {roomNumber(s.room_id)}
                </Link>
              ),
            },
            {
              key: 'guest',
              label: 'Guest',
              render: (s) => {
                const g = s.guest ?? guestById(s.guest_id);
                return g ? guestDisplayName(g) : '—';
              },
            },
            {
              key: 'checkout',
              label: 'Expected checkout',
              render: (s) => s.reservation?.check_out ?? '—',
            },
            {
              key: 'status',
              label: 'Status',
              render: (s) => <StatusBadge value={s.status} />,
            },
            {
              key: 'actions',
              label: '',
              render: (s) => (
                <PermissionGuard permission={CHECK_OUT_PERM}>
                  <div className="flex justify-end">
                    <button type="button" onClick={() => openCheckOut(s)} className={btnDanger}>
                      Check-out
                    </button>
                  </div>
                </PermissionGuard>
              ),
            },
          ]}
          rows={departures}
          loading={loading}
          emptyTitle="No departures today"
          emptyMessage="No stays are scheduled to check out today."
        />
      )}

      {/* Check-in modal */}
      <Modal open={modal?.kind === 'checkin'} onClose={() => setModal(null)} title="Check-in" wide>
        <div className="mb-4 flex gap-1 rounded-lg border border-charcoal-700 bg-charcoal-900 p-1">
          <button
            type="button"
            onClick={() => setWalkInMode(false)}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium ${!walkInMode ? 'bg-gold-500 text-charcoal-950' : 'text-slate-300 hover:bg-charcoal-800'}`}
          >
            From reservation
          </button>
          <button
            type="button"
            onClick={() => setWalkInMode(true)}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium ${walkInMode ? 'bg-gold-500 text-charcoal-950' : 'text-slate-300 hover:bg-charcoal-800'}`}
          >
            Walk-in
          </button>
        </div>

        {!walkInMode ? (
          <div className="grid gap-4">
            <Field label="Reservation" error={firstError(errors, 'reservation_id')}>
              <select
                className={inputCls}
                value={checkInForm.reservation_id}
                onChange={(e) => setCheckInForm({ ...checkInForm, reservation_id: e.target.value })}
              >
                <option value="">Select a confirmed reservation…</option>
                {reservations
                  .filter((r) => r.status === 'confirmed')
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.confirmation_code} — {guestById(r.guest_id) ? guestDisplayName(guestById(r.guest_id)) : '—'} ({r.check_in} → {r.check_out})
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Room (optional — auto-assign if blank)" error={firstError(errors, 'room_id')}>
              <select
                className={inputCls}
                value={checkInForm.room_id}
                onChange={(e) => setCheckInForm({ ...checkInForm, room_id: e.target.value })}
              >
                <option value="">Auto-assign an available room</option>
                {availableRooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.number} — {typeName(r.room_type_id)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Notes" error={firstError(errors, 'notes')}>
              <textarea
                className={inputCls}
                rows={2}
                value={checkInForm.notes}
                onChange={(e) => setCheckInForm({ ...checkInForm, notes: e.target.value })}
                placeholder="Early arrival, extra bed requested…"
              />
            </Field>
            {checkInReservation && (
              <p className="text-sm text-slate-400">
                {nightsBetween(checkInReservation.check_in, checkInReservation.check_out)} night(s), est.{' '}
                {formatMoney(
                  checkInReservation.total_estimate ??
                    nightsBetween(checkInReservation.check_in, checkInReservation.check_out) *
                      Number(checkInReservation.nightly_rate || 0)
                )}
              </p>
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="First name" error={firstError(errors, 'first_name')}>
              <input
                className={inputCls}
                value={walkInForm.first_name}
                onChange={(e) => setWalkInForm({ ...walkInForm, first_name: e.target.value })}
              />
            </Field>
            <Field label="Last name" error={firstError(errors, 'last_name')}>
              <input
                className={inputCls}
                value={walkInForm.last_name}
                onChange={(e) => setWalkInForm({ ...walkInForm, last_name: e.target.value })}
              />
            </Field>
            <Field label="Phone" error={firstError(errors, 'phone')}>
              <input
                className={inputCls}
                value={walkInForm.phone}
                onChange={(e) => setWalkInForm({ ...walkInForm, phone: e.target.value })}
              />
            </Field>
            <Field label="Email (optional)" error={firstError(errors, 'email')}>
              <input
                className={inputCls}
                type="email"
                value={walkInForm.email}
                onChange={(e) => setWalkInForm({ ...walkInForm, email: e.target.value })}
              />
            </Field>
            <Field label="Room type" error={firstError(errors, 'room_type_id')}>
              <select
                className={inputCls}
                value={walkInForm.room_type_id}
                onChange={(e) => setWalkInForm({ ...walkInForm, room_type_id: e.target.value, room_id: '' })}
              >
                <option value="">Select room type…</option>
                {roomTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} — {formatMoney(t.base_rate)}/night
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Room (optional)" error={firstError(errors, 'room_id')}>
              <select
                className={inputCls}
                value={walkInForm.room_id}
                onChange={(e) => setWalkInForm({ ...walkInForm, room_id: e.target.value })}
              >
                <option value="">Auto-assign</option>
                {walkInRooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.number} — {typeName(r.room_type_id)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Check-out date" error={firstError(errors, 'check_out')}>
              <input
                type="date"
                className={inputCls}
                min={today}
                value={walkInForm.check_out}
                onChange={(e) => setWalkInForm({ ...walkInForm, check_out: e.target.value })}
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Adults" error={firstError(errors, 'adults')}>
                <input
                  type="number"
                  min="1"
                  className={inputCls}
                  value={walkInForm.adults}
                  onChange={(e) => setWalkInForm({ ...walkInForm, adults: e.target.value })}
                />
              </Field>
              <Field label="Children" error={firstError(errors, 'children')}>
                <input
                  type="number"
                  min="0"
                  className={inputCls}
                  value={walkInForm.children}
                  onChange={(e) => setWalkInForm({ ...walkInForm, children: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Notes" className="sm:col-span-2" error={firstError(errors, 'notes')}>
              <textarea
                className={inputCls}
                rows={2}
                value={walkInForm.notes}
                onChange={(e) => setWalkInForm({ ...walkInForm, notes: e.target.value })}
              />
            </Field>
          </div>
        )}

        {actionError && (
          <p role="alert" className="mt-3 text-sm text-red-400">
            {actionError}
          </p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => setModal(null)} className={btnSecondary} disabled={acting}>
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCheckIn}
            disabled={acting || (!walkInMode && !checkInForm.reservation_id)}
            className={btnPrimary}
          >
            {acting ? 'Checking in…' : 'Confirm check-in'}
          </button>
        </div>
      </Modal>

      {/* Check-out modal */}
      <Modal open={modal?.kind === 'checkout'} onClose={() => setModal(null)} title="Check-out">
        {modal?.stay && (
          <div className="space-y-3">
            <p className="text-sm text-slate-300">
              Checking out{' '}
              <strong className="text-slate-100">
                {modal.stay.guest ? guestDisplayName(modal.stay.guest) : '—'}
              </strong>{' '}
              from room <strong className="text-slate-100">{roomNumber(modal.stay.room_id)}</strong>.
            </p>
            <div className="rounded-lg border border-charcoal-700 bg-charcoal-900 p-3 text-sm text-slate-400">
              <p className="font-medium text-slate-300">Folio balance</p>
              <p>
                Folio settlement is finalized in the Folios module (P5). The room will move to the
                housekeeping queue for turnover after check-out.
              </p>
            </div>
            <Field label="Check-out notes">
              <textarea
                className={inputCls}
                rows={2}
                value={checkOutNotes}
                onChange={(e) => setCheckOutNotes(e.target.value)}
                placeholder="Late checkout approved, minibar checked…"
              />
            </Field>
            {actionError && (
              <p role="alert" className="text-sm text-red-400">
                {actionError}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setModal(null)} className={btnSecondary} disabled={acting}>
                Cancel
              </button>
              <button type="button" onClick={handleCheckOut} disabled={acting} className={btnDanger}>
                {acting ? 'Checking out…' : 'Confirm check-out'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Room move modal */}
      <Modal open={modal?.kind === 'roommove'} onClose={() => setModal(null)} title="Room move">
        {modal?.stay && (
          <div className="grid gap-4">
            <p className="text-sm text-slate-300">
              Move <strong className="text-slate-100">{roomNumber(modal.stay.room_id)}</strong> to a new
              room. History is preserved on the stay.
            </p>
            <Field label="New room (available only)" error={firstError(errors, 'new_room_id')}>
              <select
                className={inputCls}
                value={moveForm.new_room_id}
                onChange={(e) => setMoveForm({ ...moveForm, new_room_id: e.target.value })}
              >
                <option value="">Select a room…</option>
                {availableRooms
                  .filter((r) => r.id !== modal.stay.room_id)
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.number} — {typeName(r.room_type_id)}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Reason" error={firstError(errors, 'reason')}>
              <textarea
                className={inputCls}
                rows={2}
                value={moveForm.reason}
                onChange={(e) => setMoveForm({ ...moveForm, reason: e.target.value })}
                placeholder="Guest requested quieter room…"
              />
            </Field>
            {actionError && (
              <p role="alert" className="text-sm text-red-400">
                {actionError}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setModal(null)} className={btnSecondary} disabled={acting}>
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRoomMove}
                disabled={acting || !moveForm.new_room_id || !moveForm.reason.trim()}
                className={btnPrimary}
              >
                {acting ? 'Moving…' : 'Confirm room move'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
