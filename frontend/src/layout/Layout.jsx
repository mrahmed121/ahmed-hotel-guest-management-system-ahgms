import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import PermissionGuard from '../components/PermissionGuard';

const NAV = [
  { to: '/', label: 'Dashboard', end: true, permission: 'dashboard.view' },
  { to: '/front-desk', label: 'Front Desk', permission: 'stays.view' },
  { to: '/reservations', label: 'Reservations', permission: 'reservations.view' },
  { to: '/availability', label: 'Availability', permission: 'availability.view' },
  { to: '/guests', label: 'Guests', permission: 'guests.view' },
  { to: '/rooms', label: 'Rooms', permission: 'rooms.view' },
  { to: '/folios', label: 'Folios', permission: 'folios.view' },
  { to: '/housekeeping', label: 'Housekeeping', permission: 'housekeeping.view' },
  { to: '/maintenance', label: 'Maintenance', permission: 'maintenance.view' },
  { to: '/reports', label: 'Reports', permission: 'reports.view' },
  { to: '/services', label: 'Services', permission: 'services.view' },
  { to: '/settings', label: 'Settings', permission: 'settings.view' },
];

function SidebarContent({ onNavigate }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-charcoal-700 px-5 py-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-charcoal-800 ring-1 ring-gold-500/40">
          <svg className="h-6 w-6 text-gold-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-4h6v4M9 10h.01M15 10h.01M12 10h.01M9 14h.01M15 14h.01M12 14h.01" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-bold tracking-wide text-slate-100">AHGMS</p>
          <p className="text-[11px] text-slate-500">Hotel Management</p>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Primary">
        <ul className="space-y-1">
          {NAV.map((item) => (
            <PermissionGuard key={item.to} permission={item.permission}>
              <li>
                <NavLink
                  to={item.to}
                  end={item.end}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    `block rounded-md px-3 py-2 text-sm transition ${
                      isActive
                        ? 'bg-charcoal-700 font-semibold text-gold-400'
                        : 'text-slate-300 hover:bg-charcoal-800 hover:text-slate-100'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            </PermissionGuard>
          ))}
        </ul>
      </nav>
      <div className="border-t border-charcoal-700 px-5 py-3">
        <p className="text-[11px] text-slate-500">Developed by Ahmed</p>
      </div>
    </div>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex h-screen bg-charcoal-900">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 border-r border-charcoal-700 bg-charcoal-950 md:block">
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMenuOpen(false)} aria-hidden="true" />
          <aside className="absolute inset-y-0 left-0 w-64 bg-charcoal-950 shadow-2xl">
            <SidebarContent onNavigate={() => setMenuOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-charcoal-700 bg-charcoal-950 px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Open navigation menu"
              className="rounded-md p-2 text-slate-300 hover:bg-charcoal-800 md:hidden"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div>
              <p className="text-sm font-semibold text-slate-100">{user?.hotel?.name ?? 'Hotel'}</p>
              <p className="text-[11px] italic text-gold-500">Ahmed — Hospitality, Managed Smarter.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-300 sm:block">
              {user?.name ?? user?.email ?? ''}
            </span>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-md border border-charcoal-600 px-3 py-1.5 text-sm text-slate-300 hover:bg-charcoal-800"
            >
              Logout
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
