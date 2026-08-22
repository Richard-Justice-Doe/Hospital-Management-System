import { useAuth } from '../context/AuthContext';
import { useCare } from '../context/CareContext';
import PatientIdentity from '../components/PatientIdentity';
import { StageBadge } from '../components/StageBadge';
import VisitChargeSummary, { AddChargesPanel } from '../components/VisitChargeSummary';
import { DepartmentBillsPanel, DepartmentServicesPanel, RemoveBillButton } from '../components/DepartmentControls';
import { formatGhs } from '../workflow/catalog';
import { ordersForDepartment } from '../workflow/store';
import { canControlDepartment, type Department } from '../workflow/types';
import DepartmentShiftPanel from '../components/DepartmentShiftPanel';

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

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-clinic-900">{title}</h1>
      <DepartmentShiftPanel department={department} />

      {isHead && (
        <div className="mt-6">
          <DepartmentBillsPanel
            department="ALL"
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
                        managedDepartment={undefined}
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
                          onClick={() => finishOrder(visit.id, order.id, 'Completed')}
                          className="rounded-lg bg-clinic-600 px-4 py-1.5 text-sm text-white"
                        >
                          Mark done
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
