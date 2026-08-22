import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCare } from '../context/CareContext';
import { StageBadge } from '../components/StageBadge';
import PatientIdentity from '../components/PatientIdentity';
import { AddChargesPanel } from '../components/VisitChargeSummary';
import { DepartmentBillsPanel, DepartmentServicesPanel, RemoveBillButton } from '../components/DepartmentControls';
import { ordersForDepartment } from '../workflow/store';
import { CLINIC_LABELS, formatGhs } from '../workflow/catalog';
import { canControlDepartment } from '../workflow/types';
import DepartmentShiftPanel from '../components/DepartmentShiftPanel';

const EMPTY = {
  systolicBp: '',
  diastolicBp: '',
  temperatureC: '',
  pulseBpm: '',
  weightKg: '',
  heightCm: '',
  spo2: '',
};

export default function NursingPage() {
  const { user } = useAuth();
  const { state, visitsByStage, saveVitals, routeToDoctor, finishOrder, addToBill, removeFromBill, toggleService, updatePrice } =
    useCare();
  const queue = visitsByStage('CHECKED_IN');
  const ready = visitsByStage('VITALS_DONE');
  const [selectedId, setSelectedId] = useState<string | null>(queue[0]?.id ?? null);
  const [form, setForm] = useState(EMPTY);
  const selected = state.visits.find((v) => v.id === selectedId);
  const isHead = canControlDepartment(user, 'NURSING');

  function submitVitals() {
    if (!selected) return;
    saveVitals(
      selected.id,
      {
        systolicBp: Number(form.systolicBp),
        diastolicBp: Number(form.diastolicBp),
        temperatureC: Number(form.temperatureC),
        pulseBpm: Number(form.pulseBpm),
        weightKg: Number(form.weightKg),
        heightCm: Number(form.heightCm),
        spo2: Number(form.spo2),
      },
      user?.id ?? 'staff-nurse',
    );
    setForm(EMPTY);
    setSelectedId(null);
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-clinic-900">Nursing</h1>
      <DepartmentShiftPanel department="NURSING" />

      {isHead && (
        <div className="mt-6">
          <DepartmentBillsPanel department="ALL" visits={state.visits} patients={state.patients} onRemove={removeFromBill} />
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border bg-white p-5">
          <h2 className="font-medium">Waiting for vitals ({queue.length})</h2>
          <ul className="mt-3 space-y-2">
            {queue.length === 0 && <li className="text-sm text-slate-500">Queue is empty.</li>}
            {queue.map((v) => {
              const p = state.patients.find((x) => x.id === v.patientId);
              return (
                <li key={v.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(v.id)}
                    className={`w-full rounded-lg border px-3 py-2 text-left text-sm hover:bg-clinic-50 ${selectedId === v.id ? 'border-clinic-500 bg-clinic-50' : 'border-slate-100'}`}
                  >
                    <PatientIdentity patient={p} extra={` · ${p?.age}y ${p?.gender}`} />
                    <p className="mt-1 text-xs text-slate-500">
                      {CLINIC_LABELS[v.clinic ?? 'GENERAL']} · {v.reason}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="rounded-xl border bg-white p-5">
          {!selected || selected.stage !== 'CHECKED_IN' ? (
            <p className="text-sm text-slate-500">Select a patient to record vitals.</p>
          ) : (
            <>
              <h2 className="font-medium">Vitals table</h2>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {(
                  [
                    ['systolicBp', 'Systolic BP'],
                    ['diastolicBp', 'Diastolic BP'],
                    ['temperatureC', 'Temp °C'],
                    ['pulseBpm', 'Pulse'],
                    ['weightKg', 'Weight kg'],
                    ['heightCm', 'Height cm'],
                    ['spo2', 'SpO2 %'],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="text-xs text-slate-600">
                    {label}
                    <input
                      required
                      type="number"
                      step="any"
                      value={form[key]}
                      onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                      className="mt-1 w-full rounded-lg border px-2 py-1.5 text-sm"
                    />
                  </label>
                ))}
              </div>
              <button
                type="button"
                onClick={submitVitals}
                disabled={Object.values(form).some((v) => v === '')}
                className="mt-4 w-full rounded-lg bg-clinic-600 py-2 text-sm text-white disabled:opacity-50"
              >
                Save vitals
              </button>
            </>
          )}
        </section>

        <section className="lg:col-span-2 rounded-xl border bg-white p-5">
          <h2 className="font-medium">Ready for doctor ({ready.length})</h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {ready.map((v) => {
              const p = state.patients.find((x) => x.id === v.patientId);
              const flags = v.vitals?.abnormalFlags ?? [];
              return (
                <li key={v.id} className="rounded-lg border border-slate-100 p-3">
                  <div className="flex items-center justify-between">
                    <PatientIdentity patient={p} />
                    <StageBadge stage={v.stage} />
                  </div>
                  {flags.length > 0 && (
                    <p className="mt-2 text-xs font-medium text-red-700">Abnormal: {flags.join(', ')}</p>
                  )}
                  <p className="mt-1 text-xs text-slate-500">
                    BP {v.vitals?.systolicBp}/{v.vitals?.diastolicBp} · {v.vitals?.temperatureC}°C · Pulse {v.vitals?.pulseBpm} · SpO2 {v.vitals?.spo2}%
                  </p>
                  <button
                    type="button"
                    onClick={() => routeToDoctor(v.id)}
                    className="mt-3 text-sm text-clinic-600 hover:underline"
                  >
                    Send to {CLINIC_LABELS[v.clinic ?? 'GENERAL']}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <section className="mt-6 rounded-xl border bg-white p-5">
        <h2 className="font-medium">Nursing procedures</h2>
        <ul className="mt-3 space-y-2">
          {ordersForDepartment(state.visits, 'NURSING').map(({ visit, order }) => {
            const p = state.patients.find((x) => x.id === visit.patientId);
            return (
              <li key={order.id} className="rounded-lg border border-slate-100 px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <PatientIdentity patient={p} /> — {order.name} ({formatGhs(order.priceGhs)})
                  </span>
                  <span className="flex flex-wrap gap-2">
                    {isHead && order.chargeable !== false && !order.paidAt && (
                      <RemoveBillButton onClick={() => removeFromBill(visit.id, order.id)} />
                    )}
                    <button type="button" onClick={() => finishOrder(visit.id, order.id)} className="text-clinic-600 hover:underline">
                      Mark done
                    </button>
                  </span>
                </div>
                <AddChargesPanel visit={visit} department="NURSING" services={state.services} onAdd={addToBill} />
              </li>
            );
          })}
        </ul>
      </section>
      {isHead && (
        <div className="mt-6">
          <DepartmentServicesPanel
            department="NURSING"
            services={state.services}
            onToggle={toggleService}
            onPrice={updatePrice}
          />
        </div>
      )}
    </div>
  );
}
