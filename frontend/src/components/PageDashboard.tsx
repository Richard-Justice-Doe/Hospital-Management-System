import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCare } from '../context/CareContext';
import { buildPageDashboard, type DashboardPeriod } from '../workflow/dashboard';
import { homeDashboardPage, pagesForPath } from '../workflow/permissions';

export default function PageDashboard({
  page: pageOverride,
  compact = true,
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
    <section className={`rounded-xl border bg-white ${compact ? 'p-4' : 'p-5'}`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-clinic-700">Required dashboard</p>
          <h2 className={compact ? 'text-base font-semibold text-clinic-900' : 'text-lg font-semibold text-clinic-900'}>
            {snapshot.title}
          </h2>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPeriod('today')}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${period === 'today' ? 'bg-clinic-600 text-white' : 'border bg-white'}`}
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setPeriod('all')}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${period === 'all' ? 'bg-clinic-600 text-white' : 'border bg-white'}`}
          >
            All time
          </button>
        </div>
      </div>
      <div className={`mt-4 grid gap-3 ${compact ? 'sm:grid-cols-2 lg:grid-cols-5' : 'sm:grid-cols-2 lg:grid-cols-5'}`}>
        {snapshot.cards.map((card) => (
          <article key={card.key} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{card.label}</p>
            <p className="mt-1 text-2xl font-semibold text-clinic-900">{card.value}</p>
            <p className="mt-0.5 text-xs text-slate-500">{card.hint}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
