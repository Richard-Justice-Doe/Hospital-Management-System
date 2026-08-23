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
    <div className="min-h-full bg-[#f5f7fb]">
      <header className="flex flex-wrap items-center gap-4 border-b border-slate-200 bg-white px-6 py-3">
        <h1 className="text-lg font-semibold text-blue-800">Admin</h1>
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
              className="w-full rounded-full border border-slate-200 bg-slate-50 py-2 pl-10 pr-4 text-sm outline-none focus:border-blue-500 focus:bg-white"
            />
          </label>
        </form>
        {user && (
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 sm:flex" aria-hidden>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5" />
                <path d="M9 17a3 3 0 0 0 6 0" />
              </svg>
            </span>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-800">
              {user.firstName[0]}
              {user.lastName[0]}
            </span>
            <span className="hidden leading-tight sm:block">
              <span className="block text-sm font-semibold text-slate-900">
                {user.firstName} {user.lastName}
              </span>
              <span className="text-xs text-slate-500">{ROLE_LABELS[user.role]}</span>
            </span>
          </div>
        )}
      </header>

      <nav className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-4 py-2">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end
            className={({ isActive }) =>
              `whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${
                isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <div className="p-6">
        <Outlet />
      </div>
    </div>
  );
}
