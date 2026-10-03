export function Field({ label, error, children, className = '' }) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}

export const inputCls =
  'w-full rounded-lg border border-charcoal-600 bg-charcoal-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-gold-500';

export const btnPrimary =
  'rounded-lg bg-gold-500 px-4 py-2 text-sm font-semibold text-charcoal-950 hover:bg-gold-400 focus:outline-none focus:ring-2 focus:ring-gold-500 disabled:opacity-50';

export const btnSecondary =
  'rounded-lg border border-charcoal-600 bg-charcoal-800 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-charcoal-700 focus:outline-none focus:ring-2 focus:ring-gold-500 disabled:opacity-50';

export const btnDanger =
  'rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50';

export function firstError(errors, field) {
  const e = errors?.[field];
  return Array.isArray(e) ? e[0] : e;
}
