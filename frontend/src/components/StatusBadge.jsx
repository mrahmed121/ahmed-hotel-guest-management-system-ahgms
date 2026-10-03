const STYLES = {
  // reservation lifecycle
  inquiry: 'bg-sky-500/15 text-sky-300 ring-sky-500/40',
  reserved: 'bg-amber-500/15 text-amber-300 ring-amber-500/40',
  confirmed: 'bg-blue-500/15 text-blue-300 ring-blue-500/40',
  checked_in: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/40',
  checked_out: 'bg-slate-500/15 text-slate-300 ring-slate-500/40',
  cancelled: 'bg-red-500/15 text-red-300 ring-red-500/40',
  no_show: 'bg-orange-500/15 text-orange-300 ring-orange-500/40',
  // room lifecycle
  available: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/40',
  occupied: 'bg-blue-500/15 text-blue-300 ring-blue-500/40',
  dirty: 'bg-orange-500/15 text-orange-300 ring-orange-500/40',
  cleaning: 'bg-amber-500/15 text-amber-300 ring-amber-500/40',
  maintenance: 'bg-red-500/15 text-red-300 ring-red-500/40',
  out_of_service: 'bg-red-500/15 text-red-300 ring-red-500/40',
  // housekeeping
  assigned: 'bg-blue-500/15 text-blue-300 ring-blue-500/40',
  inspection: 'bg-violet-500/15 text-violet-300 ring-violet-500/40',
  ready: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/40',
  // generic
  active: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/40',
  inactive: 'bg-slate-500/15 text-slate-300 ring-slate-500/40',
  open: 'bg-amber-500/15 text-amber-300 ring-amber-500/40',
  closed: 'bg-slate-500/15 text-slate-300 ring-slate-500/40',
  paid: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/40',
  unpaid: 'bg-red-500/15 text-red-300 ring-red-500/40',
  pending: 'bg-amber-500/15 text-amber-300 ring-amber-500/40',
};

export default function StatusBadge({ value, className = '' }) {
  const style = STYLES[value] || 'bg-slate-500/15 text-slate-300 ring-slate-500/40';
  const label = String(value ?? '').replace(/[-_]/g, ' ');
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ${style} ${className}`}
    >
      {label}
    </span>
  );
}
