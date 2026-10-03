import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PageHeader from '../../../components/PageHeader';
import EmptyState from '../../../components/EmptyState';
import Spinner from '../../../components/Spinner';
import PermissionGuard from '../../../components/PermissionGuard';
import {
  reservationsApi,
  availabilitySearch,
  nightsBetween,
  estimateTotal,
  formatMoney,
  RESERVATION_SOURCES,
} from '../services/reservationApi';
import { guestsApi } from '../../guests/services/guestApi';
import { roomTypesApi } from '../../inventory/services/inventoryApi';
import { guestDisplayName } from '../../guests/pages/GuestsPage';
import { Field, inputCls, btnPrimary, btnSecondary, firstError } from '../components/form';

const STEPS = ['Dates & party', 'Choose room', 'Guest & confirm'];

function todayPlus(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function NewReservationPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState(0);
  const [roomTypes, setRoomTypes] = useState([]);
  const [guests, setGuests] = useState([]);
  const [form, setForm] = useState({
    check_in: searchParams.get('check_in') || todayPlus(0),
    check_out: searchParams.get('check_out') || todayPlus(1),
    room_type_id: searchParams.get('room_type_id') || '',
    adults: 2,
    children: 0,
    guest_id: '',
    source: 'walk_in',
    notes: '',
    // guest quick-create
    new_guest: false,
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
  });
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      roomTypesApi.list({ per_page: 100 }),
      guestsApi.list({ per_page: 500 }),
    ]).then(([t, g]) => {
      setRoomTypes(t.data || []);
      setGuests(g.data || []);
    });
  }, []);

  const nights = nightsBetween(form.check_in, form.check_out);
  const total = selectedRoom ? estimateTotal(form.check_in, form.check_out, selectedRoom.nightly_rate) : 0;

  const stepValid = (s) => {
    if (s === 0) return nights > 0 && form.room_type_id !== '';
    if (s === 1) return !!selectedRoom;
    if (s === 2) {
      if (form.new_guest) return form.first_name.trim() !== '' && form.last_name.trim() !== '';
      return form.guest_id !== '';
    }
    return true;
  };

  const doSearch = async () => {
    setSearching(true);
    setSearchError('');
    setSearched(false);
    try {
      const r = await availabilitySearch({
        check_in: form.check_in,
        check_out: form.check_out,
        room_type_id: form.room_type_id || undefined,
        adults: form.adults || undefined,
      });
      setResults(r.data || []);
      setSearched(true);
      setSelectedRoom(null);
    } catch (err) {
      setSearchError(err.response?.data?.message || 'Availability search failed.');
    } finally {
      setSearching(false);
    }
  };

  const grouped = useMemo(() => {
    const map = new Map();
    for (const item of results) {
      const tid = item.room?.room_type_id ?? item.room_type_id ?? 'other';
      if (!map.has(tid)) map.set(tid, []);
      map.get(tid).push(item);
    }
    return [...map.entries()];
  }, [results]);

  const typeName = (id) => roomTypes.find((t) => String(t.id) === String(id))?.name || 'Room';

  const create = async () => {
    setSaving(true);
    setErrors({});
    try {
      let guestId = form.guest_id;
      if (form.new_guest) {
        const g = await guestsApi.create({
          first_name: form.first_name,
          last_name: form.last_name,
          email: form.email || undefined,
          phone: form.phone || undefined,
        });
        guestId = g.data?.id ?? g.id;
      }
      const payload = {
        guest_id: guestId,
        room_type_id: form.room_type_id || undefined,
        room_id: selectedRoom.room?.id ?? selectedRoom.room_id ?? null,
        check_in: form.check_in,
        check_out: form.check_out,
        adults: Number(form.adults) || 1,
        children: Number(form.children) || 0,
        rate_plan_id: selectedRoom.rate_plan_id ?? undefined,
        nightly_rate: selectedRoom.nightly_rate,
        source: form.source,
        notes: form.notes || undefined,
      };
      const res = await reservationsApi.create(payload);
      const id = res.data?.id ?? res.id;
      navigate(`/reservations/${id}`);
    } catch (err) {
      setErrors(err.response?.data?.errors || { general: [err.response?.data?.message || 'Reservation failed.'] });
    } finally {
      setSaving(false);
    }
  };


  return (
    <PermissionGuard permission="reservations.manage">
      <div>
        <PageHeader title="New Reservation" subtitle="Three steps: dates, room, guest." />

        {/* Stepper */}
        <ol className="mb-6 flex items-center gap-2" aria-label="Reservation steps">
          {STEPS.map((label, i) => (
            <li key={label} className="flex flex-1 items-center gap-2">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  i === step
                    ? 'bg-gold-500 text-charcoal-950'
                    : i < step
                      ? 'bg-emerald-600 text-white'
                      : 'bg-charcoal-700 text-slate-400'
                }`}
              >
                {i + 1}
              </span>
              <span className={`hidden text-sm sm:block ${i === step ? 'text-slate-100' : 'text-slate-500'}`}>
                {label}
              </span>
              {i < STEPS.length - 1 && <span className="mx-1 h-px flex-1 bg-charcoal-700" />}
            </li>
          ))}
        </ol>

        {step === 0 && (
          <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
            <Field label="Check-in">
              <input type="date" className={inputCls} value={form.check_in} onChange={(e) => setForm({ ...form, check_in: e.target.value })} />
            </Field>
            <Field label="Check-out">
              <input type="date" className={inputCls} value={form.check_out} onChange={(e) => setForm({ ...form, check_out: e.target.value })} />
            </Field>
            <Field label="Room type">
              <select className={inputCls} value={form.room_type_id} onChange={(e) => setForm({ ...form, room_type_id: e.target.value })}>
                <option value="">Select type…</option>
                {roomTypes.map((t) => (
                  <option key={t.id} value={t.id}>{t.name} — {formatMoney(t.base_rate)}/night</option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Adults">
                <input type="number" min={1} className={inputCls} value={form.adults} onChange={(e) => setForm({ ...form, adults: e.target.value })} />
              </Field>
              <Field label="Children">
                <input type="number" min={0} className={inputCls} value={form.children} onChange={(e) => setForm({ ...form, children: e.target.value })} />
              </Field>
            </div>
            <p className="text-sm text-slate-400 sm:col-span-2">
              {nights > 0 ? `${nights} night${nights === 1 ? '' : 's'}` : 'Select valid dates (check-out after check-in).'}
            </p>
            <div className="flex justify-end sm:col-span-2">
              <button type="button" disabled={!stepValid(0)} onClick={() => { setStep(1); doSearch(); }} className={btnPrimary}>
                Search availability →
              </button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-slate-400">
                {form.check_in} → {form.check_out} · {nights} night{nights === 1 ? '' : 's'}
              </p>
              <button type="button" onClick={() => setStep(0)} className={btnSecondary}>
                ← Change dates
              </button>
            </div>
            {searching ? (
              <div className="py-10 text-center"><Spinner /></div>
            ) : searchError ? (
              <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
                {searchError}{' '}
                <button type="button" onClick={doSearch} className="underline">Retry</button>
              </div>
            ) : searched && results.length === 0 ? (
              <EmptyState title="No rooms available" message="Try different dates or a different room type." />
            ) : (
              grouped.map(([tid, items]) => (
                <div key={tid} className="mb-6">
                  <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
                    {typeName(tid)}
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {items.map((item, i) => {
                      const room = item.room || {};
                      const key = room.id ?? `${tid}-${i}`;
                      const active = selectedRoom && (selectedRoom.room?.id ?? selectedRoom.room_id) === room.id;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setSelectedRoom(item)}
                          aria-pressed={!!active}
                          className={`rounded-xl border p-4 text-left transition ${
                            active
                              ? 'border-gold-500 bg-gold-500/10'
                              : 'border-charcoal-700 bg-charcoal-900 hover:border-charcoal-500'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-lg font-bold text-slate-100">Room {room.number || '—'}</span>
                            <span className="text-sm font-semibold text-gold-300">{formatMoney(item.nightly_rate)}/night</span>
                          </div>
                          <p className="mt-1 text-xs text-slate-500">
                            {nights}n × {formatMoney(item.nightly_rate)} = {formatMoney(estimateTotal(form.check_in, form.check_out, item.nightly_rate))}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
            <div className="mt-4 flex justify-end">
              <button type="button" disabled={!stepValid(1)} onClick={() => setStep(2)} className={btnPrimary}>
                Continue →
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="grid max-w-2xl gap-4">
            <div className="rounded-xl border border-charcoal-700 bg-charcoal-900 p-4 text-sm">
              <p className="text-slate-400">Room {selectedRoom?.room?.number} · {typeName(selectedRoom?.room?.room_type_id ?? form.room_type_id)}</p>
              <p className="text-slate-400">{form.check_in} → {form.check_out} ({nights} nights)</p>
              <p className="mt-1 text-base font-semibold text-gold-300">
                Total estimate: {formatMoney(total)}
              </p>
            </div>

            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2 text-slate-200">
                <input type="radio" checked={!form.new_guest} onChange={() => setForm({ ...form, new_guest: false })} className="accent-gold-500" />
                Existing guest
              </label>
              <label className="flex items-center gap-2 text-slate-200">
                <input type="radio" checked={form.new_guest} onChange={() => setForm({ ...form, new_guest: true })} className="accent-gold-500" />
                New guest
              </label>
            </div>

            {!form.new_guest ? (
              <Field label="Guest" error={firstError(errors, 'guest_id')}>
                <select className={inputCls} value={form.guest_id} onChange={(e) => setForm({ ...form, guest_id: e.target.value })}>
                  <option value="">Select guest…</option>
                  {guests.map((g) => (
                    <option key={g.id} value={g.id}>
                      {guestDisplayName(g)}{g.vip ? ' (VIP)' : ''} — {g.phone || g.email || ''}
                    </option>
                  ))}
                </select>
              </Field>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="First name" error={firstError(errors, 'first_name')}>
                  <input className={inputCls} value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
                </Field>
                <Field label="Last name" error={firstError(errors, 'last_name')}>
                  <input className={inputCls} value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
                </Field>
                <Field label="Email" error={firstError(errors, 'email')}>
                  <input type="email" className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </Field>
                <Field label="Phone" error={firstError(errors, 'phone')}>
                  <input className={inputCls} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </Field>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Source">
                <select className={inputCls} value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
                  {RESERVATION_SOURCES.map((s) => (
                    <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Notes">
              <textarea className={inputCls} rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Early check-in requested…" />
            </Field>

            {errors.general && <p className="text-sm text-red-400">{errors.general[0]}</p>}
            <div className="flex justify-between">
              <button type="button" onClick={() => setStep(1)} className={btnSecondary}>← Back</button>
              <button type="button" onClick={create} disabled={saving || !stepValid(2)} className={btnPrimary}>
                {saving ? 'Creating…' : 'Create reservation'}
              </button>
            </div>
          </div>
        )}
      </div>
    </PermissionGuard>
  );
}
