import { useEffect, useMemo, useState } from 'react';
import DataTable from '../../../components/DataTable';
import PageHeader from '../../../components/PageHeader';
import Modal from '../../../components/Modal';
import StatusBadge from '../../../components/StatusBadge';
import PermissionGuard from '../../../components/PermissionGuard';
import { roomsApi, floorsApi, roomTypesApi, ROOM_STATUSES, MANAGEABLE_ROOM_STATUSES } from '../services/inventoryApi';
import { Field, inputCls, btnPrimary, btnSecondary, btnDanger, firstError } from '../components/form';

const initialForm = {
  number: '',
  floor_id: '',
  room_type_id: '',
  status: 'available',
  notes: '',
};

export default function RoomsPage() {
  const [rooms, setRooms] = useState([]);
  const [floors, setFloors] = useState([]);
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ search: '', status: '', floor_id: '', room_type_id: '' });
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [r, f, t] = await Promise.all([
        roomsApi.list({ per_page: 200 }),
        floorsApi.list({ per_page: 100 }),
        roomTypesApi.list({ per_page: 100 }),
      ]);
      setRooms(r.data || []);
      setFloors(f.data || []);
      setTypes(t.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return rooms.filter((r) => {
      if (q && !String(r.number).toLowerCase().includes(q)) return false;
      if (filters.status && r.status !== filters.status) return false;
      if (filters.floor_id && String(r.floor_id) !== String(filters.floor_id)) return false;
      if (filters.room_type_id && String(r.room_type_id) !== String(filters.room_type_id)) return false;
      return true;
    });
  }, [rooms, filters]);

  const openCreate = () => {
    setEditing(null);
    setForm(initialForm);
    setErrors({});
    setModalOpen(true);
  };

  const openEdit = (room) => {
    setEditing(room);
    setForm({
      number: room.number ?? '',
      floor_id: room.floor_id ?? '',
      room_type_id: room.room_type_id ?? '',
      status: room.status ?? 'available',
      notes: room.notes ?? '',
    });
    setErrors({});
    setModalOpen(true);
  };

  const save = async () => {
    setSaving(true);
    setErrors({});
    try {
      const payload = {
        ...form,
        floor_id: form.floor_id || null,
        room_type_id: form.room_type_id || null,
      };
      if (editing) await roomsApi.update(editing.id, payload);
      else await roomsApi.create(payload);
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
      await roomsApi.remove(confirmDelete.id);
      setConfirmDelete(null);
      await load();
    } catch {
      setConfirmDelete(null);
    }
  };

  const floorName = (id) => floors.find((f) => f.id === id)?.name || '—';
  const typeName = (id) => types.find((t) => t.id === id)?.name || '—';

  return (
    <div>
      <PageHeader
        title="Rooms"
        subtitle="Hotel room inventory with live operational status."
        actions={
          <PermissionGuard permission="rooms.manage">
            <button type="button" onClick={openCreate} className={btnPrimary}>
              + Add Room
            </button>
          </PermissionGuard>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <input
          className={inputCls}
          placeholder="Search room number…"
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          aria-label="Search rooms"
        />
        <select
          className={inputCls}
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          {ROOM_STATUSES.map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <select
          className={inputCls}
          value={filters.floor_id}
          onChange={(e) => setFilters({ ...filters, floor_id: e.target.value })}
          aria-label="Filter by floor"
        >
          <option value="">All floors</option>
          {floors.map((f) => (
            <option key={f.id} value={f.id}>{f.name || `Floor ${f.number}`}</option>
          ))}
        </select>
        <select
          className={inputCls}
          value={filters.room_type_id}
          onChange={(e) => setFilters({ ...filters, room_type_id: e.target.value })}
          aria-label="Filter by room type"
        >
          <option value="">All types</option>
          {types.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>

      <DataTable
        columns={[
          { key: 'number', label: 'Room', sortable: true, render: (r) => <span className="font-semibold text-gold-300">{r.number}</span> },
          { key: 'floor_id', label: 'Floor', render: (r) => floorName(r.floor_id) },
          { key: 'room_type_id', label: 'Type', render: (r) => typeName(r.room_type_id) },
          { key: 'status', label: 'Status', render: (r) => <StatusBadge value={r.status} /> },
          {
            key: 'actions',
            label: '',
            render: (r) => (
              <PermissionGuard permission="rooms.manage">
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
        rows={filtered}
        loading={loading}
        emptyTitle="No rooms yet"
        emptyMessage="Add your first room to start building the hotel inventory."
      />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? `Edit Room ${editing.number}` : 'Add Room'}>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Room number" error={firstError(errors, 'number')}>
            <input className={inputCls} value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} placeholder="101" />
          </Field>
          <Field label="Status" error={firstError(errors, 'status')}>
            <select className={inputCls} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {MANAGEABLE_ROOM_STATUSES.map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </Field>
          <Field label="Floor" error={firstError(errors, 'floor_id')}>
            <select className={inputCls} value={form.floor_id} onChange={(e) => setForm({ ...form, floor_id: e.target.value })}>
              <option value="">Select floor…</option>
              {floors.map((f) => (
                <option key={f.id} value={f.id}>{f.name || `Floor ${f.number}`}</option>
              ))}
            </select>
          </Field>
          <Field label="Room type" error={firstError(errors, 'room_type_id')}>
            <select className={inputCls} value={form.room_type_id} onChange={(e) => setForm({ ...form, room_type_id: e.target.value })}>
              <option value="">Select type…</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>{t.name} — {Number(t.base_rate).toLocaleString()}/night</option>
              ))}
            </select>
          </Field>
          <Field label="Notes" error={firstError(errors, 'notes')} className="sm:col-span-2">
            <textarea className={inputCls} rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Sea view, corner room…" />
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

      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete room">
        <div className="p-5">
          <p className="text-sm text-slate-300">
            Delete room <strong>{confirmDelete?.number}</strong>? Rooms with active reservations or
            stays cannot be deleted.
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
