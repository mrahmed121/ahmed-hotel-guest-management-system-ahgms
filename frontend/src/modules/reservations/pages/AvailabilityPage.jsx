import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../../components/PageHeader';
import EmptyState from '../../../components/EmptyState';
import Spinner from '../../../components/Spinner';
import PermissionGuard from '../../../components/PermissionGuard';
import { availabilitySearch, nightsBetween, formatMoney } from '../services/reservationApi';
import { roomTypesApi } from '../../inventory/services/inventoryApi';
import { Field, inputCls, btnPrimary } from '../components/form';

function todayPlus(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function AvailabilityPage() {
  const navigate = useNavigate();
  const [roomTypes, setRoomTypes] = useState([]);
  const [form, setForm] = useState({
    check_in: todayPlus(0),
    check_out: todayPlus(1),
    room_type_id: '',
    adults: 2,
  });
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    roomTypesApi.list({ per_page: 100 }).then((r) => setRoomTypes(r.data || []));
  }, []);

  const nights = nightsBetween(form.check_in, form.check_out);

  const search = async () => {
    if (nights <= 0) return;
    setSearching(true);
    setError('');
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
    } catch (err) {
      setError(err.response?.data?.message || 'Availability search failed.');
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

  const reserve = (item) => {
    const room = item.room || {};
    const params = new URLSearchParams({
      check_in: form.check_in,
      check_out: form.check_out,
      room_type_id: String(room.room_type_id ?? form.room_type_id ?? ''),
    });
    navigate(`/reservations/new?${params.toString()}`);
  };

  return (
    <PermissionGuard permission="availability.view">
      <div>
        <PageHeader
          title="Availability"
          subtitle="Live room availability from real reservation data."
        />

        <div className="mb-6 grid gap-3 rounded-xl border border-charcoal-700 bg-charcoal-900 p-4 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Check-in">
            <input type="date" className={inputCls} value={form.check_in} onChange={(e) => setForm({ ...form, check_in: e.target.value })} aria-label="Check-in date" />
          </Field>
          <Field label="Check-out">
            <input type="date" className={inputCls} value={form.check_out} onChange={(e) => setForm({ ...form, check_out: e.target.value })} aria-label="Check-out date" />
          </Field>
          <Field label="Room type">
            <select className={inputCls} value={form.room_type_id} onChange={(e) => setForm({ ...form, room_type_id: e.target.value })} aria-label="Room type filter">
              <option value="">All types</option>
              {roomTypes.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Adults">
            <input type="number" min={1} className={inputCls} value={form.adults} onChange={(e) => setForm({ ...form, adults: e.target.value })} aria-label="Adults" />
          </Field>
          <div className="flex items-end">
            <button type="button" onClick={search} disabled={searching || nights <= 0} className={btnPrimary}>
              {searching ? 'Searching…' : 'Search'}
            </button>
          </div>
        </div>

        {nights <= 0 && (
          <p className="mb-4 text-sm text-amber-300">Check-out must be after check-in.</p>
        )}
        {error && (
          <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
            {error}{' '}
            <button type="button" onClick={search} className="underline">Retry</button>
          </div>
        )}

        {searching ? (
          <div className="py-10 text-center"><Spinner /></div>
        ) : searched && results.length === 0 ? (
          <EmptyState title="No rooms available" message="No rooms are free for the selected dates. Try adjusting the range." />
        ) : (
          grouped.map(([tid, items]) => (
            <div key={tid} className="mb-6">
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
                {typeName(tid)} · {items.length} available
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {items.map((item, i) => {
                  const room = item.room || {};
                  return (
                    <div
                      key={room.id ?? `${tid}-${i}`}
                      className="rounded-xl border border-charcoal-700 bg-charcoal-900 p-4"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-bold text-slate-100">Room {room.number || '—'}</span>
                        <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-300 ring-1 ring-emerald-500/40">
                          Available
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-semibold text-gold-300">
                        {formatMoney(item.nightly_rate)}/night
                      </p>
                      <p className="text-xs text-slate-500">
                        {nights}n total ≈ {formatMoney(nights * Number(item.nightly_rate || 0))}
                      </p>
                      <PermissionGuard permission="reservations.manage">
                        <button
                          type="button"
                          onClick={() => reserve(item)}
                          className="mt-3 w-full rounded-lg bg-gold-500 px-3 py-1.5 text-sm font-semibold text-charcoal-950 hover:bg-gold-400"
                        >
                          Reserve
                        </button>
                      </PermissionGuard>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </PermissionGuard>
  );
}
