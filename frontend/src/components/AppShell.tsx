import { useAuth } from '../context/AuthContext';
import { useCare } from '../context/CareContext';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { CallNextOverlay, DeskActionBar, DeskChrome } from './DeskTools';
import ClinicAgentWidget from './ClinicAgentWidget';
import { AgentChatProvider } from '../context/AgentChatContext';
import { NotificationsBanner } from '../pages/HisOpsPages';
import { DEPARTMENT_LABELS } from '../workflow/catalog';
import { ROLE_LABELS } from '../workflow/types';
import PageDashboard from './PageDashboard';
import { canReceivePayment } from '../workflow/billing';
import { canAccessPage, type PageKey } from '../workflow/permissions';
import { useStaffAccess } from '../hooks/useStaffAccess';

type NavGroup = 'work' | 'desk' | 'setup';

const NAV: {
  group: NavGroup;
  to: string;
  label: string;
  page: PageKey;
  children?: { to: string; label: string }[];
}[] = [
  { group: 'work', to: '/care/dashboard', label: 'Dashboard', page: 'dashboard' },
  {
    group: 'work',
    to: '/care/reception',
    label: 'Reception',
    page: 'reception',
    children: [
      { to: '/care/reception/patients', label: '1. New folder' },
      { to: '/care/reception/visit', label: '2. Check-in & bill' },
      { to: '/care/reception/visit?mode=bill', label: '3. Bill later' },
      { to: '/care/reception/visits', label: '4. Today’s visits' },
      { to: '/care/reception/copayer', label: 'Co-payer' },
      { to: '/care/reception/merge', label: 'Fix duplicates' },
    ],
  },
  { group: 'work', to: '/care/nursing', label: 'Nursing', page: 'nursing' },
  { group: 'work', to: '/care/doctor', label: 'Doctor', page: 'doctor' },
  { group: 'work', to: '/care/lab', label: 'Laboratory', page: 'lab' },
  { group: 'work', to: '/care/pharmacy', label: 'Pharmacy', page: 'pharmacy' },
  { group: 'work', to: '/care/xray', label: 'Imaging', page: 'xray' },
  { group: 'work', to: '/care/physio', label: 'Physiotherapy', page: 'physio' },
  { group: 'work', to: '/care/eye', label: 'Eye clinic', page: 'eye' },
  { group: 'work', to: '/care/ent', label: 'ENT clinic', page: 'ent' },
  { group: 'work', to: '/care/dental', label: 'Dental clinic', page: 'dental' },
  { group: 'work', to: '/care/maternity', label: 'Maternity', page: 'maternity' },
  { group: 'work', to: '/care/triage', label: 'ED triage', page: 'triage' },
  { group: 'work', to: '/care/ward', label: 'Ward', page: 'ward' },
  { group: 'work', to: '/care/theatre', label: 'Theatre', page: 'theatre' },
  { group: 'work', to: '/care/billing', label: 'Receive payment', page: 'billing' },
  { group: 'work', to: '/care/billing', label: 'Accounts', page: 'collections' },
  { group: 'work', to: '/care/claims', label: 'Claims', page: 'claims' },
  { group: 'work', to: '/care/stores', label: 'Stores', page: 'stores' },
  { group: 'work', to: '/care/procurement', label: 'Procurement', page: 'procurement' },
  { group: 'work', to: '/care/it', label: 'IT support', page: 'it' },
  { group: 'desk', to: '/care/chart', label: 'Find patient', page: 'chart' },
  { group: 'desk', to: '/care/appointments', label: 'Appointments', page: 'appointments' },
  { group: 'desk', to: '/care/messages', label: 'Messages', page: 'messages' },
  { group: 'desk', to: '/care/shifts', label: 'My shifts', page: 'shifts' },
  { group: 'desk', to: '/care/assistant', label: 'Ask AI', page: 'assistant' },
  {
    group: 'setup',
    to: '/care/admin',
    label: 'Admin',
    page: 'admin',
    children: [
      { to: '/care/admin/overview', label: 'Overview' },
      { to: '/care/admin/staff', label: 'Users' },
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

const GROUP_LABEL: Record<NavGroup, string> = {
  work: 'My work',
  desk: 'Desk tools',
  setup: 'Hospital setup',
};

export default function AppShell() {
  const { user, logout } = useAuth();
  const { syncError } = useCare();
  const location = useLocation();
  const access = useStaffAccess();
  const links = NAV.filter((link) => {
    if (link.page === 'billing' && link.label === 'Receive payment' && !canReceivePayment(user?.role)) return false;
    return canAccessPage(access, link.page);
  });
  const groups = (['work', 'desk', 'setup'] as NavGroup[]).filter((group) => links.some((link) => link.group === group));

  return (
    <AgentChatProvider>
    <div className="flex min-h-screen bg-slate-50">
      <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-4">
          <p className="text-xs font-medium uppercase tracking-wide text-clinic-600">Clinic CMS</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">
            {user?.department ? DEPARTMENT_LABELS[user.department] : user ? ROLE_LABELS[user.role] : 'Staff portal'}
          </p>
        </div>

        <nav className="flex flex-1 flex-col gap-4 overflow-y-auto p-3">
          {groups.map((group) => (
            <div key={group}>
              <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{GROUP_LABEL[group]}</p>
              <div className="flex flex-col gap-1">
                {links
                  .filter((link) => link.group === group)
                  .map((link) => {
                    const parentActive = location.pathname === link.to || location.pathname.startsWith(`${link.to}/`);
                    return (
                      <div key={`${link.page}-${link.label}`}>
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
                        {link.children && (parentActive || link.page === 'reception') && (
                          <div className="mb-1 ml-2 mt-1 border-l border-slate-200 pl-2">
                            {link.children.map((child) => (
                              <NavLink
                                key={child.to}
                                to={child.to}
                                className={() => {
                                  const active = child.to.includes('mode=bill')
                                    ? location.pathname.endsWith('/visit') && location.search.includes('mode=bill')
                                    : child.to.endsWith('/visit')
                                      ? location.pathname.endsWith('/visit') && !location.search.includes('mode=bill')
                                      : location.pathname.startsWith(child.to.split('?')[0] ?? child.to) &&
                                        (child.to.includes('?') ? location.search.includes(child.to.split('?')[1] ?? '') : true);
                                  return `block rounded-lg px-2 py-1.5 text-xs font-medium ${
                                    active ? 'bg-clinic-50 text-clinic-800' : 'text-slate-600 hover:bg-slate-50'
                                  }`;
                                }}
                              >
                                {child.label}
                              </NavLink>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-slate-100 p-3">
          <p className="truncate text-sm font-medium text-slate-800">
            {user?.firstName} {user?.lastName}
          </p>
          <p className="text-xs text-slate-500">{user ? ROLE_LABELS[user.role] : ''}</p>
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
        <DeskChrome />
        {syncError && <div className="bg-amber-50 px-6 py-2 text-sm text-amber-900">{syncError}</div>}
        <DeskActionBar />
        <NotificationsBanner />
        {!location.pathname.startsWith('/care/dashboard') && (
          <div className="px-6 pt-3">
            <PageDashboard />
          </div>
        )}
        <Outlet />
        <CallNextOverlay />
      </div>
      <ClinicAgentWidget />
    </div>
    </AgentChatProvider>
  );
}
