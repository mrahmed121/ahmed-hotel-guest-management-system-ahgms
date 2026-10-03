import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import PageHeader from '../../../components/PageHeader';
import StatusBadge from '../../../components/StatusBadge';
import Spinner from '../../../components/Spinner';
import EmptyState from '../../../components/EmptyState';
import Modal from '../../../components/Modal';
import PermissionGuard from '../../../components/PermissionGuard';
import {
  reservationsApi,
  ACTIVE_RESERVATION_STATUSES,
  nightsBetween,
  formatMoney,
} from '../services/reservationApi';
import { guestsApi } from '../../guests/services/guestApi';
import { roomTypesApi, roomsApi } from '../../inventory/services/inventoryApi';
import { guestDisplayName } from '../../guests/pages/GuestsPage';
import { Field, inputCls, btnPrimary, btnSecondary, btnDanger } from '../components/form';

export default function ReservationDetailPage() {
  const { id } = useParams();
  const [reservation, setReservation] = useState(null);
  const [guest, setGuest] = useState(null);
  const [roomType, setRoomType] = useState(null);
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [action, setAction] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [acting, setActing] = useState(false);
  const [actionError, setActionError] = useState('');

  const load = async () => {
    setLoading(true);
    setNotFound(false);
    try {
      const r = await reservationsApi.get(id);
      const res = r.data ?? r;
      setReservation(res);
      const [g, t] = await Promise.all([
        res.guest_id ? guestsApi.get(res.guest_id).catch(() => null) : null,
        res.room_type_id ? roomTypesApi.get(res.room_type_id).catch(() => null) : null,
      ]);
      setGuest(g ? (g.data ?? g) : null);
      setRoomType(t ? (t.data ?? t) : null);
      if (res.room_id) {
        const rm = await roomsApi.get(res.room_id).catch(() => null);
        setRoom(rm ? (rm.data ?? rm) : null);
      }
    } catch (err) {
      if (err.response?.status === 404) setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const performAction = async () => {
    setActing(true);
    setActionError('');
    try {
      if (action === 'confirm') await reservationsApi.confirm(id);
      else if (action === 'no-show') await reservationsApi.noShow(id);
      else if (action === 'cancel') await reservationsApi.cancel(id, { reason: cancelReason });
      setAction(null);
      setCancelReason('');
      await load();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Action failed.');
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return <div className="py-16 text-center"><Spinner /></div>;
  }
  if (notFound || !reservation) {
    return <EmptyState title="Reservation not found" message="It may have been deleted or you lack access." />;
  }

  const nights = nightsBetween(reservation.check_in, reservation.check_out);
  const total = reservation.total_estimate ?? nights * Number(reservation.nightly_rate || 0);
  const canConfirm = reservation.status === 'reserved';
  const canCancel = ACTIVE_RESERVATION_STATUSES.includes(reservation.status);
  const canNoShow = ['reserved', 'confirmed'].includes(reservation.status);

  return (
    <div>
      <PageHeader
        title={`Reservation ${reservation.confirmation_code}`}
        subtitle={`${reservation.check_in} → ${reservation.check_out} · ${nights} night${nights === 1 ? '' : 's'}`}
        actions={<StatusBadge value={reservation.status} />}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-charcoal-700 bg-charcoal-900 p-5 lg:col-span-2">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Stay details</h3>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Guest</dt>
              <dd className="text-slate-200">
                {guest ? <Link to="/guests" className="text-gold-300 hover:underline">{guestDisplayName(guest)}</Link> : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Room</dt>
              <dd className="text-slate-200">{room ? `Room ${room.number}` : 'To be assigned'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Room type</dt>
              <dd className="text-slate-200">{roomType?.name || '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Party</dt>
              <dd className="text-slate-200">{reservation.adults ?? 1} adult{(reservation.adults ?? 1) === 1 ? '' : 's'}{reservation.children ? `, ${reservation.children} children` : ''}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Nightly rate</dt>
              <dd className="text-slate-200">{formatMoney(reservation.nightly_rate)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Source</dt>
              <dd className="text-slate-200">{String(reservation.source || '—').replace(/_/g, ' ')}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-slate-500">Notes</dt>
              <dd className="text-slate-200">{reservation.notes || '—'}</dd>
            </div>
          </dl>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-charcoal-700 bg-charcoal-900 p-5">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Estimate</h3>
            <p className="text-2xl font-bold text-gold-300">{formatMoney(total)}</p>
            <p className="mt-1 text-xs text-slate-500">{nights} nights × {formatMoney(reservation.nightly_rate)}</p>
          </div>

          <PermissionGuard permission="reservations.manage">
            <div className="rounded-xl border border-charcoal-700 bg-charcoal-900 p-5">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Actions</h3>
              <div className="flex flex-col gap-2">
                {canConfirm && (
                  <button type="button" onClick={() => { setAction('confirm'); setActionError(''); }} className={btnPrimary}>
                    Confirm reservation
                  </button>
                )}
                {canNoShow && (
                  <button type="button" onClick={() => { setAction('no-show'); setActionError(''); }} className={btnSecondary}>
                    Mark as no-show
                  </button>
                )}
                {canCancel && (
                  <button type="button" onClick={() => { setAction('cancel'); setActionError(''); setCancelReason(''); }} className={btnDanger}>
                    Cancel reservation
                  </button>
                )}
                {!canConfirm && !canCancel && !canNoShow && (
                  <p className="text-sm text-slate-500">No actions available for this status.</p>
                )}
              </div>
            </div>
          </PermissionGuard>
        </div>
      </div>

      <Modal
        open={!!action}
        onClose={() => setAction(null)}
        title={action === 'confirm' ? 'Confirm reservation' : action === 'cancel' ? 'Cancel reservation' : 'Mark as no-show'}
      >
        <div className="p-5">
          {action === 'cancel' && (
            <Field label="Cancellation reason" className="mb-4">
              <textarea className={inputCls} rows={2} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Guest requested cancellation…" />
            </Field>
          )}
          {actionError && <p className="mb-2 text-sm text-red-400">{actionError}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setAction(null)} className={btnSecondary} disabled={acting}>Back</button>
            <button
              type="button"
              onClick={performAction}
              disabled={acting || (action === 'cancel' && !cancelReason.trim())}
              className={action === 'confirm' ? btnPrimary : btnDanger}
            >
              {acting ? 'Working…' : 'Confirm'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
