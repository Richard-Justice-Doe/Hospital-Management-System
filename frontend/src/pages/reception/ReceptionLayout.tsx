import { NavLink, Outlet } from 'react-router-dom';
import DepartmentShiftPanel from '../../components/DepartmentShiftPanel';

const ADMIN_LINKS = [
  { to: '/care/reception/patients', label: 'New patients' },
  { to: '/care/reception/visit', label: 'New visit & billing' },
  { to: '/care/reception/copayer', label: 'Co-payer' },
  { to: '/care/reception/visits', label: 'Visits' },
  { to: '/care/reception/merge', label: 'Duplicate merge' },
];

export default function ReceptionLayout() {
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-clinic-900">Reception</h1>
      <DepartmentShiftPanel department="RECORDS" />

      <section className="mt-6 rounded-xl border bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-clinic-700">Patient administration</h2>
        <nav className="mt-3 flex flex-wrap gap-2">
          {ADMIN_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end
              className={({ isActive }) =>
                `rounded-lg px-4 py-2 text-sm font-medium ${isActive ? 'bg-clinic-600 text-white' : 'border bg-slate-50 text-slate-700 hover:bg-clinic-50'}`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </section>

      <div className="mt-6">
        <Outlet />
      </div>
    </div>
  );
}
