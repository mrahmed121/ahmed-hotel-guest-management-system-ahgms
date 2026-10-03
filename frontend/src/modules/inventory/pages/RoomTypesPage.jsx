import { useEffect, useState } from 'react';
import PageHeader from '../../../components/PageHeader';
import Modal from '../../../components/Modal';
import Spinner from '../../../components/Spinner';
import EmptyState from '../../../components/EmptyState';
import PermissionGuard from '../../../components/PermissionGuard';
import { roomTypesApi, amenitiesApi } from '../services/inventoryApi';
import { Field, inputCls, btnPrimary, btnSecondary, btnDanger, firstError } from '../components/form';

const initialForm = {
  name: '',
  code: '',
  base_rate: '',
  max_occupancy: '2',
  description: '',
  amenity_ids: [],
};

export default function RoomTypesPage() {
  const [types, setTypes] = useState([]);
  const [amenities, setAmenities] = useState([]);
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
      const [t, a] = await Promise.all([
        roomTypesApi.list({ per_page: 100 }),
        amenitiesApi.list({ per_page: 100 }),
      ]);
      setTypes(t.data || []);
      setAmenities(a.data || []);
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

  const openEdit = (t) => {
    setEditing(t);
    setForm({
      name: t.name ?? '',
      code: t.code ?? '',
      base_rate: t.base_rate ?? '',
      max_occupancy: t.max_occupancy ?? '2',
      description: t.description ?? '',
      amenity_ids: (t.amenities || []).map((x) => x.id),
    });
    setErrors({});
    setModalOpen(true);
  };

  const toggleAmenity = (id) => {
    setForm((f) => ({
      ...f,
      amenity_ids: f.amenity_ids.includes(id)
        ? f.amenity_ids.filter((x) => x !== id)
        : [...f.amenity_ids, id],
    }));
  };

  const save = async () => {
    setSaving(true);
    setErrors({});
    try {
      if (editing) await roomTypesApi.update(editing.id, form);
      else await roomTypesApi.create(form);
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
      await roomTypesApi.remove(confirmDelete.id);
      setConfirmDelete(null);
      await load();
    } catch {
      setConfirmDelete(null);
    }
  };


  return (
    <div>
      <PageHeader
        title="Room Types"
        subtitle="Standard, deluxe, suite — configure rates and occupancy."
        actions={
          <PermissionGuard permission="room-types.manage">
            <button type="button" onClick={openCreate} className={btnPrimary}>
              + Add Room Type
            </button>
          </PermissionGuard>
        }
      />

      {loading ? (
        <Spinner className="py-16" />
      ) : types.length === 0 ? (
        <EmptyState
          title="No room types yet"
          message="Create your first room type with its base rate."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {types.map((t) => (
            <div
              key={t.id}
              className="rounded-xl border border-charcoal-700 bg-charcoal-800 p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-100">{t.name}</h3>
                  {t.code && <p className="text-xs uppercase tracking-wide text-slate-500">{t.code}</p>}
                </div>
                <p className="text-right">
                  <span className="text-xl font-bold text-gold-400">
                    {Number(t.base_rate).toLocaleString()}
                  </span>
                  <span className="block text-xs text-slate-500">per night</span>
                </p>
              </div>
              <p className="mt-2 text-sm text-slate-400">
                Sleeps up to {t.max_occupancy} guest{t.max_occupancy == 1 ? '' : 's'}
              </p>
              {(t.amenities || []).length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {t.amenities.map((a) => (
                    <span
                      key={a.id}
                      className="rounded-full bg-charcoal-700 px-2.5 py-0.5 text-xs text-slate-300"
                    >
                      {a.name}
                    </span>
                  ))}
                </div>
              )}
              {t.description && (
                <p className="mt-3 text-sm text-slate-400 line-clamp-2">{t.description}</p>
              )}
              <PermissionGuard permission="room-types.manage">
                <div className="mt-4 flex gap-2 border-t border-charcoal-700 pt-4">
                  <button type="button" onClick={() => openEdit(t)} className={btnSecondary}>
                    Edit
                  </button>
                  <button type="button" onClick={() => setConfirmDelete(t)} className={btnDanger}>
                    Delete
                  </button>
                </div>
              </PermissionGuard>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Room Type' : 'Add Room Type'} wide>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Name" error={firstError(errors, 'name')}>
            <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Deluxe King" />
          </Field>
          <Field label="Code" error={firstError(errors, 'code')}>
            <input className={inputCls} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="DLX-K" />
          </Field>
          <Field label="Base rate (per night)" error={firstError(errors, 'base_rate')}>
            <input className={inputCls} type="number" min="0" step="0.01" value={form.base_rate} onChange={(e) => setForm({ ...form, base_rate: e.target.value })} placeholder="8500" />
          </Field>
          <Field label="Max occupancy" error={firstError(errors, 'max_occupancy')}>
            <input className={inputCls} type="number" min="1" value={form.max_occupancy} onChange={(e) => setForm({ ...form, max_occupancy: e.target.value })} />
          </Field>
          <Field label="Description" error={firstError(errors, 'description')} className="sm:col-span-2">
            <textarea className={inputCls} rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Spacious room with king bed and city view…" />
          </Field>
          <Field label="Amenities" className="sm:col-span-2">
            <div className="flex flex-wrap gap-2">
              {amenities.length === 0 && <p className="text-sm text-slate-500">No amenities defined yet.</p>}
              {amenities.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => toggleAmenity(a.id)}
                  className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ${
                    form.amenity_ids.includes(a.id)
                      ? 'bg-gold-500/15 text-gold-300 ring-gold-500/40'
                      : 'bg-charcoal-700 text-slate-300 ring-charcoal-600 hover:ring-slate-500'
                  }`}
                >
                  {a.name}
                </button>
              ))}
            </div>
          </Field>
          {errors.general && <p className="text-sm text-red-400 sm:col-span-2">{errors.general[0]}</p>}
          <div className="flex justify-end gap-2 pt-2 sm:col-span-2">
            <button type="button" onClick={() => setModalOpen(false)} className={btnSecondary}>Cancel</button>
            <button type="button" onClick={save} disabled={saving} className={btnPrimary}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete room type">
        <div className="p-5">
          <p className="text-sm text-slate-300">
            Delete <strong>{confirmDelete?.name}</strong>? Rooms using this type must be reassigned first.
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
