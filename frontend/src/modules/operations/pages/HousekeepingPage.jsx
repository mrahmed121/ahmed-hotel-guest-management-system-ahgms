import { useCallback, useEffect, useMemo, useState } from 'react';
import PageHeader from '../../../components/PageHeader';
import EmptyState from '../../../components/EmptyState';
import Spinner from '../../../components/Spinner';
import Modal from '../../../components/Modal';
import { useAuth } from '../../../auth/AuthContext';
import {
  housekeepingApi,
  usersApi,
  unwrapList,
  TASK_STATUSES,
  TASK_PRIORITIES,
  PRIORITY_DOT,
  formatDateTime,
  HOUSEKEEPING_MANAGE_PERM,
} from '../services/operationsApi';
import { roomsApi } from '../../inventory/services/inventoryApi';

const STATUS_LABELS = {
  dirty: 'Dirty',
  assigned: 'Assigned',
  cleaning: 'Cleaning',
  inspection: 'Inspection',
  ready: 'Ready',
};

const STATUS_ACCENT = {
  dirty: 'border-orange-500/40',
  assigned: 'border-blue-500/40',
  cleaning: 'border-amber-500/40',
  inspection: 'border-violet-500/40',
  ready: 'border-emerald-500/40',
};

function PriorityDot({ priority }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-2 w-2 rounded-full ${PRIORITY_DOT[priority] ?? 'bg-slate-400'}`} />
      <span className="capitalize text-xs text-slate-300">{priority ?? 'normal'}</span>
    </span>
  );
}

function TaskCard({ task, canManage, onAction }) {
  const room = task.room?.number ?? task.room_number ?? '—';
  const assignee = task.assigned_to?.name ?? task.assigned_name ?? 'Unassigned';
  return (
    <div className="rounded-lg border border-charcoal-700 bg-charcoal-800 p-3 shadow">
      <div className="flex items-center justify-between gap-2">
        <span className="text-base font-bold text-gold-400">Room {room}</span>
        <PriorityDot priority={task.priority} />
      </div>
      <div className="mt-1 text-xs text-slate-400">{assignee}</div>
      {task.notes && <div className="mt-1 line-clamp-2 text-xs text-slate-300">{task.notes}</div>}
      <div className="mt-1 text-[11px] text-slate-500">
        {task.started_at ? `Started ${formatDateTime(task.started_at)}` : 'Not started'}
      </div>
      {canManage && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {task.status === 'dirty' && (
            <button
              type="button"
              onClick={() => onAction('assign', task)}
              className="rounded-md bg-blue-600/80 px-2 py-1 text-xs font-medium text-white hover:bg-blue-600"
            >
              Assign
            </button>
          )}
          {task.status === 'assigned' && (
            <button
              type="button"
              onClick={() => onAction('start', task)}
              className="rounded-md bg-amber-600/80 px-2 py-1 text-xs font-medium text-white hover:bg-amber-600"
            >
              Start Cleaning
            </button>
          )}
          {task.status === 'cleaning' && (
            <button
              type="button"
              onClick={() => onAction('complete', task)}
              className="rounded-md bg-violet-600/80 px-2 py-1 text-xs font-medium text-white hover:bg-violet-600"
            >
              Complete
            </button>
          )}
          {task.status === 'inspection' && (
            <>
              <button
                type="button"
                onClick={() => onAction('inspect-pass', task)}
                className="rounded-md bg-emerald-600/80 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-600"
              >
                Pass
              </button>
              <button
                type="button"
                onClick={() => onAction('inspect-fail', task)}
                className="rounded-md bg-red-600/80 px-2 py-1 text-xs font-medium text-white hover:bg-red-600"
              >
                Fail
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function HousekeepingPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission(HOUSEKEEPING_MANAGE_PERM);

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const [assignTask, setAssignTask] = useState(null);
  const [inspectTask, setInspectTask] = useState(null); // {task, passed}
  const [inspectNotes, setInspectNotes] = useState('');
  const [housekeepers, setHousekeepers] = useState([]);
  const [selectedUser, setSelectedUser] = useState('');

  const [newOpen, setNewOpen] = useState(false);
  const [dirtyRooms, setDirtyRooms] = useState([]);
  const [newForm, setNewForm] = useState({ room_id: '', priority: 'normal', notes: '' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const payload = await housekeepingApi.list({ per_page: 100 });
      setTasks(unwrapList(payload));
    } catch (e) {
      setError(e?.response?.data?.message ?? 'Failed to load housekeeping tasks.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const grouped = useMemo(() => {
    const map = Object.fromEntries(TASK_STATUSES.map((s) => [s, []]));
    for (const t of tasks) {
      const s = t.status;
      if (map[s]) map[s].push(t);
      else map.dirty.push(t);
    }
    return map;
  }, [tasks]);

  const refreshQuiet = useCallback(async () => {
    try {
      const payload = await housekeepingApi.list({ per_page: 100 });
      setTasks(unwrapList(payload));
    } catch {
      /* keep existing list on background refresh failure */
    }
  }, []);

  const runAction = useCallback(
    async (action, task, extra) => {
      setBusyId(task.id);
      try {
        if (action === 'start') await housekeepingApi.start(task.id);
        else if (action === 'complete') await housekeepingApi.complete(task.id);
        else if (action === 'assign') await housekeepingApi.assign(task.id, extra.user_id);
        else if (action === 'inspect')
          await housekeepingApi.inspect(task.id, extra.passed, extra.notes);
        await refreshQuiet();
      } catch (e) {
        setError(e?.response?.data?.message ?? 'Action failed.');
      } finally {
        setBusyId(null);
      }
    },
    [refreshQuiet]
  );

  const openAssign = useCallback(async (task) => {
    setAssignTask(task);
    setSelectedUser('');
    try {
      const payload = await usersApi.list({ per_page: 100 });
      setHousekeepers(unwrapList(payload));
    } catch {
      setHousekeepers([]);
    }
  }, []);

  const confirmAssign = useCallback(async () => {
    if (!assignTask || !selectedUser) return;
    await runAction('assign', assignTask, { user_id: Number(selectedUser) });
    setAssignTask(null);
  }, [assignTask, selectedUser, runAction]);

  const confirmInspect = useCallback(async () => {
    if (!inspectTask) return;
    await runAction('inspect', inspectTask.task, {
      passed: inspectTask.passed,
      notes: inspectNotes || null,
    });
    setInspectTask(null);
    setInspectNotes('');
  }, [inspectTask, inspectNotes, runAction]);

  const openNew = useCallback(async () => {
    setNewOpen(true);
    setFormError('');
    setNewForm({ room_id: '', priority: 'normal', notes: '' });
    try {
      const payload = await roomsApi.list({ status: 'dirty', per_page: 100 });
      const rooms = unwrapList(payload);
      const existingRoomIds = new Set(tasks.map((t) => t.room_id ?? t.room?.id));
      setDirtyRooms(rooms.filter((r) => !existingRoomIds.has(r.id)));
    } catch {
      setDirtyRooms([]);
    }
  }, [tasks]);

  const createTask = useCallback(async () => {
    if (!newForm.room_id) {
      setFormError('Please select a room.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      await housekeepingApi.create({
        room_id: Number(newForm.room_id),
        priority: newForm.priority,
        notes: newForm.notes || null,
      });
      setNewOpen(false);
      await refreshQuiet();
    } catch (e) {
      setFormError(e?.response?.data?.message ?? 'Failed to create task.');
    } finally {
      setSaving(false);
    }
  }, [newForm, refreshQuiet]);

  const handleCardAction = useCallback(
    (action, task) => {
      if (action === 'assign') openAssign(task);
      else if (action === 'inspect-pass') {
        setInspectTask({ task, passed: true });
        setInspectNotes('');
      } else if (action === 'inspect-fail') {
        setInspectTask({ task, passed: false });
        setInspectNotes('');
      } else runAction(action, task);
    },
    [openAssign, runAction]
  );

  return (
    <div>
      <PageHeader
        title="Housekeeping"
        subtitle="Room cleaning tasks from dirty to ready."
        actions={
          canManage ? (
            <button
              type="button"
              onClick={openNew}
              className="rounded-lg bg-gold-500 px-4 py-2 text-sm font-semibold text-charcoal-900 hover:bg-gold-400"
            >
              + New Task
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
      ) : tasks.length === 0 ? (
        <EmptyState
          title="No housekeeping tasks"
          message="All rooms are clean. New tasks appear here when rooms become dirty after check-out."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {TASK_STATUSES.map((status) => (
            <section
              key={status}
              aria-label={`${STATUS_LABELS[status]} tasks`}
              className={`rounded-xl border-t-4 ${STATUS_ACCENT[status]} bg-charcoal-900/60 p-3`}
            >
              <header className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-200">{STATUS_LABELS[status]}</h2>
                <span className="rounded-full bg-charcoal-700 px-2 py-0.5 text-xs text-slate-300">
                  {grouped[status].length}
                </span>
              </header>
              <div className="space-y-2.5">
                {grouped[status].length === 0 ? (
                  <p className="py-4 text-center text-xs text-slate-500">No tasks</p>
                ) : (
                  grouped[status].map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      canManage={canManage}
                      onAction={handleCardAction}
                    />
                  ))
                )}
              </div>
            </section>
          ))}
        </div>
      )}

      {busyId != null && (
        <div className="fixed bottom-4 right-4 rounded-lg bg-charcoal-800 px-4 py-2 text-sm text-slate-300 shadow-lg">
          Updating task…
        </div>
      )}

      {/* Assign modal */}
      <Modal
        open={!!assignTask}
        onClose={() => setAssignTask(null)}
        title={`Assign housekeeper — Room ${assignTask?.room?.number ?? ''}`}
        actions={
          <>
            <button
              type="button"
              onClick={() => setAssignTask(null)}
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
          Housekeeper
          <select
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value)}
            className="mt-1 w-full rounded-lg border border-charcoal-600 bg-charcoal-800 px-3 py-2 text-sm text-slate-100"
          >
            <option value="">Select a housekeeper…</option>
            {housekeepers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.email})
              </option>
            ))}
          </select>
        </label>
      </Modal>

      {/* Inspect modal */}
      <Modal
        open={!!inspectTask}
        onClose={() => setInspectTask(null)}
        title={`${inspectTask?.passed ? 'Pass' : 'Fail'} inspection — Room ${inspectTask?.task?.room?.number ?? ''}`}
        actions={
          <>
            <button
              type="button"
              onClick={() => setInspectTask(null)}
              className="rounded-lg border border-charcoal-600 px-4 py-2 text-sm text-slate-300 hover:bg-charcoal-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmInspect}
              disabled={busyId != null}
              className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${
                inspectTask?.passed ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-red-600 hover:bg-red-500'
              }`}
            >
              Confirm {inspectTask?.passed ? 'Pass' : 'Fail'}
            </button>
          </>
        }
      >
        <label className="block text-sm font-medium text-slate-300">
          Inspection notes (optional)
          <textarea
            value={inspectNotes}
            onChange={(e) => setInspectNotes(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-lg border border-charcoal-600 bg-charcoal-800 px-3 py-2 text-sm text-slate-100"
            placeholder={inspectTask?.passed ? 'Room is ready for guests.' : 'What needs re-cleaning?'}
          />
        </label>
      </Modal>

      {/* New task modal */}
      <Modal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        title="New housekeeping task"
        actions={
          <>
            <button
              type="button"
              onClick={() => setNewOpen(false)}
              className="rounded-lg border border-charcoal-600 px-4 py-2 text-sm text-slate-300 hover:bg-charcoal-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={createTask}
              disabled={saving}
              className="rounded-lg bg-gold-500 px-4 py-2 text-sm font-semibold text-charcoal-900 hover:bg-gold-400 disabled:opacity-50"
            >
              {saving ? 'Creating…' : 'Create Task'}
            </button>
          </>
        }
      >
        {formError && (
          <div className="mb-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300" role="alert">
            {formError}
          </div>
        )}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-slate-300">
            Room
            <select
              value={newForm.room_id}
              onChange={(e) => setNewForm((f) => ({ ...f, room_id: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-charcoal-600 bg-charcoal-800 px-3 py-2 text-sm text-slate-100"
            >
              <option value="">Select a dirty room…</option>
              {dirtyRooms.map((r) => (
                <option key={r.id} value={r.id}>
                  Room {r.number} — {r.room_type?.name ?? ''}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-300">
            Priority
            <select
              value={newForm.priority}
              onChange={(e) => setNewForm((f) => ({ ...f, priority: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-charcoal-600 bg-charcoal-800 px-3 py-2 text-sm text-slate-100"
            >
              {TASK_PRIORITIES.map((p) => (
                <option key={p} value={p} className="capitalize">
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-300">
            Notes
            <textarea
              value={newForm.notes}
              onChange={(e) => setNewForm((f) => ({ ...f, notes: e.target.value }))}
              rows={2}
              className="mt-1 w-full rounded-lg border border-charcoal-600 bg-charcoal-800 px-3 py-2 text-sm text-slate-100"
              placeholder="Optional cleaning notes"
            />
          </label>
        </div>
      </Modal>
    </div>
  );
}

export { STATUS_LABELS };
