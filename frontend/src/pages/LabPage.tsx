import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCare } from '../context/CareContext';
import PatientIdentity from '../components/PatientIdentity';
import { StageBadge } from '../components/StageBadge';
import VisitChargeSummary, { AddChargesPanel } from '../components/VisitChargeSummary';
import CombinedLabSheet from '../components/CombinedLabSheet';
import { DepartmentBillsPanel, DepartmentServicesPanel } from '../components/DepartmentControls';
import { linesFromValues, panelFor, summarizeLabLines } from '../workflow/labPanels';
import { groupOrdersByVisit, ordersForDepartment } from '../workflow/store';
import { canControlDepartment } from '../workflow/types';
import type { LabLine, ServiceOrder } from '../workflow/types';
import DepartmentShiftPanel from '../components/DepartmentShiftPanel';

export default function LabPage() {
  const { user } = useAuth();
  const { state, finishOrders, addToBill, removeFromBill, toggleService, updatePrice } = useCare();
  const groups = groupOrdersByVisit(ordersForDepartment(state.visits, 'LAB'));
  const [valuesByOrder, setValuesByOrder] = useState<Record<string, Record<string, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const isHead = canControlDepartment(user, 'LAB');

  function filledUpdate(order: ServiceOrder) {
    const defs = panelFor(order.serviceId, order.name);
    const values = valuesByOrder[order.id] ?? {};
    const labLines = linesFromValues(defs, values);
    const result = summarizeLabLines(labLines);
    if (!result) return null;
    return { orderId: order.id, result, labLines };
  }

  function send(visitId: string, pending: ServiceOrder[], mode: 'one' | 'all', orderId?: string) {
    const targets = mode === 'one' ? pending.filter((order) => order.id === orderId) : pending;
    const updates = targets
      .map(filledUpdate)
      .filter((item): item is { orderId: string; result: string; labLines: LabLine[] } => Boolean(item));
    if (updates.length === 0) {
      setError(
        mode === 'all'
          ? 'Fill at least one result in the table, then send the filled checks.'
          : 'Fill at least one result for this check, then send it.',
      );
      return;
    }
    setError(null);
    finishOrders(visitId, updates);
    setValuesByOrder((current) => {
      const next = { ...current };
      for (const update of updates) delete next[update.orderId];
      return next;
    });
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-clinic-900">Laboratory</h1>
      <DepartmentShiftPanel department="LAB" />
      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {isHead && (
        <div className="mt-6">
          <DepartmentBillsPanel department="ALL" visits={state.visits} patients={state.patients} onRemove={removeFromBill} />
        </div>
      )}

      <ul className="mt-6 space-y-4">
        {groups.length === 0 && (
          <li className="rounded-xl border bg-white p-5 text-sm text-slate-500">No pending lab tests.</li>
        )}
        {groups.map(({ visit, orders: pending }) => {
          const patient = state.patients.find((item) => item.id === visit.patientId);
          const labOrders = visit.orders.filter((order) => order.department === 'LAB');
          return (
            <li key={visit.id} className="rounded-xl border bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p>
                    <PatientIdentity patient={patient} />
                  </p>
                  <p className="text-sm font-medium text-slate-800">
                    {labOrders.length} lab {labOrders.length === 1 ? 'check' : 'checks'} · {pending.length} still being checked
                  </p>
                  <p className="text-xs text-slate-500">{visit.diagnosis ?? visit.reason}</p>
                </div>
                <StageBadge stage={visit.stage} />
              </div>

              <VisitChargeSummary
                visit={visit}
                showResults
                managedDepartment={undefined}
                onRemoveCharge={isHead ? (orderId) => removeFromBill(visit.id, orderId) : undefined}
              />

              <div className="mt-5">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-clinic-700">Enter results while checks are running</p>
                <CombinedLabSheet
                  orders={labOrders}
                  valuesByOrder={valuesByOrder}
                  onChange={(orderId, id, value) =>
                    setValuesByOrder((current) => ({
                      ...current,
                      [orderId]: { ...(current[orderId] ?? {}), [id]: value },
                    }))
                  }
                  onSendOne={(orderId) => send(visit.id, pending, 'one', orderId)}
                />
              </div>

              <button
                type="button"
                onClick={() => send(visit.id, pending, 'all')}
                className="mt-4 rounded-lg bg-clinic-600 px-4 py-1.5 text-sm text-white"
              >
                Send filled checks to doctor
              </button>
              <AddChargesPanel visit={visit} department="LAB" services={state.services} onAdd={addToBill} />
            </li>
          );
        })}
      </ul>
      {isHead && (
        <div className="mt-6">
          <DepartmentServicesPanel
            department="LAB"
            services={state.services}
            onToggle={toggleService}
            onPrice={updatePrice}
          />
        </div>
      )}
    </div>
  );
}
