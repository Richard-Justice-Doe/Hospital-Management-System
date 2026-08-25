import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCare } from '../context/CareContext';
import {
  DepartmentSpark,
  GroupedBarChart,
  HorizontalBarChart,
  METRIC_LABELS,
  PayerDonut,
  StackedPayerBars,
  TrendAreaChart,
} from '../components/DashboardCharts';
import StaffAvailabilityBoard from '../components/StaffAvailabilityBoard';
import { useCanOpen } from '../hooks/useStaffAccess';
import { buildPageDashboard, type DashboardPeriod, type StatBlock } from '../workflow/dashboard';
import { PAGE_PATH, homeDashboardPage } from '../workflow/permissions';
import { DeskPage, PageHeader } from '../components/PageChrome';

const BAR_METRICS: Array<keyof StatBlock> = ['visits', 'registration', 'nhis', 'private', 'checkIns'];

export default function DepartmentDashboardPage() {
  const { user } = useAuth();
  const { state } = useCare();
  const canOpenBilling = useCanOpen(['billing', 'collections']);
  const [period, setPeriod] = useState<DashboardPeriod>('today');
  const [barMetric, setBarMetric] = useState<keyof StatBlock>('visits');
  const page = homeDashboardPage({ role: user?.role ?? 'RECEPTIONIST', department: user?.department });
  const snapshot = useMemo(() => buildPageDashboard(state, page, period), [state, page, period]);
  const workPath = page === 'admin' ? '/care/admin' : PAGE_PATH[page];
  const trendTitle = period === 'today' ? 'Activity through today' : 'Activity over the last 7 days';

  return (
    <DeskPage>
      <PageHeader
        title={snapshot.title}
        actions={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPeriod('today')}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${period === 'today' ? 'bg-clinic-600 text-white' : 'border border-slate-300 bg-white hover:bg-slate-50'}`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setPeriod('all')}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${period === 'all' ? 'bg-clinic-600 text-white' : 'border border-slate-300 bg-white hover:bg-slate-50'}`}
            >
              All time
            </button>
          </div>
        }
      />

      <section className="mt-5 flex flex-wrap items-center justify-between gap-3 desk-panel p-4">
        <div>
          <h2 className="font-medium text-slate-900">Quick access</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {page !== 'admin' && (
            <Link to={workPath} className="rounded-lg bg-clinic-700 px-3 py-1.5 text-sm font-medium text-white">
              Open {snapshot.title.replace(/ dashboard$/i, '')}
            </Link>
          )}
          {canOpenBilling && (
            <Link to="/care/billing" className="rounded-lg bg-clinic-700 px-3 py-1.5 text-sm font-medium text-white">
              {user?.role === 'CASHIER' ? 'Cash unit' : 'Collections'}
            </Link>
          )}
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event('cms-open-agent'))}
            className="rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-clinic-50"
          >
            Assistant
          </button>
          <Link to="/care/assistant" className="rounded-lg bg-clinic-600 px-3 py-1.5 text-sm font-medium text-white">
            Open assistant
          </Link>
        </div>
      </section>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {snapshot.cards.map((card) => (
          <article key={card.key} className="desk-panel p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{card.label}</p>
            <p className="mt-2 text-3xl font-semibold text-clinic-900">{card.value}</p>
            <p className="mt-1 text-xs text-slate-500">{card.hint}</p>
          </article>
        ))}
      </section>

      <div className="mt-6">
        <StaffAvailabilityBoard state={state} department={snapshot.department} />
      </div>

      <section className="mt-6 desk-panel p-5">
        <h2 className="font-medium text-slate-900">{trendTitle}</h2>
        <p className="text-sm text-slate-500">
          {snapshot.hospitalWide ? 'Hospital visits, check-ins, and registrations.' : `${snapshot.title.replace(/ dashboard$/i, '')} activity over time.`}
        </p>
        <div className="mt-3">
          <TrendAreaChart points={snapshot.trend} title={trendTitle} />
        </div>
      </section>

      {snapshot.hospitalWide ? (
        <>
          <div className="mt-6 grid gap-6 lg:grid-cols-5">
            <section className="desk-panel p-5 lg:col-span-3">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="font-medium text-slate-900">{METRIC_LABELS[barMetric]} by department</h2>
                </div>
                <div className="flex flex-wrap gap-1">
                  {BAR_METRICS.map((metric) => (
                    <button
                      key={metric}
                      type="button"
                      onClick={() => setBarMetric(metric)}
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        barMetric === metric ? 'bg-clinic-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {METRIC_LABELS[metric]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-4">
                <HorizontalBarChart
                  rows={snapshot.departments}
                  metric={barMetric}
                  title={`${METRIC_LABELS[barMetric]} by department`}
                />
              </div>
            </section>
            <section className="desk-panel p-5 lg:col-span-2">
              <h2 className="font-medium text-slate-900">NHIS vs private</h2>
              <PayerDonut nhis={snapshot.hospital.nhis} privateCount={snapshot.hospital.private} title="NHIS versus private visits" />
            </section>
          </div>
          <section className="mt-6 desk-panel p-5">
            <h2 className="font-medium text-slate-900">NHIS and private by department</h2>
            <div className="mt-4">
              <StackedPayerBars rows={snapshot.departments} title="NHIS and private by department" />
            </div>
          </section>
          <section className="mt-6 desk-panel p-5">
            <h2 className="font-medium text-slate-900">Visits, registration, and check-ins</h2>
            <GroupedBarChart rows={snapshot.departments} title="Visits, registration, and check-ins by department" />
          </section>
          <section className="mt-6">
            <h2 className="font-medium text-slate-900">Every department</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {snapshot.departments.map((row) => (
                <article key={row.id} className="desk-panel p-4">
                  <h3 className="font-medium text-slate-900">{row.label}</h3>
                  <DepartmentSpark row={row} />
                </article>
              ))}
            </div>
          </section>
          <section className="mt-8 overflow-hidden desk-panel">
            <div className="border-b px-4 py-3">
              <h2 className="font-medium text-slate-900">All departments</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2 font-medium">Department</th>
                    <th className="px-4 py-2 font-medium">Total visits</th>
                    <th className="px-4 py-2 font-medium">Registration</th>
                    <th className="px-4 py-2 font-medium">NHIS</th>
                    <th className="px-4 py-2 font-medium">Private</th>
                    <th className="px-4 py-2 font-medium">Total check-ins</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.departments.map((row) => (
                    <tr key={row.id} className="border-t">
                      <td className="px-4 py-2 font-medium text-slate-800">{row.label}</td>
                      <td className="px-4 py-2">{row.visits}</td>
                      <td className="px-4 py-2">{row.registration}</td>
                      <td className="px-4 py-2">{row.nhis}</td>
                      <td className="px-4 py-2">{row.private}</td>
                      <td className="px-4 py-2">{row.checkIns}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : (
        <section className="mt-6 desk-panel p-5">
          <h2 className="font-medium text-slate-900">{snapshot.title.replace(/ dashboard$/i, '')} numbers</h2>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {snapshot.departments.map((row) => (
              <article key={row.id} className="desk-panel p-4">
                <h3 className="font-medium text-slate-900">{row.label}</h3>
                <DepartmentSpark row={row} />
              </article>
            ))}
            <div>
              <PayerDonut nhis={snapshot.departments[0]?.nhis ?? 0} privateCount={snapshot.departments[0]?.private ?? 0} title="NHIS versus private" />
            </div>
          </div>
        </section>
      )}
    </DeskPage>
  );
}
