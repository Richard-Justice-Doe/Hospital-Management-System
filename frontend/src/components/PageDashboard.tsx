import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCare } from '../context/CareContext';
import { buildPageDashboard, type DashboardPeriod } from '../workflow/dashboard';
import { homeDashboardPage, pagesForPath } from '../workflow/permissions';

export default function PageDashboard({
  page: pageOverride,
}: {
  page?: ReturnType<typeof pagesForPath>[0];
  compact?: boolean;
}) {
  const { user } = useAuth();
  const { state } = useCare();
  const location = useLocation();
  const [period, setPeriod] = useState<DashboardPeriod>('today');
  const page = pageOverride ?? pagesForPath(location.pathname)[0];
  const snapshot = useMemo(
    () =>
      buildPageDashboard(
        state,
        page === 'dashboard' ? homeDashboardPage({ role: user?.role ?? 'RECEPTIONIST', department: user?.department }) : page,
        period,
      ),
    [state, page, period, user?.role, user?.department],
  );

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-slate-200 bg-white px-6 py-2 text-sm">
      <p className="font-semibold text-clinic-900">{snapshot.title.replace(/ dashboard$/i, '')}</p>
      {snapshot.cards.map((card) => (
        <p key={card.key} className="text-slate-600">
          <span className="font-semibold text-slate-900">{card.value}</span> {card.label.toLowerCase()}
        </p>
      ))}
      <div className="ml-auto flex gap-1">
        <button
          type="button"
          onClick={() => setPeriod('today')}
          className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${period === 'today' ? 'bg-clinic-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
        >
          Today
        </button>
        <button
          type="button"
          onClick={() => setPeriod('all')}
          className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${period === 'all' ? 'bg-clinic-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
        >
          All time
        </button>
      </div>
    </div>
  );
}
