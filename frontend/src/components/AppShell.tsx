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
import HospitalMark from './HospitalMark';
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
      { to: '/care/reception/patients', label: 'Patient Records' },
      { to: '/care/reception/copayer', label: 'Assign Copayer Patient' },
      { to: '/care/reception/visit', label: 'Patient Check In' },
      { to: '/care/reception/visit?mode=bill', label: 'Bill later' },
      { to: '/care/reception/visits', label: 'Today’s visits' },
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
  {
    group: 'work',
    to: '/care/billing',
    label: 'Cash unit',
    page: 'billing',
    children: [
      { to: '/care/billing/bill', label: 'Generate Bill' },
      { to: '/care/billing/deposit', label: 'Patient Deposit' },
      { to: '/care/billing/receipts', label: 'Patient Receipt By User' },
      { to: '/care/billing/external', label: 'Print External Receipt' },
      { to: '/care/billing/print', label: 'Print Receipt' },
      { to: '/care/billing/sales', label: 'Sales Summary By User' },
      { to: '/care/billing/details', label: 'View Patient Bill Details' },
      { to: '/care/billing/admin/copayer', label: 'Assign Copayer Patient' },
      { to: '/care/billing/admin/checkin', label: 'Patient Check In' },
      { to: '/care/billing/admin/records', label: 'Patient Records' },
    ],
  },
  { group: 'work', to: '/care/billing', label: 'Accounts', page: 'collections' },
  { group: 'work', to: '/care/claims', label: 'Claims', page: 'claims' },
  { group: 'work', to: '/care/stores', label: 'Stores', page: 'stores' },
  { group: 'work', to: '/care/procurement', label: 'Procurement', page: 'procurement' },
  { group: 'work', to: '/care/it', label: 'IT support', page: 'it' },
  { group: 'desk', to: '/care/chart', label: 'Find patient', page: 'chart' },
  { group: 'desk', to: '/care/appointments', label: 'Appointments', page: 'appointments' },
  { group: 'desk', to: '/care/messages', label: 'Messages', page: 'messages' },
  { group: 'desk', to: '/care/shifts', label: 'My shifts', page: 'shifts' },
  { group: 'desk', to: '/care/assistant', label: 'Assistant', page: 'assistant' },
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
    if (link.page === 'billing' && !canReceivePayment(user?.role)) return false;
    return canAccessPage(access, link.page);
  });
  const groups = (['work', 'desk', 'setup'] as NavGroup[]).filter((group) => links.some((link) => link.group === group));

  return (
    <AgentChatProvider>
    <div className="flex min-h-screen bg-slate-100">
      <aside className="flex w-64 shrink-0 flex-col bg-clinic-900 text-white">
        <div className="border-b border-white/10 px-4 py-4">
          <div className="flex items-center gap-3">
            <HospitalMark size="sm" />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-clinic-100">Municipal hospital</p>
              <p className="mt-0.5 truncate text-sm font-semibold text-white">
                {user?.department ? DEPARTMENT_LABELS[user.department] : user ? ROLE_LABELS[user.role] : 'Staff portal'}
              </p>
            </div>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-4 overflow-y-auto p-3">
          {groups.map((group) => (
            <div key={group}>
              <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-clinic-200/70">{GROUP_LABEL[group]}</p>
              <div className="flex flex-col gap-0.5">
                {links
                  .filter((link) => link.group === group)
                  .map((link) => {
                    const parentActive = location.pathname === link.to || location.pathname.startsWith(`${link.to}/`);
                    return (
                      <div key={`${link.page}-${link.label}`}>
                        <NavLink
                          to={link.children?.[0]?.to ?? link.to}
                          className={() =>
                            `block rounded-lg px-3 py-2 text-sm font-medium ${
                              parentActive ? 'bg-clinic-600 text-white' : 'text-slate-200 hover:bg-white/10'
                            }`
                          }
                        >
                          {link.label}
                        </NavLink>
                        {link.children && (parentActive || link.page === 'reception' || link.page === 'billing') && (
                          <div className="mb-1 ml-3 mt-1 border-l border-white/15 pl-2">
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
                                    active ? 'bg-white/15 text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white'
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

        <div className="border-t border-white/10 p-3">
          <p className="truncate text-sm font-medium text-white">
            {user?.firstName} {user?.lastName}
          </p>
          <p className="text-xs text-clinic-100/80">{user ? ROLE_LABELS[user.role] : ''}</p>
          <button
            type="button"
            onClick={() => logout()}
            className="mt-3 w-full rounded-lg border border-white/20 px-3 py-1.5 text-sm text-white hover:bg-white/10"
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
        {!location.pathname.startsWith('/care/dashboard') && <PageDashboard />}
        <Outlet />
        <CallNextOverlay />
      </div>
      <ClinicAgentWidget />
    </div>
    </AgentChatProvider>
  );
}
