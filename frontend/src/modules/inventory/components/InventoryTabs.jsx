import { Link, useLocation } from 'react-router-dom';

const TABS = [
  { to: '/rooms', label: 'Rooms', end: true },
  { to: '/rooms/types', label: 'Room Types' },
  { to: '/rooms/floors', label: 'Floors' },
  { to: '/rooms/rate-plans', label: 'Rate Plans' },
];

export default function InventoryTabs() {
  const { pathname } = useLocation();
  return (
    <nav aria-label="Inventory sections" className="mb-6 flex flex-wrap gap-2">
      {TABS.map((t) => {
        const active = t.end ? pathname === t.to : pathname.startsWith(t.to);
        return (
          <Link
            key={t.to}
            to={t.to}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              active
                ? 'bg-gold-500/15 text-gold-300 ring-1 ring-gold-500/40'
                : 'text-slate-400 hover:bg-charcoal-800 hover:text-slate-200'
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
