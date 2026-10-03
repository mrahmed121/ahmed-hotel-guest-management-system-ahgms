import { useEffect, useState } from 'react';
import DataTable from '../../../components/DataTable';
import PageHeader from '../../../components/PageHeader';
import Modal from '../../../components/Modal';
import PermissionGuard from '../../../components/PermissionGuard';
import { ratePlansApi, roomTypesApi } from '../services/inventoryApi';
import { Field, inputCls, btnPrimary, btnSecondary, btnDanger, firstError } from '../components/form';

const initialForm = {
  name: '',
  room_type_id: '',
  base_rate: '',
  valid_from: '',
  valid_to: '',
  tax_percent: '0',
  service_charge_percent: '0',
  min_stay: '1',
  active: true,
};

function fmtDate(v) {
  if (!v) return '—';
  return String(v).slice(0, 10);
}

export default function RatePlansPage() {
  const [plans, setPlans] = useState([]);
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [p, t] = await Promise.all([
        ratePlansApi.list({ per_page: 100 }),
        roomTypesApi.list({ per_page: 100 }),
      ]);
      setPlans(p.data || []);
      setTypes(t.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(initialForm);
    setErrors({});
    setModalOpen(true);
  };

  const openEdit = (p) => {
    setEditing(p);
    setForm({
      name: p.name ?? '',
      room_type_id: p.room_type_id ?? '',
      base_rate: p.base_rate ?? '',
      valid_from: fmtDate(p.valid_from) === '—' ? '' : fmtDate(p.valid_from),
      valid_to: fmtDate(p.valid_to) === '—' ? '' : fmtDate(p.valid_to),
      tax_percent: p.tax_percent ?? '0',
      service_charge_percent: p.service_charge_percent ?? '0',
      min_stay: p.min_stay ?? '1',
      active: p.active !== false,
    });
    setErrors({});
    setModalOpen(true);
  };

  const save = async () => {
    setSaving(true);
    setErrors({});
    try {
      const payload = { ...form, room_type_id: form.room_type_id || null };
      if (editing) await ratePlansApi.update(editing.id, payload);
      else await ratePlansApi.create(payload);
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
      await ratePlansApi.remove(confirmDelete.id);
      setConfirmDelete(null);
      await load();
    } catch {
      setConfirmDelete(null);
    }
  };

  const typeName = (id) => types.find((t) => t.id === id)?.name || '—';

  return (
    <div>
      <PageHeader
        title="Rate Plans"
        subtitle="Seasonal and promotional rates per room type."
        actions={
          <PermissionGuard permission="rate-plans.manage">
            <button type="button" onClick={openCreate} className={btnPrimary}>
              + Add Rate Plan
            </button>
          </PermissionGuard>
        }
      />
      <DataTable
        columns={[
          { key: 'name', label: 'Plan', sortable: true },
          { key: 'room_type_id', label: 'Room type', render: (r) => typeName(r.room_type_id) },
          {
            key: 'base_rate',
            label: 'Rate/night',
            render: (r) => Number(r.base_rate).toLocaleString(),
          },
          { key: 'valid_from', label: 'Valid from', render: (r) => fmtDate(r.valid_from) },
          { key: 'valid_to', label: 'Valid to', render: (r) => fmtDate(r.valid_to) },
          {
            key: 'tax_percent',
            label: 'Tax %',
            render: (r) => `${Number(r.tax_percent || 0)}%`,
          },
          {
            key: 'service_charge_percent',
            label: 'Svc charge %',
            render: (r) => `${Number(r.service_charge_percent || 0)}%`,
          },
          {
            key: 'actions',
            label: '',
            render: (r) => (
              <PermissionGuard permission="rate-plans.manage">
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => openEdit(r)} className={btnSecondary}>
                    Edit
                  </button>
                  <button type="button" onClick={() => setConfirmDelete(r)} className={btnDanger}>
                    Delete
                  </button>
                </div>
              </PermissionGuard>
            ),
          },
        ]}
        rows={plans}
        loading={loading}
        emptyTitle="No rate plans yet"
        emptyMessage="Create seasonal or promotional rates for your room types."
      />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Rate Plan' : 'Add Rate Plan'} wide>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Plan name" error={firstError(errors, 'name')} className="sm:col-span-2">
            <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Summer Season 2026" />
          </Field>
          <Field label="Room type" error={firstError(errors, 'room_type_id')}>
            <select className={inputCls} value={form.room_type_id} onChange={(e) => setForm({ ...form, room_type_id: e.target.value })}>
              <option value="">Select type…</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Base rate (per night)" error={firstError(errors, 'base_rate')}>
            <input className={inputCls} type="number" min="0" step="0.01" value={form.base_rate} onChange={(e) => setForm({ ...form, base_rate: e.target.value })} placeholder="9500" />
          </Field>
          <Field label="Valid from" error={firstError(errors, 'valid_from')}>
            <input className={inputCls} type="date" value={form.valid_from} onChange={(e) => setForm({ ...form, valid_from: e.target.value })} />
          </Field>
          <Field label="Valid to" error={firstError(errors, 'valid_to')}>
            <input className={inputCls} type="date" value={form.valid_to} onChange={(e) => setForm({ ...form, valid_to: e.target.value })} />
          </Field>
          <Field label="Tax %" error={firstError(errors, 'tax_percent')}>
            <input className={inputCls} type="number" min="0" step="0.01" value={form.tax_percent} onChange={(e) => setForm({ ...form, tax_percent: e.target.value })} />
          </Field>
          <Field label="Service charge %" error={firstError(errors, 'service_charge_percent')}>
            <input className={inputCls} type="number" min="0" step="0.01" value={form.service_charge_percent} onChange={(e) => setForm({ ...form, service_charge_percent: e.target.value })} />
          </Field>
          <Field label="Minimum stay (nights)" error={firstError(errors, 'min_stay')}>
            <input className={inputCls} type="number" min="1" value={form.min_stay} onChange={(e) => setForm({ ...form, min_stay: e.target.value })} />
          </Field>
          <div className="flex items-center gap-2 pt-6">
            <input
              id="rp-active"
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
              className="h-4 w-4 rounded border-charcoal-600 bg-charcoal-900 text-gold-500 focus:ring-gold-500"
            />
            <label htmlFor="rp-active" className="text-sm text-slate-300">Active</label>
          </div>
          {errors.general && <p className="text-sm text-red-400 sm:col-span-2">{errors.general[0]}</p>}
          <div className="flex justify-end gap-2 pt-2 sm:col-span-2">
            <button type="button" onClick={() => setModalOpen(false)} className={btnSecondary}>Cancel</button>
            <button type="button" onClick={save} disabled={saving} className={btnPrimary}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete rate plan">
        <div className="p-5">
          <p className="text-sm text-slate-300">
            Delete rate plan <strong>{confirmDelete?.name}</strong>?
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setConfirmDelete(null)} className={btnSecondary}>Cancel</button>
            <button type="button" onClick={remove} className={btnDanger}>Delete</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
