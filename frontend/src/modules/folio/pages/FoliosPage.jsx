import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../../../components/PageHeader';
import StatusBadge from '../../../components/StatusBadge';
import DataTable from '../../../components/DataTable';
import PermissionGuard from '../../../components/PermissionGuard';
import Modal from '../../../components/Modal';
import { foliosApi, unwrapList, formatPKR, todayStr, guestDisplayName, NIGHTLY_BILLING_PERM } from '../services/folioApi';
import { Field, inputCls, btnPrimary, btnSecondary } from '../../reservations/components/form';

export default function FoliosPage() {
  const [status, setStatus] = useState('open');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [nightlyOpen, setNightlyOpen] = useState(false);
  const [nightlyDate, setNightlyDate] = useState(todayStr());
  const [nightlyRunning, setNightlyRunning] = useState(false);
  const [nightlyResult, setNightlyResult] = useState(null);
  const [nightlyError, setNightlyError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const payload = await foliosApi.list({ status, per_page: 50 });
      setRows(unwrapList(payload));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load folios.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const handleNightly = async () => {
    setNightlyRunning(true);
    setNightlyError('');
    setNightlyResult(null);
    try {
      const payload = await foliosApi.runNightlyBilling(nightlyDate);
      const result = payload?.data ?? payload;
      setNightlyResult(result);
      await load();
    } catch (err) {
      setNightlyError(err.response?.data?.message || 'Nightly billing failed.');
    } finally {
      setNightlyRunning(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Folios"
        subtitle="Guest bills — charges, adjustments, payments, and balances."
        actions={
          <PermissionGuard permission={NIGHTLY_BILLING_PERM}>
            <button type="button" onClick={() => { setNightlyOpen(true); setNightlyResult(null); setNightlyError(''); }} className={btnSecondary}>
              Run nightly charges
            </button>
          </PermissionGuard>
        }
      />

      <div className="mb-4 flex items-center gap-3">
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-400" htmlFor="folio-status">
          Status
        </label>
        <select
          id="folio-status"
          className={`${inputCls} w-auto`}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="open">Open</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      {error ? (
        <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </p>
      ) : (
        <DataTable
          loading={loading}
          rows={rows}
          emptyTitle={`No ${status} folios`}
          emptyMessage={status === 'open' ? 'No open folios. Folios are created automatically at check-in.' : 'No closed folios yet.'}
          columns={[
            {
              key: 'folio_number',
              label: 'Folio',
              render: (r) => (
                <Link to={`/folios/${r.id}`} className="font-medium text-gold-300 hover:underline">
                  {r.folio_number ?? `FL-${r.id}`}
                </Link>
              ),
            },
            {
              key: 'guest',
              label: 'Guest',
              render: (r) => guestDisplayName(r.stay?.guest ?? r.guest ?? {}),
            },
            {
              key: 'room',
              label: 'Room',
              render: (r) => r.stay?.room?.number ?? r.room?.number ?? '—',
            },
            {
              key: 'stay_dates',
              label: 'Stay',
              render: (r) => {
                const s = r.stay ?? {};
                const ci = (s.checked_in_at ?? '').slice(0, 10);
                const co = (s.checked_out_at ?? '').slice(0, 10) || (s.reservation?.check_out ?? '');
                return ci ? `${ci} → ${co || '—'}` : '—';
              },
            },
            {
              key: 'balance',
              label: 'Balance',
              render: (r) => {
                const b = Number(r.totals?.balance ?? r.balance ?? 0);
                return (
                  <span className={b > 0 ? 'font-semibold text-amber-300' : 'text-slate-300'}>
                    {formatPKR(b)}
                  </span>
                );
              },
            },
            { key: 'status', label: 'Status', render: (r) => <StatusBadge value={r.status} /> },
          ]}
        />
      )}

      <Modal open={nightlyOpen} onClose={() => setNightlyOpen(false)} title="Run nightly room charges">
        <div className="grid gap-4">
          <p className="text-sm text-slate-300">
            Posts the nightly room rate to every in-house folio for the selected date. Idempotent —
            nights already charged are skipped.
          </p>
          <Field label="Billing date">
            <input
              type="date"
              className={inputCls}
              value={nightlyDate}
              max={todayStr()}
              onChange={(e) => setNightlyDate(e.target.value)}
            />
          </Field>
          {nightlyError && (
            <p role="alert" className="text-sm text-red-400">{nightlyError}</p>
          )}
          {nightlyResult && (
            <div className="rounded-lg border border-charcoal-700 bg-charcoal-950 p-3 text-sm">
              <p className="text-slate-200">
                Charged: <strong className="text-emerald-300">{nightlyResult.charged ?? 0}</strong>
                {' · '}Skipped: <strong className="text-slate-300">{nightlyResult.skipped ?? 0}</strong>
              </p>
              {nightlyResult.billing_date && (
                <p className="mt-1 text-xs text-slate-500">Billing date: {nightlyResult.billing_date}</p>
              )}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setNightlyOpen(false)} className={btnSecondary} disabled={nightlyRunning}>
              Close
            </button>
            <button type="button" onClick={handleNightly} disabled={nightlyRunning || !nightlyDate} className={btnPrimary}>
              {nightlyRunning ? 'Running…' : 'Run charges'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
