import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../../../components/PageHeader';
import StatusBadge from '../../../components/StatusBadge';
import Spinner from '../../../components/Spinner';
import EmptyState from '../../../components/EmptyState';
import Modal from '../../../components/Modal';
import PermissionGuard from '../../../components/PermissionGuard';
import { staysApi, unwrapOne, CHECK_OUT_PERM, ROOM_MOVE_PERM } from '../services/frontdeskApi';
import { roomsApi } from '../../inventory/services/inventoryApi';
import { foliosApi, formatPKR } from '../../folio/services/folioApi';
import { guestDisplayName } from '../../guests/pages/GuestsPage';
import { nightsBetween } from '../../reservations/services/reservationApi';
import { Field, inputCls, btnPrimary, btnSecondary, btnDanger, firstError } from '../../reservations/components/form';

function fmtDateTime(v) {
  if (!v) return '—';
  return String(v).slice(0, 16).replace('T', ' ');
}

export default function StayDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [stay, setStay] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [modal, setModal] = useState(null); // null | {kind:'checkout'} | {kind:'roommove'}
  const [moveForm, setMoveForm] = useState({ new_room_id: '', reason: '' });
  const [checkOutNotes, setCheckOutNotes] = useState('');
  const [availableRooms, setAvailableRooms] = useState([]);
  const [acting, setActing] = useState(false);
  const [errors, setErrors] = useState({});
  const [actionError, setActionError] = useState('');
  const [folioSummary, setFolioSummary] = useState(null);
  const [folioLoading, setFolioLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    setNotFound(false);
    try {
      const payload = await staysApi.get(id);
      setStay(unwrapOne(payload));
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

  const openRoomMove = async () => {
    setModal({ kind: 'roommove' });
    setMoveForm({ new_room_id: '', reason: '' });
    setErrors({});
    setActionError('');
    try {
      const payload = await roomsApi.list({ status: 'available', per_page: 500 });
      const list = payload?.data?.data ?? payload?.data ?? [];
      setAvailableRooms(Array.isArray(list) ? list : []);
    } catch {
      setAvailableRooms([]);
    }
  };

  const handleRoomMove = async () => {
    setActing(true);
    setErrors({});
    setActionError('');
    try {
      await staysApi.roomMove(id, {
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

  const handleCheckOut = async () => {
    setActing(true);
    setActionError('');
    try {
      await staysApi.checkOut(id, { notes: checkOutNotes || undefined });
      setModal(null);
      navigate('/front-desk');
    } catch (err) {
      setActionError(err.response?.data?.message || 'Check-out failed.');
    } finally {
      setActing(false);
    }
  };

  const openCheckOut = async () => {
    setModal({ kind: 'checkout' });
    setCheckOutNotes('');
    setActionError('');
    setFolioSummary(null);
    setFolioLoading(true);
    try {
      const folio = await foliosApi.byStay(id);
      if (folio) {
        const t = folio.totals ?? {};
        setFolioSummary({
          id: folio.id,
          folio_number: folio.folio_number,
          balance: Number(t.balance ?? 0),
        });
      }
    } catch {
      setFolioSummary(null);
    } finally {
      setFolioLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  if (notFound || !stay) {
    return <EmptyState title="Stay not found" message="This stay does not exist or you cannot access it." />;
  }

  const guest = stay.guest ?? {};
  const reservation = stay.reservation ?? {};
  const room = stay.room ?? {};
  const history = stay.room_history ?? stay.roomHistory ?? [];
  const inHouse = stay.status === 'in_house';
  const stayNights =
    reservation.check_in && reservation.check_out
      ? nightsBetween(reservation.check_in, reservation.check_out)
      : null;

  return (
    <div>
      <PageHeader
        title={`Stay — Room ${room.number ?? '—'}`}
        subtitle={`${guestDisplayName(guest)} · checked in ${fmtDateTime(stay.checked_in_at)}`}
        actions={
          <div className="flex gap-2">
            <Link to="/front-desk" className={btnSecondary}>
              Back to Front Desk
            </Link>
            {inHouse && (
              <>
                <PermissionGuard permission={ROOM_MOVE_PERM}>
                  <button type="button" onClick={openRoomMove} className={btnSecondary}>
                    Room move
                  </button>
                </PermissionGuard>
                <PermissionGuard permission={CHECK_OUT_PERM}>
                  <button
                    type="button"
                    onClick={openCheckOut}
                    className={btnDanger}
                  >
                    Check-out
                  </button>
                </PermissionGuard>
              </>
            )}
          </div>
        }
      />

      <div className="mb-4 flex items-center gap-3">
        <StatusBadge value={stay.status} />
        <span className="text-sm text-slate-400">
          {reservation.confirmation_code && (
            <>
              Reservation{' '}
              <Link to={`/reservations/${reservation.id}`} className="text-gold-300 hover:underline">
                {reservation.confirmation_code}
              </Link>
            </>
          )}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-xl border border-charcoal-700 bg-charcoal-900 p-5">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Guest</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Name</dt>
              <dd className="font-medium text-slate-100">{guestDisplayName(guest)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Phone</dt>
              <dd className="text-slate-200">{guest.phone ?? '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Email</dt>
              <dd className="text-slate-200">{guest.email ?? '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Country</dt>
              <dd className="text-slate-200">{guest.country ?? '—'}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-xl border border-charcoal-700 bg-charcoal-900 p-5">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Stay</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Room</dt>
              <dd className="font-medium text-slate-100">{room.number ?? '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Check-in</dt>
              <dd className="text-slate-200">{fmtDateTime(stay.checked_in_at)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Expected check-out</dt>
              <dd className="text-slate-200">{reservation.check_out ?? '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Actual check-out</dt>
              <dd className="text-slate-200">{fmtDateTime(stay.checked_out_at)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Nights</dt>
              <dd className="text-slate-200">{stayNights ?? '—'}</dd>
            </div>
            {stay.notes && (
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Notes</dt>
                <dd className="text-right text-slate-200">{stay.notes}</dd>
              </div>
            )}
          </dl>
        </section>
      </div>

      <section className="mt-4 rounded-xl border border-charcoal-700 bg-charcoal-900 p-5">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Room move history
        </h3>
        {history.length === 0 ? (
          <p className="text-sm text-slate-500">No room moves recorded for this stay.</p>
        ) : (
          <ol className="space-y-3">
            {history.map((h, i) => (
              <li key={h.id ?? i} className="flex gap-3 text-sm">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-gold-500" aria-hidden="true" />
                <div>
                  <p className="text-slate-200">
                    {h.from_room?.number ?? h.from_room_number ?? '—'} →{' '}
                    {h.to_room?.number ?? h.to_room_number ?? '—'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {h.reason ?? '—'} · {fmtDateTime(h.moved_at ?? h.created_at)}
                    {h.actor?.name ? ` · by ${h.actor.name}` : ''}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <Modal open={modal?.kind === 'roommove'} onClose={() => setModal(null)} title="Room move">
        <div className="grid gap-4">
          <p className="text-sm text-slate-300">
            Move room <strong className="text-slate-100">{room.number}</strong> to a new room. History is
            preserved.
          </p>
          <Field label="New room (available only)" error={firstError(errors, 'new_room_id')}>
            <select
              className={inputCls}
              value={moveForm.new_room_id}
              onChange={(e) => setMoveForm({ ...moveForm, new_room_id: e.target.value })}
            >
              <option value="">Select a room…</option>
              {availableRooms
                .filter((r) => r.id !== stay.room_id)
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.number}
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
      </Modal>

      <Modal open={modal?.kind === 'checkout'} onClose={() => setModal(null)} title="Check-out">
        <div className="space-y-3">
          <p className="text-sm text-slate-300">
            Checking out <strong className="text-slate-100">{guestDisplayName(guest)}</strong> from room{' '}
            <strong className="text-slate-100">{room.number}</strong>.
          </p>
          <div className="rounded-lg border border-charcoal-700 bg-charcoal-950 p-3 text-sm">
            {folioLoading ? (
              <p className="text-slate-500">Loading folio balance…</p>
            ) : folioSummary ? (
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-slate-400">
                    Folio{' '}
                    <Link to={`/folios/${folioSummary.id}`} className="font-medium text-gold-300 hover:underline">
                      {folioSummary.folio_number ?? ''}
                    </Link>{' '}
                    balance due
                  </p>
                  <p className="mt-1 text-lg font-bold text-gold-400">{formatPKR(Math.max(0, folioSummary.balance))}</p>
                </div>
                {folioSummary.balance > 0 && (
                  <p className="max-w-[16rem] text-xs text-amber-300">
                    Outstanding balance must be settled in the Folios module before check-out.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-slate-500">No folio found for this stay yet.</p>
            )}
          </div>
          <p className="text-xs text-slate-500">
            After check-out the room moves to the housekeeping queue for turnover.
          </p>
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
      </Modal>
    </div>
  );
}
