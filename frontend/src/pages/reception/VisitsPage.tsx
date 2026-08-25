import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCare } from '../../context/CareContext';
import { StageBadge } from '../../components/StageBadge';
import PatientIdentity from '../../components/PatientIdentity';
import { DepartmentBillsPanel } from '../../components/DepartmentControls';
import { CLINIC_LABELS } from '../../workflow/catalog';
import { copayerCoverLabel, insuranceLabel } from '../../workflow/patientAdmin';
import { canRemoveBill } from '../../workflow/billing';
import { STAGE_LABELS, STAGE_ORDER, canControlDepartment } from '../../workflow/types';

export default function VisitsPage() {
  const { user } = useAuth();
  const { state, removeFromBill } = useCare();
  const canRemove = canRemoveBill(user, user?.role === 'ADMIN' ? undefined : 'RECORDS') && canControlDepartment(user, 'RECORDS');
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const todayList = state.visits.filter((v) => new Date(v.checkedInAt) >= start);

  return (
    <div className="space-y-4">
      {canRemove && (
        <DepartmentBillsPanel department={user?.role === 'ADMIN' ? 'ALL' : 'RECORDS'} visits={state.visits} patients={state.patients} onRemove={removeFromBill} />
      )}
      <section className="desk-panel p-4">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
          <h2 className="font-semibold text-slate-900">Today</h2>
          {STAGE_ORDER.filter((stage) => stage !== 'COMPLETED').map((stage) => {
            const count = todayList.filter((item) => item.stage === stage).length;
            return (
              <p key={stage} className="text-slate-600">
                <span className="font-semibold text-slate-900">{count}</span> {STAGE_LABELS[stage].toLowerCase()}
              </p>
            );
          })}
        </div>
      </section>
      <section className="desk-panel p-5">
        <h3 className="font-medium">Visits today</h3>
        {todayList.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No visits yet today.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 text-left">
                  <th className="border-b px-3 py-2 font-semibold">Ticket</th>
                  <th className="border-b px-3 py-2 font-semibold">Patient</th>
                  <th className="border-b px-3 py-2 font-semibold">Clinic</th>
                  <th className="border-b px-3 py-2 font-semibold">Reason</th>
                  <th className="border-b px-3 py-2 font-semibold">Status</th>
                  <th className="border-b px-3 py-2 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {todayList.map((v) => {
                  const p = state.patients.find((x) => x.id === v.patientId);
                  const copayer = state.copayers?.find((c) => c.id === v.copayerId);
                  return (
                    <tr key={v.id} className="align-top">
                      <td className="border-b px-3 py-2 font-mono font-semibold text-clinic-800">{v.queueNo ?? '—'}</td>
                      <td className="border-b px-3 py-2">
                        <PatientIdentity patient={p} />
                        {p && <p className="text-xs text-slate-500">{insuranceLabel(p)}</p>}
                        {copayer && (
                          <p className="text-xs text-slate-500">
                            Co-payer: {copayer.firstName} {copayer.lastName} · {copayerCoverLabel(copayer)}
                          </p>
                        )}
                      </td>
                      <td className="border-b px-3 py-2">{CLINIC_LABELS[v.clinic ?? 'GENERAL']}</td>
                      <td className="border-b px-3 py-2">{v.reason}</td>
                      <td className="border-b px-3 py-2">
                        <StageBadge stage={v.stage} />
                        <p className="mt-1 text-xs text-slate-400">{new Date(v.checkedInAt).toLocaleTimeString()}</p>
                      </td>
                      <td className="border-b px-3 py-2">
                        {p && (
                          <div className="flex flex-col gap-1">
                            <Link to={`/care/reception/visit?patient=${p.id}`} className="text-xs font-medium text-clinic-700 hover:underline">
                              Check-in
                            </Link>
                            <Link
                              to={`/care/reception/visit?mode=bill&patient=${p.id}`}
                              className="text-xs font-medium text-clinic-700 hover:underline"
                            >
                              Bill later
                            </Link>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
