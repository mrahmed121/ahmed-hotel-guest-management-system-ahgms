import { useEffect, useState } from 'react';
import PageHeader from '../../../components/PageHeader';
import Spinner from '../../../components/Spinner';
import EmptyState from '../../../components/EmptyState';
import { reportsApi, formatPKR, formatPct, num } from '../services/reportsApi';

function MetricCard({ label, value, hint, loading }) {
  return (
    <div className="rounded-xl border border-charcoal-700 bg-charcoal-800 p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      {loading ? (
        <div className="mt-2 h-9 w-24 animate-pulse rounded bg-charcoal-700" aria-hidden="true" />
      ) : (
        <p className="mt-2 text-3xl font-bold text-slate-100">{value}</p>
      )}
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

function QueueChip({ label, count, loading }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-charcoal-700/60 px-3 py-2">
      <span className="text-sm text-slate-300">{label}</span>
      {loading ? (
        <span className="h-5 w-8 animate-pulse rounded bg-charcoal-600" aria-hidden="true" />
      ) : (
        <span className="text-sm font-bold text-gold-400">{num(count)}</span>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    reportsApi
      .dashboard()
      .then((payload) => {
        if (!cancelled) {
          setData(payload?.data ?? payload ?? {});
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err?.response?.data?.message || 'Could not load dashboard metrics.');
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const d = data ?? {};
  const revenue = d.revenue_mtd ?? {};
  const hk = d.housekeeping_queue ?? {};
  const stays = Array.isArray(d.recent_stays) ? d.recent_stays : [];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Hotel performance at a glance — all metrics from live data."
      />

      {error && (
        <div className="mb-4 rounded-lg border border-red-800 bg-red-900/20 px-4 py-3 text-sm text-red-300" role="alert">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Occupancy today" value={loading ? '' : formatPct(d.occupancy_today)} hint="Occupied rooms ÷ total rooms" loading={loading} />
        <MetricCard label="Arrivals today" value={loading ? '' : num(d.arrivals_today)} hint="Check-ins expected today" loading={loading} />
        <MetricCard label="Departures today" value={loading ? '' : num(d.departures_today)} hint="Check-outs expected today" loading={loading} />
        <MetricCard label="In-house guests" value={loading ? '' : num(d.in_house)} hint="Currently checked-in stays" loading={loading} />
        <MetricCard label="Revenue (MTD)" value={loading ? '' : formatPKR(revenue.total)} hint={`Room ${formatPKR(revenue.room)} · Service ${formatPKR(revenue.service)}`} loading={loading} />
        <MetricCard label="Outstanding balance" value={loading ? '' : formatPKR(d.outstanding_balance)} hint="Unsettled folio balances" loading={loading} />
        <MetricCard label="Maintenance open" value={loading ? '' : num(d.maintenance_open)} hint="Tickets not yet closed" loading={loading} />
        <MetricCard label="Rooms total" value={loading ? '' : num(d.occupancy_today?.total_rooms)} hint="All rooms in inventory" loading={loading} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-charcoal-700 bg-charcoal-800 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300">Housekeeping queue</h2>
          <div className="mt-3 space-y-2">
            <QueueChip label="Dirty" count={hk.dirty} loading={loading} />
            <QueueChip label="Assigned" count={hk.assigned} loading={loading} />
            <QueueChip label="Cleaning" count={hk.cleaning} loading={loading} />
            <QueueChip label="Inspection" count={hk.inspection} loading={loading} />
          </div>
        </div>

        <div className="rounded-xl border border-charcoal-700 bg-charcoal-800 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300">Recent stays</h2>
          {loading ? (
            <div className="mt-3 flex justify-center py-6"><Spinner size="sm" /></div>
          ) : stays.length === 0 ? (
            <div className="mt-3">
              <EmptyState title="No stays yet" message="Recent stays will appear here once guests check in." />
            </div>
          ) : (
            <ul className="mt-3 divide-y divide-charcoal-700">
              {stays.slice(0, 6).map((s) => (
                <li key={s.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-slate-200">{s.guest_name ?? `Stay #${s.id}`}</span>
                  <span className="text-slate-400">Room {s.room_number ?? '—'}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
