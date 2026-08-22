import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCare } from '../../context/CareContext';
import { StageBadge } from '../../components/StageBadge';
import PatientIdentity from '../../components/PatientIdentity';
import VisitChargeSummary from '../../components/VisitChargeSummary';
import { DepartmentBillsPanel } from '../../components/DepartmentControls';
import { CLINIC_LABELS } from '../../workflow/catalog';
import { insuranceLabel } from '../../workflow/patientAdmin';
import { canControlDepartment } from '../../workflow/types';

export default function VisitsPage() {
  const { user } = useAuth();
  const { state, removeFromBill } = useCare();
  const canRemove = canControlDepartment(user, 'RECORDS');
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const todayList = state.visits.filter((v) => new Date(v.checkedInAt) >= start);

  return (
    <div className="space-y-5">
      {canRemove && (
        <DepartmentBillsPanel department="ALL" visits={state.visits} patients={state.patients} onRemove={removeFromBill} />
      )}
      <section className="rounded-xl border bg-white p-5">
        <h3 className="font-medium">Visits today</h3>
        {todayList.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No visits yet today.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 text-left">
                  <th className="border border-slate-200 px-3 py-2 font-semibold">Patient</th>
                  <th className="border border-slate-200 px-3 py-2 font-semibold">Clinic</th>
                  <th className="border border-slate-200 px-3 py-2 font-semibold">Reason</th>
                  <th className="border border-slate-200 px-3 py-2 font-semibold">Status</th>
                  <th className="border border-slate-200 px-3 py-2 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {todayList.map((v) => {
                  const p = state.patients.find((x) => x.id === v.patientId);
                  const copayer = state.copayers?.find((c) => c.id === v.copayerId);
                  return (
                    <tr key={v.id} className="align-top">
                      <td className="border border-slate-200 px-3 py-2">
                        <PatientIdentity patient={p} />
                        {p && <p className="text-xs text-slate-500">{insuranceLabel(p)}</p>}
                        {copayer && (
                          <p className="text-xs text-slate-500">
                            Co-payer: {copayer.firstName} {copayer.lastName}
                          </p>
                        )}
                      </td>
                      <td className="border border-slate-200 px-3 py-2">{CLINIC_LABELS[v.clinic ?? 'GENERAL']}</td>
                      <td className="border border-slate-200 px-3 py-2">
                        {v.reason}
                        <VisitChargeSummary
                          visit={v}
                          showResults
                          onRemoveCharge={canRemove ? (orderId) => removeFromBill(v.id, orderId) : undefined}
                        />
                      </td>
                      <td className="border border-slate-200 px-3 py-2">
                        <StageBadge stage={v.stage} />
                        <p className="mt-1 text-xs text-slate-400">{new Date(v.checkedInAt).toLocaleTimeString()}</p>
                      </td>
                      <td className="border border-slate-200 px-3 py-2">
                        {p && (
                          <Link to={`/care/reception/visit?patient=${p.id}`} className="text-xs font-medium text-clinic-700 hover:underline">
                            New visit & billing
                          </Link>
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
