import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import DataTable from '../../../components/DataTable';
import PageHeader from '../../../components/PageHeader';
import Modal from '../../../components/Modal';
import StatusBadge from '../../../components/StatusBadge';
import EmptyState from '../../../components/EmptyState';
import Spinner from '../../../components/Spinner';
import PermissionGuard from '../../../components/PermissionGuard';
import { guestsApi, ID_TYPES } from '../services/guestApi';
import { Field, inputCls, btnPrimary, btnSecondary, btnDanger, firstError } from '../components/form';

const initialForm = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  country: '',
  id_type: '',
  id_number: '',
  address: '',
  notes: '',
  vip: false,
};

export function guestDisplayName(g) {
  return `${g.first_name ?? ''} ${g.last_name ?? ''}`.trim() || '—';
}

export default function GuestsPage() {
  const [guests, setGuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmBlacklist, setConfirmBlacklist] = useState(null);
  const [drawer, setDrawer] = useState(null);
  const [drawerReservations, setDrawerReservations] = useState([]);
  const [drawerLoading, setDrawerLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const r = await guestsApi.list({ per_page: 200 });
      setGuests(r.data || []);
    } catch {
      setLoadError('Could not load guests. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return guests.filter((g) => {
      if (statusFilter && g.status !== statusFilter) return false;
      if (!q) return true;
      const hay = `${g.first_name} ${g.last_name} ${g.email} ${g.phone}`.toLowerCase();
      return hay.includes(q);
    });
  }, [guests, search, statusFilter]);

  const openCreate = () => {
    setEditing(null);
    setForm(initialForm);
    setErrors({});
    setModalOpen(true);
  };

  const openEdit = (guest) => {
    setEditing(guest);
    setForm({
      first_name: guest.first_name ?? '',
      last_name: guest.last_name ?? '',
      email: guest.email ?? '',
      phone: guest.phone ?? '',
      country: guest.country ?? '',
      id_type: guest.id_type ?? '',
      id_number: guest.id_number ?? '',
      address: guest.address ?? '',
      notes: guest.notes ?? '',
      vip: !!guest.vip,
    });
    setErrors({});
    setModalOpen(true);
  };

  const save = async () => {
    setSaving(true);
    setErrors({});
    try {
      if (editing) await guestsApi.update(editing.id, form);
      else await guestsApi.create(form);
      setModalOpen(false);
      await load();
    } catch (err) {
      setErrors(err.response?.data?.errors || { general: ['Save failed.'] });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    try {
      await guestsApi.remove(confirmDelete.id);
      setConfirmDelete(null);
      await load();
    } catch {
      setConfirmDelete(null);
    }
  };

  const toggleBlacklist = async () => {
    try {
      if (confirmBlacklist.status === 'blacklisted') {
        await guestsApi.unblacklist(confirmBlacklist.id);
      } else {
        await guestsApi.blacklist(confirmBlacklist.id);
      }
      setConfirmBlacklist(null);
      await load();
    } catch {
      setConfirmBlacklist(null);
    }
  };

  const openDrawer = async (guest) => {
    setDrawer(guest);
    setDrawerReservations([]);
    setDrawerLoading(true);
    try {
      const r = await guestsApi.reservations(guest.id);
      setDrawerReservations(r.data || []);
    } catch {
      setDrawerReservations([]);
    } finally {
      setDrawerLoading(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Guests"
        subtitle="Guest profiles, VIP flags, and reservation history."
        actions={
          <PermissionGuard permission="guests.manage">
            <button type="button" onClick={openCreate} className={btnPrimary}>
              + Add Guest
            </button>
          </PermissionGuard>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <input
          className={inputCls}
          placeholder="Search name, phone, or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search guests"
        />
        <select
          className={inputCls}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="blacklisted">Blacklisted</option>
        </select>
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
            key: 'name',
            label: 'Guest',
            sortable: true,
            render: (g) => (
              <button
                type="button"
                onClick={() => openDrawer(g)}
                className="text-left font-semibold text-gold-300 hover:underline"
              >
                {guestDisplayName(g)}
                {g.vip ? (
                  <span className="ml-2 inline-flex items-center rounded-full bg-gold-500/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-gold-300 ring-1 ring-gold-500/40">
                    VIP
                  </span>
                ) : null}
              </button>
            ),
          },
          { key: 'phone', label: 'Phone', render: (g) => g.phone || '—' },
          { key: 'email', label: 'Email', render: (g) => g.email || '—' },
          { key: 'country', label: 'Country', render: (g) => g.country || '—' },
          {
            key: 'status',
            label: 'Status',
            render: (g) => <StatusBadge value={g.status === 'blacklisted' ? 'cancelled' : 'active'} />,
          },
          {
            key: 'actions',
            label: '',
            render: (g) => (
              <PermissionGuard permission="guests.manage">
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => openEdit(g)} className={btnSecondary}>
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmBlacklist(g)}
                    className={btnSecondary}
                    title={g.status === 'blacklisted' ? 'Remove from blacklist' : 'Blacklist guest'}
                  >
                    {g.status === 'blacklisted' ? 'Unblacklist' : 'Blacklist'}
                  </button>
                  <button type="button" onClick={() => setConfirmDelete(g)} className={btnDanger}>
                    Delete
                  </button>
                </div>
              </PermissionGuard>
            ),
          },
        ]}
        rows={filtered}
        loading={loading}
        emptyTitle="No guests yet"
        emptyMessage="Add your first guest to start taking reservations."
      />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? `Edit ${guestDisplayName(editing)}` : 'Add Guest'} wide>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="First name" error={firstError(errors, 'first_name')}>
            <input className={inputCls} value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} placeholder="Ali" />
          </Field>
          <Field label="Last name" error={firstError(errors, 'last_name')}>
            <input className={inputCls} value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} placeholder="Khan" />
          </Field>
          <Field label="Email" error={firstError(errors, 'email')}>
            <input type="email" className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="ali@example.com" />
          </Field>
          <Field label="Phone" error={firstError(errors, 'phone')}>
            <input className={inputCls} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+92 300 1234567" />
          </Field>
          <Field label="Country" error={firstError(errors, 'country')}>
            <input className={inputCls} value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} placeholder="Pakistan" />
          </Field>
          <Field label="ID type" error={firstError(errors, 'id_type')}>
            <select className={inputCls} value={form.id_type} onChange={(e) => setForm({ ...form, id_type: e.target.value })}>
              <option value="">Select…</option>
              {ID_TYPES.map((t) => (
                <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </Field>
          <Field label="ID number" error={firstError(errors, 'id_number')} className="sm:col-span-2">
            <input className={inputCls} value={form.id_number} onChange={(e) => setForm({ ...form, id_number: e.target.value })} placeholder="ID / passport number" />
          </Field>
          <Field label="Address" error={firstError(errors, 'address')} className="sm:col-span-2">
            <textarea className={inputCls} rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Street, city…" />
          </Field>
          <Field label="Notes" error={firstError(errors, 'notes')} className="sm:col-span-2">
            <textarea className={inputCls} rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Preferences, allergies…" />
          </Field>
          <label className="flex items-center gap-2 text-sm text-slate-200 sm:col-span-2">
            <input
              type="checkbox"
              checked={form.vip}
              onChange={(e) => setForm({ ...form, vip: e.target.checked })}
              className="h-4 w-4 rounded border-charcoal-600 bg-charcoal-900 accent-gold-500"
            />
            Mark as VIP guest
          </label>
          {errors.general && <p className="text-sm text-red-400 sm:col-span-2">{errors.general[0]}</p>}
          <div className="flex justify-end gap-2 pt-2 sm:col-span-2">
            <button type="button" onClick={() => setModalOpen(false)} className={btnSecondary}>Cancel</button>
            <button type="button" onClick={save} disabled={saving} className={btnPrimary}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete guest">
        <div className="p-5">
          <p className="text-sm text-slate-300">
            Delete guest <strong>{confirmDelete && guestDisplayName(confirmDelete)}</strong>? Guests with
            reservations or stays cannot be deleted.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setConfirmDelete(null)} className={btnSecondary}>Cancel</button>
            <button type="button" onClick={remove} className={btnDanger}>Delete</button>
          </div>
        </div>
      </Modal>

      <Modal open={!!confirmBlacklist} onClose={() => setConfirmBlacklist(null)} title={confirmBlacklist?.status === 'blacklisted' ? 'Remove from blacklist' : 'Blacklist guest'}>
        <div className="p-5">
          <p className="text-sm text-slate-300">
            {confirmBlacklist?.status === 'blacklisted'
              ? `Remove ${confirmBlacklist && guestDisplayName(confirmBlacklist)} from the blacklist?`
              : `Blacklist ${confirmBlacklist && guestDisplayName(confirmBlacklist)}? Blacklisted guests cannot make new reservations.`}
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setConfirmBlacklist(null)} className={btnSecondary}>Cancel</button>
            <button type="button" onClick={toggleBlacklist} className={btnDanger}>
              {confirmBlacklist?.status === 'blacklisted' ? 'Remove' : 'Blacklist'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Guest detail drawer */}
      {drawer && (
        <div
          className="fixed inset-0 z-50 bg-black/60"
          role="dialog"
          aria-modal="true"
          aria-label={`Guest details for ${guestDisplayName(drawer)}`}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setDrawer(null);
          }}
        >
          <aside className="absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto border-l border-charcoal-600 bg-charcoal-800 p-5">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">
                  {guestDisplayName(drawer)}
                  {drawer.vip && (
                    <span className="ml-2 inline-flex items-center rounded-full bg-gold-500/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-gold-300 ring-1 ring-gold-500/40">
                      VIP
                    </span>
                  )}
                </h2>
                <p className="text-sm text-slate-400">{drawer.email || '—'} · {drawer.phone || '—'}</p>
              </div>
              <button
                type="button"
                onClick={() => setDrawer(null)}
                aria-label="Close guest details"
                className="rounded-md p-1 text-slate-400 hover:bg-charcoal-700 hover:text-slate-200 focus:outline-none focus:ring-2 focus:ring-gold-500"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-slate-500">Country</dt><dd className="text-slate-200">{drawer.country || '—'}</dd></div>
              <div><dt className="text-slate-500">ID</dt><dd className="text-slate-200">{drawer.id_type ? `${drawer.id_type.replace(/_/g, ' ')}: ${drawer.id_number || '—'}` : '—'}</dd></div>
              <div className="col-span-2"><dt className="text-slate-500">Address</dt><dd className="text-slate-200">{drawer.address || '—'}</dd></div>
              <div className="col-span-2"><dt className="text-slate-500">Notes</dt><dd className="text-slate-200">{drawer.notes || '—'}</dd></div>
            </dl>

            <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-slate-400">
              Reservation history
            </h3>
            {drawerLoading ? (
              <div className="py-6 text-center"><Spinner /></div>
            ) : drawerReservations.length === 0 ? (
              <EmptyState title="No reservations" message="This guest has no reservations yet." />
            ) : (
              <ul className="mt-2 space-y-2">
                {drawerReservations.map((r) => (
                  <li key={r.id} className="rounded-lg border border-charcoal-700 bg-charcoal-900 p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <Link to={`/reservations/${r.id}`} className="font-semibold text-gold-300 hover:underline">
                        {r.confirmation_code}
                      </Link>
                      <StatusBadge value={r.status} />
                    </div>
                    <p className="mt-1 text-slate-400">
                      {r.check_in} → {r.check_out}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
