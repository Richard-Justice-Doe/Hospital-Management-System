import { useState, type FormEvent } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ROLE_LABELS } from '../../workflow/types';

const TABS = [
  { to: '/care/admin/overview', label: 'Overview' },
  { to: '/care/admin/staff', label: 'Users' },
  { to: '/care/admin/services', label: 'Services' },
  { to: '/care/admin/patients', label: 'Patients' },
  { to: '/care/admin/claims', label: 'Claims' },
  { to: '/care/admin/inventory', label: 'Inventory' },
  { to: '/care/admin/hr', label: 'HR' },
  { to: '/care/admin/reports', label: 'Analytics' },
  { to: '/care/admin/audit', label: 'Audit' },
  { to: '/care/admin/backups', label: 'Backups' },
];

export default function AdminLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  function search(event: FormEvent) {
    event.preventDefault();
    const q = query.trim();
    navigate(q ? `/care/admin/patients?q=${encodeURIComponent(q)}` : '/care/admin/patients');
  }

  return (
    <div>
      <header className="flex flex-wrap items-center gap-4 border-b border-slate-200 bg-white px-6 py-3">
        <h1 className="text-lg font-semibold text-clinic-900">Admin</h1>
        <form onSubmit={search} className="min-w-[16rem] flex-1">
          <label className="relative block">
            <span className="sr-only">Search patient records, appointments, resources</span>
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3-3" />
              </svg>
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search patient records, appointments, resources, etc."
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-10 pr-4 text-sm outline-none focus:border-clinic-500 focus:ring-2 focus:ring-clinic-100"
            />
          </label>
        </form>
        {user && (
          <p className="hidden text-sm text-slate-600 sm:block">
            {user.firstName} {user.lastName}
            <span className="ml-2 text-xs text-slate-500">{ROLE_LABELS[user.role]}</span>
          </p>
        )}
      </header>

      <nav className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-4 py-2">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end
            className={({ isActive }) =>
              `whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold ${
                isActive ? 'bg-clinic-600 text-white' : 'text-slate-600 hover:bg-clinic-50 hover:text-clinic-900'
              }`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <div className="desk-page">
        <Outlet />
      </div>
    </div>
  );
}
