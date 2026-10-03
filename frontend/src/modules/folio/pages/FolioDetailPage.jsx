import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import PageHeader from '../../../components/PageHeader';
import StatusBadge from '../../../components/StatusBadge';
import Spinner from '../../../components/Spinner';
import EmptyState from '../../../components/EmptyState';
import Modal from '../../../components/Modal';
import PermissionGuard from '../../../components/PermissionGuard';
import {
  foliosApi, unwrapOne, computeFolioTotals, formatPKR, todayStr,
  newIdempotencyKey, guestDisplayName,
  CHARGES_CREATE_PERM, ADJUSTMENTS_CREATE_PERM, PAYMENTS_CREATE_PERM,
  CHARGE_TYPES, ADJUSTMENT_TYPES, PAYMENT_METHODS,
} from '../services/folioApi';
import { Field, inputCls, btnPrimary, btnSecondary, btnDanger, firstError } from '../../reservations/components/form';

function fmtDate(v) {
  if (!v) return '—';
  return String(v).slice(0, 10);
}

function LineTypeBadge({ value }) {
  const styles = {
    room: 'bg-blue-500/15 text-blue-300 ring-blue-500/40',
    service: 'bg-violet-500/15 text-violet-300 ring-violet-500/40',
    adjustment: 'bg-amber-500/15 text-amber-300 ring-amber-500/40',
  };
  const label = String(value ?? '').replace(/_/g, ' ');
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ${styles[value] || 'bg-slate-500/15 text-slate-300 ring-slate-500/40'}`}>
      {label}
    </span>
  );
}

export default function FolioDetailPage() {
  const { id } = useParams();
  const [folio, setFolio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [modal, setModal] = useState(null); // null | charge | adjustment | payment | payconfirm
  const [acting, setActing] = useState(false);
  const [errors, setErrors] = useState({});
  const [actionError, setActionError] = useState('');

  const [chargeForm, setChargeForm] = useState({ line_type: 'service', description: '', quantity: '1', unit_price: '', service_date: todayStr() });
  const [adjForm, setAdjForm] = useState({ type: 'discount', amount: '', reason: '' });
  const [payForm, setPayForm] = useState({ method: 'cash', amount: '', reference: '', notes: '' });
  const [pendingPayment, setPendingPayment] = useState(null);

  const load = async () => {
    setLoading(true);
    setNotFound(false);
    try {
      const payload = await foliosApi.get(id);
      setFolio(unwrapOne(payload));
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

  const totals = useMemo(() => {
    if (!folio) return null;
    // Prefer server-computed totals; fall back to client computation.
    const t = folio.totals;
    if (t && typeof t.balance !== 'undefined') {
      return {
        charges: Number(t.charges ?? 0),
        discounts: Number(t.discounts ?? 0),
        payments: Number(t.payments ?? 0),
        balance: Number(t.balance ?? 0),
        guestCredit: Number(t.guest_credit ?? t.guestCredit ?? Math.max(0, -Number(t.balance ?? 0))),
      };
    }
    return computeFolioTotals(folio.lines ?? folio.folio_lines ?? [], folio.payments ?? []);
  }, [folio]);

  const lines = useMemo(() => folio?.lines ?? folio?.folio_lines ?? [], [folio]);
  const payments = folio?.payments ?? [];

  const grouped = useMemo(() => {
    const g = { room: [], service: [], adjustment: [] };
    for (const l of lines) {
      (g[l.line_type] ?? g.adjustment).push(l);
    }
    return g;
  }, [lines]);

  const resetModalState = () => {
    setErrors({});
    setActionError('');
  };

  const handleAddCharge = async () => {
    setActing(true);
    resetModalState();
    try {
      await foliosApi.addCharge(id, {
        line_type: chargeForm.line_type,
        description: chargeForm.description.trim(),
        quantity: Number(chargeForm.quantity),
        unit_price: Number(chargeForm.unit_price),
        service_date: chargeForm.service_date || undefined,
      });
      setModal(null);
      setChargeForm({ line_type: 'service', description: '', quantity: '1', unit_price: '', service_date: todayStr() });
      await load();
    } catch (err) {
      setErrors(err.response?.data?.errors || {});
      setActionError(err.response?.data?.message || 'Failed to add charge.');
    } finally {
      setActing(false);
    }
  };

  const handleAddAdjustment = async () => {
    setActing(true);
    resetModalState();
    try {
      await foliosApi.addAdjustment(id, {
        type: adjForm.type,
        amount: Number(adjForm.amount),
        reason: adjForm.reason.trim(),
      });
      setModal(null);
      setAdjForm({ type: 'discount', amount: '', reason: '' });
      await load();
    } catch (err) {
      setErrors(err.response?.data?.errors || {});
      setActionError(err.response?.data?.message || 'Failed to add adjustment.');
    } finally {
      setActing(false);
    }
  };

  const openPayConfirm = () => {
    resetModalState();
    setPendingPayment({
      method: payForm.method,
      amount: Number(payForm.amount),
      reference: payForm.reference.trim() || undefined,
      notes: payForm.notes.trim() || undefined,
      idempotency_key: newIdempotencyKey(),
    });
    setModal('payconfirm');
  };

  const handleRecordPayment = async () => {
    setActing(true);
    resetModalState();
    try {
      await foliosApi.recordPayment(id, pendingPayment);
      setModal(null);
      setPendingPayment(null);
      setPayForm({ method: 'cash', amount: '', reference: '', notes: '' });
      await load();
    } catch (err) {
      setErrors(err.response?.data?.errors || {});
      setActionError(err.response?.data?.message || 'Failed to record payment.');
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  if (notFound || !folio) {
    return <EmptyState title="Folio not found" message="This folio does not exist or you cannot access it." />;
  }

  const stay = folio.stay ?? {};
  const guest = stay.guest ?? folio.guest ?? {};
  const room = stay.room ?? folio.room ?? {};
  const isOpen = folio.status === 'open';

  const subtotal = (arr) => arr.reduce((s, l) => s + Number(l.amount ?? 0), 0);

  return (
    <div>
      <PageHeader
        title={`Folio ${folio.folio_number ?? ''}`}
        subtitle={`${guestDisplayName(guest)} · Room ${room.number ?? '—'}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/folios" className={btnSecondary}>Back to folios</Link>
            {stay.id && <Link to={`/stays/${stay.id}`} className={btnSecondary}>View stay</Link>}
            {isOpen && (
              <>
                <PermissionGuard permission={CHARGES_CREATE_PERM}>
                  <button type="button" onClick={() => { setModal('charge'); resetModalState(); }} className={btnSecondary}>
                    Add charge
                  </button>
                </PermissionGuard>
                <PermissionGuard permission={ADJUSTMENTS_CREATE_PERM}>
                  <button type="button" onClick={() => { setModal('adjustment'); resetModalState(); }} className={btnSecondary}>
                    Add adjustment
                  </button>
                </PermissionGuard>
                <PermissionGuard permission={PAYMENTS_CREATE_PERM}>
                  <button type="button" onClick={() => { setModal('payment'); resetModalState(); }} className={btnPrimary}>
                    Record payment
                  </button>
                </PermissionGuard>
              </>
            )}
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <StatusBadge value={folio.status} />
        <span className="text-sm text-slate-400">
          Stay: {fmtDate(stay.checked_in_at)} → {fmtDate(stay.checked_out_at) || 'in-house'}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* Charges */}
          <section className="rounded-xl border border-charcoal-700 bg-charcoal-900 p-5">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Charges</h3>
            {lines.length === 0 ? (
              <p className="text-sm text-slate-500">No charges posted yet.</p>
            ) : (
              <div className="space-y-5">
                {['room', 'service', 'adjustment'].map((type) =>
                  grouped[type].length > 0 ? (
                    <div key={type}>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-charcoal-700 text-left text-xs uppercase tracking-wide text-slate-500">
                              <th className="py-2 pr-3">Date</th>
                              <th className="py-2 pr-3">Type</th>
                              <th className="py-2 pr-3">Description</th>
                              <th className="py-2 pr-3 text-right">Qty</th>
                              <th className="py-2 pr-3 text-right">Unit price</th>
                              <th className="py-2 text-right">Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {grouped[type].map((l) => (
                              <tr key={l.id} className="border-b border-charcoal-800 last:border-0">
                                <td className="py-2 pr-3 text-slate-400">{fmtDate(l.service_date ?? l.created_at)}</td>
                                <td className="py-2 pr-3"><LineTypeBadge value={l.adjustment_type ? `adjustment (${l.adjustment_type})` : l.line_type} /></td>
                                <td className="py-2 pr-3 text-slate-200">{l.description}</td>
                                <td className="py-2 pr-3 text-right text-slate-300">{l.quantity ?? 1}</td>
                                <td className="py-2 pr-3 text-right text-slate-300">{formatPKR(l.unit_price ?? 0)}</td>
                                <td className="py-2 text-right font-medium text-slate-100">{formatPKR(l.amount)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <p className="mt-2 text-right text-xs text-slate-500">
                        {type.replace('_', ' ')} subtotal:{' '}
                        <span className="font-semibold text-slate-300">{formatPKR(subtotal(grouped[type]))}</span>
                      </p>
                    </div>
                  ) : null
                )}
              </div>
            )}
          </section>

          {/* Payments */}
          <section className="rounded-xl border border-charcoal-700 bg-charcoal-900 p-5">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Payments</h3>
            {payments.length === 0 ? (
              <p className="text-sm text-slate-500">No payments recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-charcoal-700 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="py-2 pr-3">Receipt</th>
                      <th className="py-2 pr-3">Method</th>
                      <th className="py-2 pr-3">Date</th>
                      <th className="py-2 pr-3">Reference</th>
                      <th className="py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id} className="border-b border-charcoal-800 last:border-0">
                        <td className="py-2 pr-3 font-medium text-gold-300">{p.receipt_number ?? `RCPT-${p.id}`}</td>
                        <td className="py-2 pr-3"><StatusBadge value={p.method} /></td>
                        <td className="py-2 pr-3 text-slate-400">{fmtDate(p.paid_at ?? p.created_at)}</td>
                        <td className="py-2 pr-3 text-slate-300">{p.reference ?? '—'}</td>
                        <td className="py-2 text-right font-medium text-emerald-300">{formatPKR(p.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        {/* Totals card */}
        <aside className="h-fit rounded-xl border border-charcoal-700 bg-charcoal-900 p-5 lg:sticky lg:top-4">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">Folio totals</h3>
          {totals && (
            <dl className="space-y-2.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Charges</dt>
                <dd className="font-medium text-slate-100">{formatPKR(totals.charges)}</dd>
              </div>
              {totals.discounts > 0 && (
                <div className="flex justify-between">
                  <dt className="text-slate-500">Discounts</dt>
                  <dd className="font-medium text-emerald-300">− {formatPKR(totals.discounts)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-slate-500">Payments</dt>
                <dd className="font-medium text-emerald-300">− {formatPKR(totals.payments)}</dd>
              </div>
              <div className="border-t border-charcoal-700 pt-3">
                <div className="flex justify-between">
                  <dt className="font-semibold text-slate-200">Balance due</dt>
                  <dd className="text-lg font-bold text-gold-400">{formatPKR(Math.max(0, totals.balance))}</dd>
                </div>
                {totals.guestCredit > 0 && (
                  <div className="mt-2 flex justify-between">
                    <dt className="text-slate-500">Guest credit</dt>
                    <dd className="font-medium text-sky-300">{formatPKR(totals.guestCredit)}</dd>
                  </div>
                )}
              </div>
            </dl>
          )}
        </aside>
      </div>

      {/* Add charge modal */}
      <Modal open={modal === 'charge'} onClose={() => setModal(null)} title="Add charge">
        <div className="grid gap-4">
          <Field label="Charge type" error={firstError(errors, 'line_type')}>
            <select className={inputCls} value={chargeForm.line_type} onChange={(e) => setChargeForm({ ...chargeForm, line_type: e.target.value })}>
              {CHARGE_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="Description" error={firstError(errors, 'description')}>
            <input className={inputCls} value={chargeForm.description} onChange={(e) => setChargeForm({ ...chargeForm, description: e.target.value })} placeholder="Minibar — soft drinks" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Quantity" error={firstError(errors, 'quantity')}>
              <input type="number" min="1" step="1" className={inputCls} value={chargeForm.quantity} onChange={(e) => setChargeForm({ ...chargeForm, quantity: e.target.value })} />
            </Field>
            <Field label="Unit price (PKR)" error={firstError(errors, 'unit_price')}>
              <input type="number" min="0" step="0.01" className={inputCls} value={chargeForm.unit_price} onChange={(e) => setChargeForm({ ...chargeForm, unit_price: e.target.value })} />
            </Field>
          </div>
          <Field label="Service date" error={firstError(errors, 'service_date')}>
            <input type="date" className={inputCls} value={chargeForm.service_date} max={todayStr()} onChange={(e) => setChargeForm({ ...chargeForm, service_date: e.target.value })} />
          </Field>
          {chargeForm.quantity && chargeForm.unit_price && (
            <p className="text-sm text-slate-400">
              Total: <strong className="text-slate-100">{formatPKR(Number(chargeForm.quantity) * Number(chargeForm.unit_price))}</strong>
            </p>
          )}
          {actionError && <p role="alert" className="text-sm text-red-400">{actionError}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setModal(null)} className={btnSecondary} disabled={acting}>Cancel</button>
            <button type="button" onClick={handleAddCharge} disabled={acting || !chargeForm.description.trim() || !chargeForm.unit_price} className={btnPrimary}>
              {acting ? 'Posting…' : 'Post charge'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Add adjustment modal */}
      <Modal open={modal === 'adjustment'} onClose={() => setModal(null)} title="Add adjustment">
        <div className="grid gap-4">
          <Field label="Adjustment type" error={firstError(errors, 'type')}>
            <select className={inputCls} value={adjForm.type} onChange={(e) => setAdjForm({ ...adjForm, type: e.target.value })}>
              {ADJUSTMENT_TYPES.map((t) => (
                <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </Field>
          <Field label="Amount (PKR)" error={firstError(errors, 'amount')}>
            <input type="number" min="0" step="0.01" className={inputCls} value={adjForm.amount} onChange={(e) => setAdjForm({ ...adjForm, amount: e.target.value })} placeholder="e.g. 1500" />
          </Field>
          <Field label="Reason (required)" error={firstError(errors, 'reason')}>
            <textarea className={inputCls} rows={2} value={adjForm.reason} onChange={(e) => setAdjForm({ ...adjForm, reason: e.target.value })} placeholder="Goodwill discount for delayed check-in…" />
          </Field>
          {actionError && <p role="alert" className="text-sm text-red-400">{actionError}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setModal(null)} className={btnSecondary} disabled={acting}>Cancel</button>
            <button type="button" onClick={handleAddAdjustment} disabled={acting || !adjForm.amount || !adjForm.reason.trim()} className={btnPrimary}>
              {acting ? 'Posting…' : 'Post adjustment'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Record payment modal */}
      <Modal open={modal === 'payment'} onClose={() => setModal(null)} title="Record payment">
        <div className="grid gap-4">
          <Field label="Method" error={firstError(errors, 'method')}>
            <select className={inputCls} value={payForm.method} onChange={(e) => setPayForm({ ...payForm, method: e.target.value })}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </Field>
          <Field label="Amount (PKR)" error={firstError(errors, 'amount')}>
            <input type="number" min="0" step="0.01" className={inputCls} value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} placeholder="e.g. 25000" />
          </Field>
          <Field label="Reference">
            <input className={inputCls} value={payForm.reference} onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })} placeholder="Card auth code / transfer ref…" />
          </Field>
          <Field label="Notes">
            <input className={inputCls} value={payForm.notes} onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })} placeholder="Optional…" />
          </Field>
          {totals && (
            <p className="text-sm text-slate-400">
              Outstanding balance: <strong className="text-gold-400">{formatPKR(Math.max(0, totals.balance))}</strong>
            </p>
          )}
          {actionError && <p role="alert" className="text-sm text-red-400">{actionError}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setModal(null)} className={btnSecondary} disabled={acting}>Cancel</button>
            <button type="button" onClick={openPayConfirm} disabled={acting || !payForm.amount || Number(payForm.amount) <= 0} className={btnPrimary}>
              Review payment
            </button>
          </div>
        </div>
      </Modal>

      {/* Payment confirmation */}
      <Modal open={modal === 'payconfirm'} onClose={() => setModal('payment')} title="Confirm payment">
        <div className="grid gap-4">
          <p className="text-sm text-slate-300">
            You are about to record a payment. Posted payments cannot be edited — corrections use
            adjustments.
          </p>
          {pendingPayment && (
            <dl className="space-y-2 rounded-lg border border-charcoal-700 bg-charcoal-950 p-4 text-sm">
              <div className="flex justify-between"><dt className="text-slate-500">Method</dt><dd className="capitalize text-slate-100">{pendingPayment.method.replace(/_/g, ' ')}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Amount</dt><dd className="font-semibold text-gold-400">{formatPKR(pendingPayment.amount)}</dd></div>
              {pendingPayment.reference && <div className="flex justify-between"><dt className="text-slate-500">Reference</dt><dd className="text-slate-200">{pendingPayment.reference}</dd></div>}
            </dl>
          )}
          {actionError && <p role="alert" className="text-sm text-red-400">{actionError}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setModal('payment')} className={btnSecondary} disabled={acting}>Back</button>
            <button type="button" onClick={handleRecordPayment} disabled={acting} className={btnDanger}>
              {acting ? 'Recording…' : 'Confirm & record'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
