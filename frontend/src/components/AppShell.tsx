import { useAuth } from '../context/AuthContext';
import { useCare } from '../context/CareContext';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import ClinicAgentWidget from './ClinicAgentWidget';
import { AgentChatProvider } from '../context/AgentChatContext';
import { NotificationsBanner } from '../pages/HisOpsPages';
import { DEPARTMENT_LABELS } from '../workflow/catalog';
import { ROLE_LABELS, type StaffRole } from '../workflow/types';
import { canAccessPage, type PageKey } from '../workflow/permissions';
import { useStaffAccess } from '../hooks/useStaffAccess';

const ALL_ROLES: StaffRole[] = [
  'ADMIN',
  'RECEPTIONIST',
  'NURSE',
  'DOCTOR',
  'PHARMACIST',
  'LAB',
  'RADIOLOGY',
  'PHYSIO',
  'CASHIER',
  'ACCOUNTANT',
  'EYE_DOCTOR',
  'EYE_NURSE',
  'ENT_DOCTOR',
  'ENT_NURSE',
  'DENTIST',
  'MIDWIFE',
];

const CARE_LINKS: {
  to: string;
  label: string;
  page: PageKey;
  roles: StaffRole[];
  section?: string;
  children?: { to: string; label: string }[];
}[] = [
  { to: '/care/dashboard', label: 'Dashboard', page: 'dashboard', roles: ALL_ROLES },
  { to: '/care/chart', label: 'Patient chart', page: 'chart', roles: ALL_ROLES },
  { to: '/care/appointments', label: 'Appointments', page: 'appointments', roles: ['RECEPTIONIST', 'ADMIN', 'DOCTOR'] },
  { to: '/care/assistant', label: 'AI assistant', page: 'assistant', roles: ALL_ROLES },
  {
    to: '/care/reception',
    label: 'Reception',
    page: 'reception',
    roles: ['RECEPTIONIST', 'ADMIN'],
    section: 'Patient administration',
    children: [
      { to: '/care/reception/patients', label: 'New patients' },
      { to: '/care/reception/visit', label: 'New visit & billing' },
      { to: '/care/reception/copayer', label: 'Co-payer' },
      { to: '/care/reception/visits', label: 'Visits' },
      { to: '/care/reception/merge', label: 'Duplicate merge' },
    ],
  },
  { to: '/care/nursing', label: 'Nursing', page: 'nursing', roles: ['NURSE', 'ADMIN'] },
  { to: '/care/triage', label: 'ED triage', page: 'triage', roles: ['NURSE', 'DOCTOR', 'RECEPTIONIST', 'ADMIN'] },
  { to: '/care/ward', label: 'Ward / ADT', page: 'ward', roles: ['NURSE', 'DOCTOR', 'ADMIN'] },
  { to: '/care/theatre', label: 'Theatre', page: 'theatre', roles: ['DOCTOR', 'NURSE', 'ADMIN'] },
  { to: '/care/doctor', label: 'Doctor', page: 'doctor', roles: ['DOCTOR', 'ADMIN'] },
  { to: '/care/lab', label: 'Laboratory', page: 'lab', roles: ['LAB', 'ADMIN'] },
  { to: '/care/xray', label: 'X-ray / imaging', page: 'xray', roles: ['RADIOLOGY', 'ADMIN'] },
  { to: '/care/physio', label: 'Physiotherapy', page: 'physio', roles: ['PHYSIO', 'ADMIN'] },
  { to: '/care/pharmacy', label: 'Pharmacy', page: 'pharmacy', roles: ['PHARMACIST', 'ADMIN'] },
  { to: '/care/eye', label: 'Eye clinic', page: 'eye', roles: ['EYE_DOCTOR', 'EYE_NURSE', 'ADMIN'] },
  { to: '/care/ent', label: 'ENT clinic', page: 'ent', roles: ['ENT_DOCTOR', 'ENT_NURSE', 'ADMIN'] },
  { to: '/care/dental', label: 'Dental clinic', page: 'dental', roles: ['DENTIST', 'ADMIN'] },
  { to: '/care/maternity', label: 'Maternity / ANC', page: 'maternity', roles: ['MIDWIFE', 'ADMIN'] },
  { to: '/care/billing', label: 'Receive payment', page: 'billing', roles: ['CASHIER', 'ADMIN'] },
  { to: '/care/billing', label: 'Collections', page: 'collections', roles: ['ACCOUNTANT'] },
  { to: '/care/messages', label: 'Messages', page: 'messages', roles: ALL_ROLES },
  { to: '/care/shifts', label: 'Shifts', page: 'shifts', roles: ALL_ROLES },
  {
    to: '/care/admin',
    label: 'Admin',
    page: 'admin',
    roles: ['ADMIN'],
    section: 'Hospital setup',
    children: [
      { to: '/care/admin/overview', label: 'Overview' },
      { to: '/care/admin/staff', label: 'Staff' },
      { to: '/care/admin/services', label: 'Services' },
      { to: '/care/admin/patients', label: 'Patients' },
      { to: '/care/admin/claims', label: 'Claims' },
      { to: '/care/admin/inventory', label: 'Inventory' },
      { to: '/care/admin/hr', label: 'HR' },
      { to: '/care/admin/reports', label: 'Reports' },
      { to: '/care/admin/audit', label: 'Audit' },
      { to: '/care/admin/backups', label: 'Backups' },
    ],
  },
];

export default function AppShell() {
  const { user, logout } = useAuth();
  const { syncError } = useCare();
  const location = useLocation();
  const access = useStaffAccess();
  const links = CARE_LINKS.filter((link) => canAccessPage(access, link.page));

  return (
    <AgentChatProvider>
    <div className="flex min-h-screen bg-slate-50">
      <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-5">
          <p className="text-xs font-medium uppercase tracking-wide text-clinic-600">Clinic CMS</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">Staff portal</p>
        </div>

        <nav className="flex flex-1 flex-col gap-1 p-3">
          {links.map((link) => {
            const parentActive = location.pathname === link.to || location.pathname.startsWith(`${link.to}/`);
            return (
              <div key={link.page}>
                <NavLink
                  to={link.children?.[0]?.to ?? link.to}
                  className={() =>
                    `rounded-lg px-3 py-2 text-sm font-medium ${
                      parentActive ? 'bg-clinic-600 text-white' : 'text-slate-700 hover:bg-clinic-50'
                    }`
                  }
                >
                  {link.label}
                </NavLink>
                {link.children && parentActive && (
                  <div className="mb-2 ml-2 mt-1 border-l border-slate-200 pl-2">
                    {link.section && (
                      <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                        {link.section}
                      </p>
                    )}
                    {link.children.map((child) => (
                      <NavLink
                        key={child.to}
                        to={child.to}
                        end
                        className={({ isActive }) =>
                          `block rounded-lg px-2 py-1.5 text-xs font-medium ${
                            isActive ? 'bg-clinic-50 text-clinic-800' : 'text-slate-600 hover:bg-slate-50'
                          }`
                        }
                      >
                        {child.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="border-t border-slate-100 p-3">
          <p className="truncate text-sm font-medium text-slate-800">
            {user?.firstName} {user?.lastName}
          </p>
          <p className="text-xs text-slate-500">
            {user ? ROLE_LABELS[user.role] : ''}
            {user?.department ? ` · ${DEPARTMENT_LABELS[user.department]}` : ''}
            {user?.inChargeOf ? ` · In-charge of ${DEPARTMENT_LABELS[user.inChargeOf]}` : ''}
          </p>
          <button
            type="button"
            onClick={() => logout()}
            className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            Sign out
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {syncError && <div className="bg-amber-50 px-6 py-2 text-sm text-amber-900">{syncError}</div>}
        <NotificationsBanner />
        <Outlet />
      </div>
      <ClinicAgentWidget />
    </div>
    </AgentChatProvider>
  );
}
