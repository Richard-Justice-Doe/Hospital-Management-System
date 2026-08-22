import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
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
import { buildDashboardSnapshot, type DashboardPeriod, type StatBlock } from '../workflow/dashboard';

const CARDS: Array<{ key: keyof StatBlock; label: string; hint: string }> = [
  { key: 'visits', label: 'Total visits', hint: 'Encounters opened in this period' },
  { key: 'registration', label: 'Registration', hint: 'New folders opened' },
  { key: 'nhis', label: 'NHIS', hint: 'Government insurance visits' },
  { key: 'private', label: 'Private', hint: 'Private insurance or cash patients' },
  { key: 'checkIns', label: 'Total check-ins', hint: 'Patients checked in at reception' },
];

const BAR_METRICS: Array<keyof StatBlock> = ['visits', 'registration', 'nhis', 'private', 'checkIns'];

export default function DepartmentDashboardPage() {
  const { state } = useCare();
  const [period, setPeriod] = useState<DashboardPeriod>('today');
  const [barMetric, setBarMetric] = useState<keyof StatBlock>('visits');
  const snapshot = useMemo(() => buildDashboardSnapshot(state, period), [state, period]);
  const trendTitle = period === 'today' ? 'Activity through today' : 'Activity over the last 7 days';

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-clinic-900">Department dashboard</h1>
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

      <section className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-4">
        <div>
          <h2 className="font-medium text-slate-900">AI assistant</h2>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event('cms-open-agent'))}
            className="rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-clinic-50"
          >
            Ask here
          </button>
          <Link to="/care/assistant" className="rounded-lg bg-clinic-600 px-3 py-1.5 text-sm font-medium text-white">
            Open assistant
          </Link>
        </div>
      </section>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {CARDS.map((card) => (
          <button
            key={card.key}
            type="button"
            onClick={() => setBarMetric(card.key)}
            className={`rounded-xl border p-4 text-left ${
              barMetric === card.key ? 'border-clinic-600 bg-clinic-50' : 'bg-white hover:border-clinic-200'
            }`}
          >
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{card.label}</p>
            <p className="mt-2 text-3xl font-semibold text-clinic-900">{snapshot.hospital[card.key]}</p>
            <p className="mt-1 text-xs text-slate-500">{card.hint}</p>
          </button>
        ))}
      </section>

      <section className="mt-6 rounded-xl border bg-white p-5">
        <h2 className="font-medium text-slate-900">{trendTitle}</h2>
        <p className="text-sm text-slate-500">Visits, check-ins, and new registrations over time.</p>
        <div className="mt-3">
          <TrendAreaChart points={snapshot.trend} title={trendTitle} />
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <section className="rounded-xl border bg-white p-5 lg:col-span-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-medium text-slate-900">{METRIC_LABELS[barMetric]} by department</h2>
              <p className="text-sm text-slate-500">Tap a summary card above to change this graph.</p>
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

        <section className="rounded-xl border bg-white p-5 lg:col-span-2">
          <h2 className="font-medium text-slate-900">NHIS vs private</h2>
          <p className="text-sm text-slate-500">Hospital mix for this period.</p>
          <PayerDonut nhis={snapshot.hospital.nhis} privateCount={snapshot.hospital.private} title="NHIS versus private visits" />
        </section>
      </div>

      <section className="mt-6 rounded-xl border bg-white p-5">
        <h2 className="font-medium text-slate-900">NHIS and private by department</h2>
        <p className="text-sm text-slate-500">Every clinic and service area, side by side.</p>
        <div className="mt-4">
          <StackedPayerBars rows={snapshot.departments} title="NHIS and private by department" />
        </div>
      </section>

      <section className="mt-6 rounded-xl border bg-white p-5">
        <h2 className="font-medium text-slate-900">Visits, registration, and check-ins</h2>
        <p className="text-sm text-slate-500">Grouped bars for all departments.</p>
        <GroupedBarChart rows={snapshot.departments} title="Visits, registration, and check-ins by department" />
      </section>

      <section className="mt-6">
        <h2 className="font-medium text-slate-900">Every department</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {snapshot.departments.map((row) => (
            <article key={row.id} className="rounded-xl border bg-white p-4">
              <h3 className="font-medium text-slate-900">{row.label}</h3>
              <DepartmentSpark row={row} />
            </article>
          ))}
        </div>
      </section>

      <section className="mt-8 overflow-hidden rounded-xl border bg-white">
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
    </div>
  );
}
