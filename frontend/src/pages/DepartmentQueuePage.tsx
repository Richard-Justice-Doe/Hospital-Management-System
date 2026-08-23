import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCare } from '../context/CareContext';
import PatientIdentity from '../components/PatientIdentity';
import { StageBadge } from '../components/StageBadge';
import VisitChargeSummary, { AddChargesPanel } from '../components/VisitChargeSummary';
import { DepartmentBillsPanel, DepartmentServicesPanel, RemoveBillButton } from '../components/DepartmentControls';
import { DEPARTMENT_LABELS, formatGhs } from '../workflow/catalog';
import { ordersForDepartment } from '../workflow/store';
import { canControlDepartment, type Department } from '../workflow/types';
import DepartmentShiftPanel from '../components/DepartmentShiftPanel';
import RecordSavedModal from '../components/RecordSavedModal';
import type { PromptKind } from '../components/ActionPrompt';

const AFTER_WORK: Record<Department, { kind: PromptKind; detail: string }> = {
  RECORDS: { kind: 'sent_nursing', detail: 'Folder work is finished. Take them to nursing.' },
  CONSULTATION: { kind: 'sent_accounts', detail: 'Consult is finished. Send them to pay.' },
  NURSING: { kind: 'sent_accounts', detail: 'Nursing work is finished. Send them to the next desk or to pay.' },
  LAB: { kind: 'sent_doctor', detail: 'Lab work is finished. Tell the doctor they are ready.' },
  PHARMACY: { kind: 'sent_accounts', detail: 'Medicine is ready. If they have not paid, send them to Accounts.' },
  RADIOLOGY: { kind: 'sent_doctor', detail: 'X-ray is finished. Send them back to the doctor.' },
  PHYSIO: { kind: 'sent_accounts', detail: 'Physiotherapy is finished. Send them to pay if they have not paid.' },
  DENTAL: { kind: 'sent_accounts', detail: 'Dental work is finished. Send them to pay if they have not paid.' },
  EYE: { kind: 'sent_accounts', detail: 'Eye clinic work is finished. Send them to pay if they have not paid.' },
  ENT: { kind: 'sent_accounts', detail: 'ENT work is finished. Send them to pay if they have not paid.' },
  MATERNITY: { kind: 'sent_accounts', detail: 'Maternity work is finished. Send them to pay if they have not paid.' },
  THEATRE: { kind: 'work_done', detail: 'Theatre work is finished. Take them to recovery or the ward.' },
  WARD: { kind: 'work_done', detail: 'Ward work is finished.' },
  CLAIMS: { kind: 'work_done', detail: 'Claim work is finished.' },
  STORES: { kind: 'work_done', detail: 'Store issue is finished.' },
  PROCUREMENT: { kind: 'work_done', detail: 'Purchase request is saved.' },
  IT: { kind: 'work_done', detail: 'IT support work is finished.' },
};

export default function DepartmentQueuePage({
  department,
  title,
}: {
  department: Department;
  title: string;
}) {
  const { user } = useAuth();
  const { state, finishOrder, addToBill, removeFromBill, toggleService, updatePrice } = useCare();
  const queue = ordersForDepartment(state.visits, department);
  const isHead = canControlDepartment(user, department);
  const [prompt, setPrompt] = useState<{ kind: PromptKind; name: string; detail: string } | null>(null);

  return (
    <div className="p-6">
      {prompt && (
        <RecordSavedModal
          kind={prompt.kind}
          patientName={prompt.name}
          detail={prompt.detail}
          onClose={() => setPrompt(null)}
        />
      )}
      <h1 className="text-xl font-semibold text-clinic-900">{title}</h1>
      <DepartmentShiftPanel department={department} />

      {isHead && (
        <div className="mt-6">
          <DepartmentBillsPanel
            department={department}
            visits={state.visits}
            patients={state.patients}
            onRemove={removeFromBill}
          />
        </div>
      )}

      <div className={`${isHead ? 'mt-5' : 'mt-6'} overflow-x-auto rounded-xl border bg-white`}>
        {queue.length === 0 ? (
          <p className="p-5 text-sm text-slate-500">No pending work in this department.</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="border-b px-4 py-2 font-semibold">Patient</th>
                <th className="border-b px-4 py-2 font-semibold">Work</th>
                <th className="border-b px-4 py-2 font-semibold">Status</th>
                <th className="border-b px-4 py-2 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {queue.map(({ visit, order }) => {
                const p = state.patients.find((x) => x.id === visit.patientId);
                return (
                  <tr key={order.id} className="align-top">
                    <td className="border-b px-4 py-3">
                      <PatientIdentity patient={p} />
                      <p className="mt-1 text-xs text-slate-500">{visit.diagnosis ?? visit.reason}</p>
                    </td>
                    <td className="border-b px-4 py-3">
                      <p className="font-medium">{order.name}</p>
                      <p className="text-xs text-slate-500">
                        {order.chargeable === false ? 'Not billed yet' : `Billed ${formatGhs(order.priceGhs)}`}
                      </p>
                      {visit.prescription && department === 'PHARMACY' && (
                        <p className="mt-2 rounded bg-slate-50 px-2 py-1 text-xs">{visit.prescription}</p>
                      )}
                      <AddChargesPanel visit={visit} department={department} services={state.services} onAdd={addToBill} />
                      <VisitChargeSummary
                        visit={visit}
                        showResults
                        managedDepartment={department}
                        onRemoveCharge={isHead ? (orderId) => removeFromBill(visit.id, orderId) : undefined}
                      />
                    </td>
                    <td className="border-b px-4 py-3">
                      <StageBadge stage={visit.stage} />
                    </td>
                    <td className="border-b px-4 py-3">
                      <div className="flex flex-col gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const name = p ? `${p.firstName} ${p.lastName}` : 'Patient';
                            finishOrder(visit.id, order.id, 'Completed');
                            const after = AFTER_WORK[department];
                            setPrompt({
                              kind: after.kind,
                              name,
                              detail: `${DEPARTMENT_LABELS[department]}: ${after.detail}`,
                            });
                          }}
                          className="rounded-lg bg-clinic-600 px-4 py-2 text-sm font-medium text-white"
                        >
                          Work done — send to pay
                        </button>
                        {isHead && order.chargeable !== false && !order.paidAt && (
                          <RemoveBillButton onClick={() => removeFromBill(visit.id, order.id)} />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {isHead && (
        <div className="mt-6">
          <DepartmentServicesPanel
            department={department}
            services={state.services}
            onToggle={toggleService}
            onPrice={updatePrice}
          />
        </div>
      )}
    </div>
  );
}
