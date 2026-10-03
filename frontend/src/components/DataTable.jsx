import { useMemo, useState } from 'react';
import EmptyState from './EmptyState';
import Spinner from './Spinner';

export default function DataTable({
  columns,
  rows = [],
  loading = false,
  page = 1,
  perPage = 15,
  total = null,
  onPageChange = null,
  emptyTitle = 'No records',
  emptyMessage = 'No data yet.',
  rowKey = 'id',
}) {
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  const sortedRows = useMemo(() => {
    if (!sortKey) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      const va = a?.[sortKey];
      const vb = b?.[sortKey];
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      const cmp = String(va).localeCompare(String(vb), undefined, { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const totalPages = total != null ? Math.max(1, Math.ceil(total / perPage)) : 1;

  if (loading) return <Spinner className="py-16" />;

  if (!sortedRows.length) {
    return <EmptyState title={emptyTitle} message={emptyMessage} />;
  }

  return (
    <div>
      <div className="overflow-x-auto rounded-xl border border-charcoal-700">
        <table className="min-w-full divide-y divide-charcoal-700 text-sm">
          <thead className="bg-charcoal-800">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400 ${
                    col.sortable ? 'cursor-pointer select-none hover:text-slate-200' : ''
                  }`}
                  onClick={col.sortable ? () => toggleSort(col.key) : undefined}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {col.sortable && sortKey === col.key && (
                      <span aria-hidden="true" className="text-gold-500">
                        {sortDir === 'asc' ? '▲' : '▼'}
                      </span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-charcoal-700 bg-charcoal-900">
            {sortedRows.map((row, i) => (
              <tr key={row?.[rowKey] ?? i} className="hover:bg-charcoal-800/60">
                {columns.map((col) => (
                  <td key={col.key} className="whitespace-nowrap px-4 py-3 text-slate-300">
                    {col.render ? col.render(row) : row?.[col.key] ?? '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {onPageChange && total != null && totalPages > 1 && (
        <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Pagination">
          <span className="text-slate-400">
            Page {page} of {totalPages} ({total} records)
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              className="rounded-md border border-charcoal-600 bg-charcoal-800 px-3 py-1.5 text-slate-300 hover:bg-charcoal-700 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              className="rounded-md border border-charcoal-600 bg-charcoal-800 px-3 py-1.5 text-slate-300 hover:bg-charcoal-700 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}
