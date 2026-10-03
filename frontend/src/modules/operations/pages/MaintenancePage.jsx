import { useCallback, useEffect, useState } from 'react';
import PageHeader from '../../../components/PageHeader';
import DataTable from '../../../components/DataTable';
import StatusBadge from '../../../components/StatusBadge';
import EmptyState from '../../../components/EmptyState';
import Spinner from '../../../components/Spinner';
import Modal from '../../../components/Modal';
import { useAuth } from '../../../auth/AuthContext';
import {
  maintenanceApi,
  usersApi,
  unwrapList,
  unwrapMeta,
  TICKET_STATUSES,
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  PRIORITY_DOT,
  MAINTENANCE_MANAGE_PERM,
} from '../services/operationsApi';
import { roomsApi } from '../../inventory/services/inventoryApi';

const NEXT_ACTION = {
  open: { label: 'Triage', action: 'triage' },
  triaged: { label: 'Assign', action: 'assign' },
  assigned: { label: 'Start Work', action: 'start' },
  in_progress: { label: 'Complete', action: 'complete' },
  completed: { label: 'Verify', action: 'verify' },
};

const EMPTY_FORM = { room_id: '', category: 'plumbing', priority: 'normal', title: '', description: '' };

export default function MaintenancePage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission(MAINTENANCE_MANAGE_PERM);

  const [tickets, setTickets] = useState([]);
  const [meta, setMeta] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [rooms, setRooms] = useState([]);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [assignTicket, setAssignTicket] = useState(null);
  const [staff, setStaff] = useState([]);
  const [selectedUser, setSelectedUser] = useState('');

  const [deleteTicket, setDeleteTicket] = useState(null);

  const load = useCallback(
    async (p = 1) => {
      setLoading(true);
      setError('');
      try {
        const params = { page: p, per_page: 15 };
        if (statusFilter) params.status = statusFilter;
        if (categoryFilter) params.category = categoryFilter;
        const payload = await maintenanceApi.list(params);
        setTickets(unwrapList(payload));
        setMeta(unwrapMeta(payload));
        setPage(p);
      } catch (e) {
        setError(e?.response?.data?.message ?? 'Failed to load maintenance tickets.');
      } finally {
        setLoading(false);
      }
    },
    [statusFilter, categoryFilter]
  );

  useEffect(() => {
    load(1);
  }, [load]);

  const refresh = useCallback(() => load(page), [load, page]);

  const runWorkflow = useCallback(
    async (ticket, action, extra) => {
      setBusyId(ticket.id);
      try {
        if (action === 'triage') await maintenanceApi.update(ticket.id, { status: 'triaged' });
        else if (action === 'assign') await maintenanceApi.assign(ticket.id, extra.user_id);
        else if (action === 'start') await maintenanceApi.update(ticket.id, { status: 'in_progress' });
        else if (action === 'complete') await maintenanceApi.complete(ticket.id);
        else if (action === 'verify') await maintenanceApi.verify(ticket.id);
        await refresh();
      } catch (e) {
        setError(e?.response?.data?.message ?? 'Action failed.');
      } finally {
        setBusyId(null);
      }
    },
    [refresh]
  );

  const openAssign = useCallback(async (ticket) => {
    setAssignTicket(ticket);
    setSelectedUser('');
    try {
      const payload = await usersApi.list({ per_page: 100 });
      setStaff(unwrapList(payload));
    } catch {
      setStaff([]);
    }
  }, []);

  const confirmAssign = useCallback(async () => {
    if (!assignTicket || !selectedUser) return;
    await runWorkflow(assignTicket, 'assign', { user_id: Number(selectedUser) });
    setAssignTicket(null);
  }, [assignTicket, selectedUser, runWorkflow]);

  const openCreate = useCallback(async () => {
    setForm(EMPTY_FORM);
    setFormError('');
    setFormOpen(true);
    try {
      const payload = await roomsApi.list({ per_page: 100 });
      setRooms(unwrapList(payload));
    } catch {
      setRooms([]);
    }
  }, []);

  const createTicket = useCallback(async () => {
    if (!form.title.trim()) {
      setFormError('Title is required.');
      return;
    }
    if (!form.description.trim()) {
      setFormError('Description is required.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      await maintenanceApi.create({
        room_id: form.room_id ? Number(form.room_id) : null,
        category: form.category,
        priority: form.priority,
        title: form.title.trim(),
        description: form.description.trim(),
      });
      setFormOpen(false);
      await load(1);
    } catch (e) {
      setFormError(e?.response?.data?.message ?? 'Failed to create ticket.');
    } finally {
      setSaving(false);
    }
  }, [form, load]);

  const confirmDelete = useCallback(async () => {
    if (!deleteTicket) return;
    setBusyId(deleteTicket.id);
    try {
      await maintenanceApi.remove(deleteTicket.id);
      setDeleteTicket(null);
      await refresh();
    } catch (e) {
      setError(e?.response?.data?.message ?? 'Failed to delete ticket.');
    } finally {
      setBusyId(null);
    }
  }, [deleteTicket, refresh]);

  const columns = [
    {
      key: 'ticket_number',
      label: 'Ticket',
      render: (t) => <span className="font-mono font-semibold text-gold-400">{t.ticket_number}</span>,
    },
    {
      key: 'room',
      label: 'Room',
      render: (t) => (t.room?.number ? `Room ${t.room.number}` : '—'),
    },
    {
      key: 'category',
      label: 'Category',
      render: (t) => <span className="capitalize">{(t.category ?? '').replace(/_/g, ' ')}</span>,
    },
    {
      key: 'priority',
      label: 'Priority',
      render: (t) => (
        <span className="inline-flex items-center gap-1.5">
          <span className={`inline-block h-2 w-2 rounded-full ${PRIORITY_DOT[t.priority] ?? 'bg-slate-400'}`} />
          <span className="capitalize text-xs">{t.priority ?? 'normal'}</span>
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (t) => <StatusBadge value={t.status} />,
    },
    {
      key: 'title',
      label: 'Title',
      render: (t) => <span className="line-clamp-1 max-w-xs">{t.title}</span>,
    },
    {
      key: 'assignee',
      label: 'Assignee',
      render: (t) => t.assigned_to?.name ?? '—',
    },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      render: (t) => {
        if (!canManage) return null;
        const next = NEXT_ACTION[t.status];
        return (
          <div className="flex flex-wrap gap-1.5">
            {next &&
              (next.action === 'assign' ? (
                <button
                  type="button"
                  disabled={busyId === t.id}
                  onClick={() => openAssign(t)}
                  className="rounded-md bg-blue-600/80 px-2 py-1 text-xs font-medium text-white hover:bg-blue-600 disabled:opacity-50"
                >
                  Assign
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busyId === t.id}
                  onClick={() => runWorkflow(t, next.action)}
                  className="rounded-md bg-gold-500/90 px-2 py-1 text-xs font-medium text-charcoal-900 hover:bg-gold-400 disabled:opacity-50"
                >
                  {next.label}
                </button>
              ))}
            {['open', 'triaged'].includes(t.status) && (
              <button
                type="button"
                onClick={() => setDeleteTicket(t)}
                className="rounded-md bg-red-600/20 px-2 py-1 text-xs font-medium text-red-300 ring-1 ring-red-500/40 hover:bg-red-600/40"
              >
                Delete
              </button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader
        title="Maintenance"
        subtitle="Hotel maintenance tickets and coordination."
        actions={
          canManage ? (
            <button
              type="button"
              onClick={openCreate}
              className="rounded-lg bg-gold-500 px-4 py-2 text-sm font-semibold text-charcoal-900 hover:bg-gold-400"
            >
              + New Ticket
            </button>
          ) : null
        }
      />

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300" role="alert">
          {error}
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by status"
          className="rounded-lg border border-charcoal-600 bg-charcoal-800 px-3 py-2 text-sm text-slate-200"
        >
          <option value="">All statuses</option>
          {TICKET_STATUSES.map((s) => (
            <option key={s} value={s} className="capitalize">
              {s.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          aria-label="Filter by category"
          className="rounded-lg border border-charcoal-600 bg-charcoal-800 px-3 py-2 text-sm text-slate-200"
        >
          <option value="">All categories</option>
          {TICKET_CATEGORIES.map((c) => (
            <option key={c} value={c} className="capitalize">
              {c.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : tickets.length === 0 ? (
        <EmptyState
          title="No maintenance tickets"
          message="No tickets match the current filters. Create one to report an issue."
        />
      ) : (
        <DataTable
          columns={columns}
          rows={tickets}
          loading={loading}
          page={meta?.current_page ?? page}
          perPage={meta?.per_page ?? 15}
          total={meta?.total ?? null}
          onPageChange={(p) => load(p)}
          emptyTitle="No maintenance tickets"
          emptyMessage="No tickets match the current filters."
        />
      )}

      {/* Create modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="New maintenance ticket"
        wide
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
              onClick={createTicket}
              disabled={saving}
              className="rounded-lg bg-gold-500 px-4 py-2 text-sm font-semibold text-charcoal-900 hover:bg-gold-400 disabled:opacity-50"
            >
              {saving ? 'Creating…' : 'Create Ticket'}
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
            Room (optional)
            <select
              value={form.room_id}
              onChange={(e) => setForm((f) => ({ ...f, room_id: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-charcoal-600 bg-charcoal-800 px-3 py-2 text-sm text-slate-100"
            >
              <option value="">No specific room</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  Room {r.number}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-300">
            Category
            <select
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-charcoal-600 bg-charcoal-800 px-3 py-2 text-sm text-slate-100"
            >
              {TICKET_CATEGORIES.map((c) => (
                <option key={c} value={c} className="capitalize">
                  {c.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-300">
            Priority
            <select
              value={form.priority}
              onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-charcoal-600 bg-charcoal-800 px-3 py-2 text-sm text-slate-100"
            >
              {TICKET_PRIORITIES.map((p) => (
                <option key={p} value={p} className="capitalize">
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-300">
            Title
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-charcoal-600 bg-charcoal-800 px-3 py-2 text-sm text-slate-100"
              placeholder="e.g. AC not cooling in room"
            />
          </label>
          <label className="block text-sm font-medium text-slate-300 sm:col-span-2">
            Description
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
              className="mt-1 w-full rounded-lg border border-charcoal-600 bg-charcoal-800 px-3 py-2 text-sm text-slate-100"
              placeholder="Describe the issue in detail"
            />
          </label>
        </div>
      </Modal>

      {/* Assign modal */}
      <Modal
        open={!!assignTicket}
        onClose={() => setAssignTicket(null)}
        title={`Assign technician — ${assignTicket?.ticket_number ?? ''}`}
        actions={
          <>
            <button
              type="button"
              onClick={() => setAssignTicket(null)}
              className="rounded-lg border border-charcoal-600 px-4 py-2 text-sm text-slate-300 hover:bg-charcoal-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmAssign}
              disabled={!selectedUser || busyId != null}
              className="rounded-lg bg-gold-500 px-4 py-2 text-sm font-semibold text-charcoal-900 hover:bg-gold-400 disabled:opacity-50"
            >
              Assign
            </button>
          </>
        }
      >
        <label className="block text-sm font-medium text-slate-300">
          Technician
          <select
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value)}
            className="mt-1 w-full rounded-lg border border-charcoal-600 bg-charcoal-800 px-3 py-2 text-sm text-slate-100"
          >
            <option value="">Select a technician…</option>
            {staff.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.email})
              </option>
            ))}
          </select>
        </label>
      </Modal>

      {/* Delete confirmation */}
      <Modal
        open={!!deleteTicket}
        onClose={() => setDeleteTicket(null)}
        title="Delete ticket?"
        actions={
          <>
            <button
              type="button"
              onClick={() => setDeleteTicket(null)}
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
          Delete ticket <span className="font-mono font-semibold text-gold-400">{deleteTicket?.ticket_number}</span>?
          This cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
