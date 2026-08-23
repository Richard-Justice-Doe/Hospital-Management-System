import { NavLink, Outlet, useLocation, useSearchParams } from 'react-router-dom';
import DepartmentShiftPanel from '../../components/DepartmentShiftPanel';

const DAILY = [
  { to: '/care/reception/patients', step: '1', label: 'New folder', hint: 'Search first, then open a folder and print the ID card' },
  { to: '/care/reception/visit', step: '2', label: 'Check-in & bill', hint: 'Start today’s visit and print a queue ticket' },
  { to: '/care/reception/visit?mode=bill', step: '3', label: 'Bill later', hint: 'Check in without cash — Accounts collects later' },
  { to: '/care/reception/visits', step: '4', label: 'Today’s visits', hint: 'Who is in, and which ticket they hold' },
];

const RECORDS = [
  { to: '/care/reception/copayer', step: '', label: 'Co-payer', hint: 'Companies and relatives who share the bill' },
  { to: '/care/reception/merge', step: '', label: 'Fix duplicates', hint: 'Same person, two folders — merge with an audit' },
];

function linkActive(to: string, pathname: string, mode: string | null) {
  if (to.includes('mode=bill')) return pathname.endsWith('/visit') && mode === 'bill';
  if (to.endsWith('/visit')) return pathname.endsWith('/visit') && mode !== 'bill';
  return pathname.startsWith(to);
}

function Tile({
  to,
  step,
  label,
  hint,
  active,
}: {
  to: string;
  step: string;
  label: string;
  hint: string;
  active: boolean;
}) {
  return (
    <NavLink
      to={to}
      className={`rounded-xl border px-4 py-3 text-left ${
        active ? 'border-clinic-600 bg-clinic-600 text-white' : 'border-slate-200 bg-white text-slate-800 hover:border-clinic-300 hover:bg-clinic-50'
      }`}
    >
      {step ? (
        <span className={`mb-1 block text-[11px] font-semibold uppercase tracking-wide ${active ? 'text-white/70' : 'text-clinic-600'}`}>
          Step {step}
        </span>
      ) : null}
      <span className="block text-sm font-semibold">{label}</span>
      <span className={`mt-1 block text-xs ${active ? 'text-white/80' : 'text-slate-500'}`}>{hint}</span>
    </NavLink>
  );
}

export default function ReceptionLayout() {
  const location = useLocation();
  const [params] = useSearchParams();
  const mode = params.get('mode');

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-clinic-900">Reception</h1>
      <p className="mt-1 text-sm text-slate-600">
        Folders, check-in, and today’s list. Cash stays with the cashier — Reception bills, Accounts receives.
      </p>
      <DepartmentShiftPanel department="RECORDS" />

      <section className="mt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-clinic-700">Daily work</h2>
        <nav className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {DAILY.map((link) => (
            <Tile key={link.to} {...link} active={linkActive(link.to, location.pathname, mode)} />
          ))}
        </nav>
      </section>

      <section className="mt-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Records tools</h2>
        <nav className="mt-3 grid gap-2 sm:grid-cols-2">
          {RECORDS.map((link) => (
            <Tile key={link.to} {...link} active={linkActive(link.to, location.pathname, mode)} />
          ))}
        </nav>
      </section>

      <div className="mt-6">
        <Outlet />
      </div>
    </div>
  );
}
