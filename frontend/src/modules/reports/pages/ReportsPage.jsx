import { useEffect, useState } from 'react';
import PageHeader from '../../../components/PageHeader';
import Spinner from '../../../components/Spinner';
import EmptyState from '../../../components/EmptyState';
import DataTable from '../../../components/DataTable';
import {
  reportsApi,
  formatPKR,
  formatPct,
  num,
  monthStartStr,
  todayStr,
  calcOccupancyRate,
  calcADR,
  calcRevPAR,
} from '../services/reportsApi';

const TABS = [
  { key: 'occupancy', label: 'Occupancy & Rates' },
  { key: 'revenue', label: 'Revenue' },
  { key: 'reservations', label: 'Reservations' },
  { key: 'operations', label: 'Operations' },
];

function DateRange({ start, end, onChange }) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-xs text-slate-400">
        From
        <input
          type="date"
          value={start}
          onChange={(e) => onChange(e.target.value, end)}
          className="rounded-lg border border-charcoal-600 bg-charcoal-700 px-3 py-2 text-sm text-slate-200"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-slate-400">
        To
        <input
          type="date"
          value={end}
          onChange={(e) => onChange(start, e.target.value)}
          className="rounded-lg border border-charcoal-600 bg-charcoal-700 px-3 py-2 text-sm text-slate-200"
        />
      </label>
    </div>
  );
}

function FormulaNote({ children }) {
  return <p className="mt-1 text-xs text-slate-500">{children}</p>;
}

function MetricCard({ label, value, formula, loading }) {
  return (
    <div className="rounded-xl border border-charcoal-700 bg-charcoal-800 p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      {loading ? (
        <div className="mt-2 h-9 w-28 animate-pulse rounded bg-charcoal-700" aria-hidden="true" />
      ) : (
        <p className="mt-2 text-3xl font-bold text-slate-100">{value}</p>
      )}
      {formula && <FormulaNote>{formula}</FormulaNote>}
    </div>
  );
}

function ErrorBox({ message }) {
  if (!message) return null;
  return (
    <div className="mb-4 rounded-lg border border-red-800 bg-red-900/20 px-4 py-3 text-sm text-red-300" role="alert">
      {message}
    </div>
  );
}

function useRangeReport(fetcher) {
  const [start, setStart] = useState(monthStartStr());
  const [end, setEnd] = useState(todayStr());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    fetcher(start, end)
      .then((payload) => {
        if (!cancelled) {
          setData(payload?.data ?? payload ?? {});
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err?.response?.data?.message || 'Could not load report.');
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [start, end, fetcher]);

  return { start, end, setRange: (s, e) => { setStart(s); setEnd(e); }, data, loading, error };
}

function OccupancyTab() {
  const { start, end, setRange, loading, error } = useRangeReport(reportsApi.occupancy);
  const [adrData, setAdrData] = useState(null);
  const [revparData, setRevparData] = useState(null);

  useEffect(() => {
    let cancelled = false;
    reportsApi.adr(start, end).then((p) => { if (!cancelled) setAdrData(p?.data ?? p ?? {}); }).catch(() => {});
    reportsApi.revpar(start, end).then((p) => { if (!cancelled) setRevparData(p?.data ?? p ?? {}); }).catch(() => {});
    return () => { cancelled = true; };
  }, [start, end]);

  const occ = useRangeReportSilent(start, end);
  const occRate = occ ? num(occ.occupancy_rate, null) : null;
  const adr = adrData ? num(adrData.adr, null) : null;
  const revpar = revparData ? num(revparData.revpar, null) : null;

  // Client-side cross-check (documented formulas; backend is source of truth).
  const checkOcc = occ ? calcOccupancyRate(occ.occupied_room_nights, occ.total_rooms, occ.nights) : null;
  const checkAdr = adrData ? calcADR(adrData.total_room_revenue, adrData.occupied_room_nights) : null;
  const checkRevpar = checkAdr != null && checkOcc != null ? calcRevPAR(checkAdr, checkOcc) : null;

  return (
    <div>
      <DateRange start={start} end={end} onChange={setRange} />
      <ErrorBox message={error} />
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard
          label="Occupancy rate"
          value={loading ? '' : formatPct(occRate)}
          loading={loading}
          formula="Occupancy = occupied room-nights ÷ available room-nights."
        />
        <MetricCard
          label="ADR"
          value={loading ? '' : formatPKR(adr)}
          loading={loading}
          formula="ADR = total room revenue ÷ occupied room-nights."
        />
        <MetricCard
          label="RevPAR"
          value={loading ? '' : formatPKR(revpar)}
          loading={loading}
          formula="RevPAR = ADR × occupancy (fraction)."
        />
      </div>
      {occ && !loading && (
        <div className="mt-4 rounded-xl border border-charcoal-700 bg-charcoal-800 p-5 text-sm text-slate-400">
          <p>
            Occupied room-nights: <span className="font-semibold text-slate-200">{num(occ.occupied_room_nights)}</span>
            {' '}· Available room-nights: <span className="font-semibold text-slate-200">{num(occ.total_rooms) * num(occ.nights)}</span>
            {' '}({num(occ.total_rooms)} rooms × {num(occ.nights)} nights)
          </p>
          {checkOcc != null && occRate != null && Math.abs(checkOcc - occRate) > 0.05 && (
            <p className="mt-1 text-amber-400">Note: client-side formula check differs from backend value.</p>
          )}
          {checkAdr != null && adr != null && Math.abs(checkAdr - adr) > 1 && (
            <p className="mt-1 text-amber-400">Note: client-side ADR check differs from backend value.</p>
          )}
          {checkRevpar != null && revpar != null && Math.abs(checkRevpar - revpar) > 1 && (
            <p className="mt-1 text-amber-400">Note: client-side RevPAR check differs from backend value.</p>
          )}
        </div>
      )}
    </div>
  );
}

// Silent occupancy fetch reused for the detail panel.
function useRangeReportSilent(start, end) {
  const [data, setData] = useState(null);
  useEffect(() => {
    let cancelled = false;
    reportsApi.occupancy(start, end).then((p) => { if (!cancelled) setData(p?.data ?? p ?? {}); }).catch(() => {});
    return () => { cancelled = true; };
  }, [start, end]);
  return data;
}

function RevenueTab() {
  const { start, end, setRange, data, loading, error } = useRangeReport(reportsApi.revenue);
  const byType = data?.by_type ?? {};
  const rows = Object.entries(byType).map(([type, amount], i) => ({ id: i, type, amount: num(amount) }));

  return (
    <div>
      <DateRange start={start} end={end} onChange={setRange} />
      <ErrorBox message={error} />
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard label="Payments collected" value={loading ? '' : formatPKR(data?.payments_total)} loading={loading} />
        <MetricCard label="Outstanding" value={loading ? '' : formatPKR(data?.outstanding)} loading={loading} />
        <MetricCard label="Charge types" value={loading ? '' : rows.length} loading={loading} />
      </div>
      <div className="mt-4">
        <h3 className="mb-2 text-sm font-semibold text-slate-300">Charges by type</h3>
        <DataTable
          columns={[
            { key: 'type', label: 'Charge type', render: (r) => <span className="capitalize">{r.type}</span> },
            { key: 'amount', label: 'Amount', render: (r) => formatPKR(r.amount) },
          ]}
          rows={rows}
          loading={loading}
          emptyTitle="No charges in range"
          emptyMessage="Charges will appear here for the selected dates."
        />
      </div>
    </div>
  );
}

function ReservationsTab() {
  const { start, end, setRange, data, loading, error } = useRangeReport(reportsApi.reservations);
  const byStatus = data?.by_status ?? {};
  const rows = Object.entries(byStatus).map(([status, count], i) => ({ id: i, status, count: num(count) }));

  return (
    <div>
      <DateRange start={start} end={end} onChange={setRange} />
      <ErrorBox message={error} />
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <MetricCard label="Total estimate" value={loading ? '' : formatPKR(data?.total_estimate)} loading={loading} formula="Sum of nightly rate × nights for reservations in range." />
        <MetricCard label="Statuses tracked" value={loading ? '' : rows.length} loading={loading} />
      </div>
      <div className="mt-4">
        <h3 className="mb-2 text-sm font-semibold text-slate-300">Reservations by status</h3>
        <DataTable
          columns={[
            { key: 'status', label: 'Status', render: (r) => <span className="capitalize">{String(r.status).replace(/_/g, ' ')}</span> },
            { key: 'count', label: 'Count' },
          ]}
          rows={rows}
          loading={loading}
          emptyTitle="No reservations in range"
          emptyMessage="Reservations will appear here for the selected dates."
        />
      </div>
    </div>
  );
}

function OperationsTab() {
  const [hk, setHk] = useState(null);
  const [mt, setMt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.all([reportsApi.housekeeping(), reportsApi.maintenance()])
      .then(([hkRes, mtRes]) => {
        if (!cancelled) {
          setHk(hkRes?.data ?? hkRes ?? {});
          setMt(mtRes?.data ?? mtRes ?? {});
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err?.response?.data?.message || 'Could not load operations reports.');
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, []);

  const hkStatus = hk?.by_status ?? {};
  const mtStatus = mt?.by_status ?? {};
  const hkRows = Object.entries(hkStatus).map(([status, count], i) => ({ id: i, status, count: num(count) }));
  const mtRows = Object.entries(mtStatus).map(([status, count], i) => ({ id: i, status, count: num(count) }));
  const overdue = Array.isArray(hk?.overdue) ? hk.overdue : [];
  const urgent = Array.isArray(mt?.urgent_open) ? mt.urgent_open : [];

  return (
    <div>
      <ErrorBox message={error} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-300">Housekeeping by status</h3>
          <DataTable
            columns={[
              { key: 'status', label: 'Status', render: (r) => <span className="capitalize">{String(r.status).replace(/_/g, ' ')}</span> },
              { key: 'count', label: 'Count' },
            ]}
            rows={hkRows}
            loading={loading}
            emptyTitle="No housekeeping tasks"
            emptyMessage="Tasks will appear here."
          />
          <h4 className="mb-2 mt-4 text-sm font-semibold text-slate-300">Overdue tasks</h4>
          {loading ? <Spinner size="sm" /> : overdue.length === 0 ? (
            <EmptyState title="Nothing overdue" message="No overdue housekeeping tasks." />
          ) : (
            <ul className="divide-y divide-charcoal-700 rounded-xl border border-charcoal-700 bg-charcoal-800">
              {overdue.slice(0, 8).map((t) => (
                <li key={t.id} className="px-4 py-2 text-sm text-slate-300">
                  Room {t.room_number ?? '—'} — {t.status ?? ''}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-300">Maintenance by status</h3>
          <DataTable
            columns={[
              { key: 'status', label: 'Status', render: (r) => <span className="capitalize">{String(r.status).replace(/_/g, ' ')}</span> },
              { key: 'count', label: 'Count' },
            ]}
            rows={mtRows}
            loading={loading}
            emptyTitle="No maintenance tickets"
            emptyMessage="Tickets will appear here."
          />
          <h4 className="mb-2 mt-4 text-sm font-semibold text-slate-300">Urgent open tickets</h4>
          {loading ? <Spinner size="sm" /> : urgent.length === 0 ? (
            <EmptyState title="No urgent tickets" message="No urgent open maintenance tickets." />
          ) : (
            <ul className="divide-y divide-charcoal-700 rounded-xl border border-charcoal-700 bg-charcoal-800">
              {urgent.slice(0, 8).map((t) => (
                <li key={t.id} className="px-4 py-2 text-sm text-slate-300">
                  {t.ticket_number ?? `Ticket #${t.id}`} — {t.category ?? ''}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const [tab, setTab] = useState('occupancy');

  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle="Query-backed hotel metrics. Formulas are documented below each metric."
      />
      <div className="mb-6 flex flex-wrap gap-2" role="tablist" aria-label="Report sections">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? 'bg-gold-500 text-charcoal-900'
                : 'bg-charcoal-800 text-slate-300 hover:bg-charcoal-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'occupancy' && <OccupancyTab />}
      {tab === 'revenue' && <RevenueTab />}
      {tab === 'reservations' && <ReservationsTab />}
      {tab === 'operations' && <OperationsTab />}
    </div>
  );
}
