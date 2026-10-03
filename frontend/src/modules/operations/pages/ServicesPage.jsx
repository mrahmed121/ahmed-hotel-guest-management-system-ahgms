import { useCallback, useEffect, useState } from 'react';
import PageHeader from '../../../components/PageHeader';
import DataTable from '../../../components/DataTable';
import StatusBadge from '../../../components/StatusBadge';
import EmptyState from '../../../components/EmptyState';
import Spinner from '../../../components/Spinner';
import Modal from '../../../components/Modal';
import { useAuth } from '../../../auth/AuthContext';
import {
  servicesApi,
  unwrapList,
  SERVICES_MANAGE_PERM,
} from '../services/operationsApi';

const EMPTY_FORM = { name: '', code: '', unit_price: '', taxable: true, active: true };

function formatMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `Rs ${n.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function ServicesPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission(SERVICES_MANAGE_PERM);

  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [deleteRow, setDeleteRow] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const payload = await servicesApi.list({ per_page: 100 });
      setServices(unwrapList(payload));
    } catch (e) {
      setError(e?.response?.data?.message ?? 'Failed to load services.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = useCallback(() => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setFormOpen(true);
  }, []);

  const openEdit = useCallback((row) => {
    setEditing(row);
    setForm({
      name: row.name ?? '',
      code: row.code ?? '',
      unit_price: row.unit_price ?? '',
      taxable: row.taxable !== false,
      active: row.active !== false,
    });
    setFormError('');
    setFormOpen(true);
  }, []);

  const save = useCallback(async () => {
    if (!form.name.trim()) {
      setFormError('Service name is required.');
      return;
    }
    if (!form.code.trim()) {
      setFormError('Service code is required.');
      return;
    }
    const price = Number(form.unit_price);
    if (!Number.isFinite(price) || price < 0) {
      setFormError('Unit price must be a valid non-negative number.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        unit_price: price,
        taxable: !!form.taxable,
        active: !!form.active,
      };
      if (editing) await servicesApi.update(editing.id, payload);
      else await servicesApi.create(payload);
      setFormOpen(false);
      await load();
    } catch (e) {
      setFormError(e?.response?.data?.message ?? 'Failed to save service.');
    } finally {
      setSaving(false);
    }
  }, [form, editing, load]);

  const toggleActive = useCallback(
    async (row) => {
      setBusyId(row.id);
      try {
        await servicesApi.update(row.id, { active: !row.active });
        await load();
      } catch (e) {
        setError(e?.response?.data?.message ?? 'Failed to update service.');
      } finally {
        setBusyId(null);
      }
    },
    [load]
  );

  const confirmDelete = useCallback(async () => {
    if (!deleteRow) return;
    setBusyId(deleteRow.id);
    try {
      await servicesApi.remove(deleteRow.id);
      setDeleteRow(null);
      await load();
    } catch (e) {
      setError(e?.response?.data?.message ?? 'Failed to delete service.');
    } finally {
      setBusyId(null);
    }
  }, [deleteRow, load]);

  const columns = [
    {
      key: 'name',
      label: 'Service',
      render: (s) => <span className="font-medium text-slate-100">{s.name}</span>,
    },
    {
      key: 'code',
      label: 'Code',
      render: (s) => <span className="font-mono text-sm text-gold-400">{s.code}</span>,
    },
    {
      key: 'unit_price',
      label: 'Unit Price',
      render: (s) => formatMoney(s.unit_price),
    },
    {
      key: 'taxable',
      label: 'Taxable',
      render: (s) => (
        <span className={s.taxable ? 'text-emerald-300' : 'text-slate-400'}>
          {s.taxable ? 'Yes' : 'No'}
        </span>
      ),
    },
    {
      key: 'active',
      label: 'Status',
      render: (s) => <StatusBadge value={s.active ? 'active' : 'inactive'} />,
    },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      render: (s) => {
        if (!canManage) return null;
        return (
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => openEdit(s)}
              className="rounded-md bg-charcoal-700 px-2 py-1 text-xs font-medium text-slate-200 ring-1 ring-charcoal-600 hover:bg-charcoal-600"
            >
              Edit
            </button>
            <button
              type="button"
              disabled={busyId === s.id}
              onClick={() => toggleActive(s)}
              className="rounded-md bg-blue-600/20 px-2 py-1 text-xs font-medium text-blue-300 ring-1 ring-blue-500/40 hover:bg-blue-600/40 disabled:opacity-50"
            >
              {s.active ? 'Deactivate' : 'Activate'}
            </button>
            <button
              type="button"
              onClick={() => setDeleteRow(s)}
              className="rounded-md bg-red-600/20 px-2 py-1 text-xs font-medium text-red-300 ring-1 ring-red-500/40 hover:bg-red-600/40"
            >
              Delete
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader
        title="Services"
        subtitle="Configurable hotel service catalog — charges post to guest folios."
        actions={
          canManage ? (
            <button
              type="button"
              onClick={openCreate}
              className="rounded-lg bg-gold-500 px-4 py-2 text-sm font-semibold text-charcoal-900 hover:bg-gold-400"
            >
              + New Service
            </button>
          ) : null
        }
      />

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : services.length === 0 ? (
        <EmptyState
          title="No services yet"
          message="Add hotel services like breakfast, laundry, or airport transfer. They become billable folio charges."
        />
      ) : (
        <DataTable
          columns={columns}
          rows={services}
          loading={loading}
          emptyTitle="No services yet"
          emptyMessage="Add your first hotel service to get started."
        />
      )}

      {/* Create/Edit modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? `Edit service — ${editing.name}` : 'New service'}
        actions={
          <>
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="rounded-lg border border-charcoal-600 px-4 py-2 text-sm text-slate-300 hover:bg-charcoal-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="rounded-lg bg-gold-500 px-4 py-2 text-sm font-semibold text-charcoal-900 hover:bg-gold-400 disabled:opacity-50"
            >
              {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Service'}
            </button>
          </>
        }
      >
        {formError && (
          <div className="mb-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300" role="alert">
            {formError}
          </div>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium text-slate-300">
            Service name
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-charcoal-600 bg-charcoal-800 px-3 py-2 text-sm text-slate-100"
              placeholder="e.g. Breakfast Buffet"
            />
          </label>
          <label className="block text-sm font-medium text-slate-300">
            Code
            <input
              type="text"
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
              className="mt-1 w-full rounded-lg border border-charcoal-600 bg-charcoal-800 px-3 py-2 font-mono text-sm text-slate-100"
              placeholder="e.g. BRKFST"
            />
          </label>
          <label className="block text-sm font-medium text-slate-300">
            Unit price (Rs)
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.unit_price}
              onChange={(e) => setForm((f) => ({ ...f, unit_price: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-charcoal-600 bg-charcoal-800 px-3 py-2 text-sm text-slate-100"
              placeholder="0.00"
            />
          </label>
          <div className="flex items-end gap-6 pb-2">
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={form.taxable}
                onChange={(e) => setForm((f) => ({ ...f, taxable: e.target.checked }))}
                className="h-4 w-4 rounded accent-gold-500"
              />
              Taxable
            </label>
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                className="h-4 w-4 rounded accent-gold-500"
              />
              Active
            </label>
          </div>
        </div>
      </Modal>

      {/* Delete confirmation */}
      <Modal
        open={!!deleteRow}
        onClose={() => setDeleteRow(null)}
        title="Delete service?"
        actions={
          <>
            <button
              type="button"
              onClick={() => setDeleteRow(null)}
              className="rounded-lg border border-charcoal-600 px-4 py-2 text-sm text-slate-300 hover:bg-charcoal-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmDelete}
              disabled={busyId != null}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
            >
              Delete
            </button>
          </>
        }
      >
        <p className="text-sm text-slate-300">
          Delete service <span className="font-semibold text-gold-400">{deleteRow?.name}</span>? This cannot be
          undone.
        </p>
      </Modal>
    </div>
  );
}
