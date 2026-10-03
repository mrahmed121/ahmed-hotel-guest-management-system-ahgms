import { useEffect, useState } from 'react';
import DataTable from '../../../components/DataTable';
import PageHeader from '../../../components/PageHeader';
import Modal from '../../../components/Modal';
import PermissionGuard from '../../../components/PermissionGuard';
import { floorsApi } from '../services/inventoryApi';
import { Field, inputCls, btnPrimary, btnSecondary, btnDanger, firstError } from '../components/form';

const initialForm = { number: '', name: '' };

export default function FloorsPage() {
  const [floors, setFloors] = useState([]);
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
      const res = await floorsApi.list({ per_page: 100 });
      setFloors(res.data || []);
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

  const openEdit = (floor) => {
    setEditing(floor);
    setForm({ number: floor.number ?? '', name: floor.name ?? '' });
    setErrors({});
    setModalOpen(true);
  };

  const save = async () => {
    setSaving(true);
    setErrors({});
    try {
      if (editing) await floorsApi.update(editing.id, form);
      else await floorsApi.create(form);
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
      await floorsApi.remove(confirmDelete.id);
      setConfirmDelete(null);
      await load();
    } catch {
      setConfirmDelete(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Floors"
        subtitle="Manage hotel floors."
        actions={
          <PermissionGuard permission="floors.manage">
            <button type="button" onClick={openCreate} className={btnPrimary}>
              + Add Floor
            </button>
          </PermissionGuard>
        }
      />
      <DataTable
        columns={[
          { key: 'number', label: 'Floor #', sortable: true },
          { key: 'name', label: 'Name', sortable: true },
          { key: 'rooms_count', label: 'Rooms', render: (r) => r.rooms_count ?? '—' },
          {
            key: 'actions',
            label: '',
            render: (r) => (
              <PermissionGuard permission="floors.manage">
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
        rows={floors}
        loading={loading}
        emptyTitle="No floors yet"
        emptyMessage="Add your first floor to start organizing rooms."
      />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Floor' : 'Add Floor'}>
        <div className="space-y-4 p-5">
          <Field label="Floor number" error={firstError(errors, 'number')}>
            <input
              className={inputCls}
              value={form.number}
              onChange={(e) => setForm({ ...form, number: e.target.value })}
              placeholder="e.g. 1"
            />
          </Field>
          <Field label="Name" error={firstError(errors, 'name')}>
            <input
              className={inputCls}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Ground Floor"
            />
          </Field>
          {errors.general && <p className="text-sm text-red-400">{errors.general[0]}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className={btnSecondary}>
              Cancel
            </button>
            <button type="button" onClick={save} disabled={saving} className={btnPrimary}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete floor">
        <div className="p-5">
          <p className="text-sm text-slate-300">
            Delete floor <strong>{confirmDelete?.name || confirmDelete?.number}</strong>? Rooms on this
            floor must be moved first.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setConfirmDelete(null)} className={btnSecondary}>
              Cancel
            </button>
            <button type="button" onClick={remove} className={btnDanger}>
              Delete
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
