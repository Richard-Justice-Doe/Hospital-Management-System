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
import RecordSavedModal from '../components/RecordSavedModal';
import VitalsPad from '../components/VitalsPad';
import PatientJourneyCard from '../components/PatientJourneyCard';
import { CallNextButton } from '../components/DeskTools';
import type { PromptKind } from '../components/ActionPrompt';
import { DeskPage, PageHeader } from '../components/PageChrome';

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
  const [padKey, setPadKey] = useState<keyof typeof EMPTY>('systolicBp');
  const [prompt, setPrompt] = useState<{ kind: PromptKind; name: string; detail: string } | null>(null);
  const selected = state.visits.find((v) => v.id === selectedId);
  const isHead = canControlDepartment(user, 'NURSING');

  function patientName(visitId: string) {
    const visit = state.visits.find((item) => item.id === visitId);
    const person = state.patients.find((item) => item.id === visit?.patientId);
    return person ? `${person.firstName} ${person.lastName}` : 'Patient';
  }

  function submitVitals() {
    if (!selected) return;
    const name = patientName(selected.id);
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
    setPrompt({ kind: 'vitals', name, detail: 'Vitals are saved. When they are ready, send them to the doctor.' });
  }

  return (
    <DeskPage>
      {prompt && (
        <RecordSavedModal
          kind={prompt.kind}
          patientName={prompt.name}
          detail={prompt.detail}
          destinations={prompt.kind === 'vitals' ? ['sent_doctor'] : undefined}
          onClose={() => setPrompt(null)}
        />
      )}
      <PageHeader title="Nursing" actions={<CallNextButton />} />
      <DepartmentShiftPanel department="NURSING" />

      {isHead && (
        <div className="mt-6">
          <DepartmentBillsPanel department="NURSING" visits={state.visits} patients={state.patients} onRemove={removeFromBill} />
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="desk-panel p-5">
          <h2 className="font-medium">Waiting for vitals ({queue.length})</h2>
          <ul className="mt-3 space-y-2">
            {queue.length === 0 && (
              <li className="rounded-lg border border-dashed border-slate-200 px-3 py-8 text-center text-sm text-slate-500">
                Queue is empty. Reception will send the next walk-in here.
              </li>
            )}
            {queue.map((v) => {
              const p = state.patients.find((x) => x.id === v.patientId);
              return (
                <li key={v.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(v.id)}
                    className={`w-full rounded-lg border px-3 py-2 text-left text-sm hover:bg-clinic-50 ${selectedId === v.id ? 'border-clinic-500 bg-clinic-50' : 'border-slate-100'}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <PatientIdentity patient={p} extra={` · ${p?.age}y ${p?.gender}`} />
                      {v.queueNo ? (
                        <span className="rounded-full bg-clinic-100 px-2 py-0.5 font-mono text-xs font-semibold text-clinic-800">
                          #{v.queueNo}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {CLINIC_LABELS[v.clinic ?? 'GENERAL']} · {v.reason}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="desk-panel p-5">
          {!selected || selected.stage !== 'CHECKED_IN' ? (
            <p className="text-sm text-slate-500">Select a patient to record vitals.</p>
          ) : (
            <>
              <PatientJourneyCard patient={state.patients.find((item) => item.id === selected.patientId)} visit={selected} />
              <h2 className="mt-4 font-medium">Vitals table</h2>
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
                      onFocus={() => setPadKey(key)}
                      onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                      className="mt-1 w-full rounded-lg border px-2 py-1.5 text-sm"
                    />
                  </label>
                ))}
              </div>
              <p className="mt-3 text-xs font-semibold text-slate-500">Tap numbers for {padKey}</p>
              <VitalsPad value={form[padKey]} onChange={(next) => setForm({ ...form, [padKey]: next })} />
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

        <section className="lg:col-span-2 desk-panel p-5">
          <h2 className="font-medium">Ready for doctor ({ready.length})</h2>
          {ready.length === 0 && (
            <p className="mt-3 rounded-lg border border-dashed border-slate-200 px-3 py-8 text-center text-sm text-slate-500">
              Nobody is ready for the doctor yet. Finish vitals on the left first.
            </p>
          )}
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
                    onClick={() => {
                      const name = patientName(v.id);
                      routeToDoctor(v.id);
                      setPrompt({
                        kind: 'sent_doctor',
                        name,
                        detail: `Walk ${name} to the doctor / ${CLINIC_LABELS[v.clinic ?? 'GENERAL']}.`,
                      });
                    }}
                    className="mt-3 rounded-lg bg-clinic-600 px-4 py-2 text-sm font-medium text-white"
                  >
                    Send to doctor
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <section className="mt-6 desk-panel p-5">
        <h2 className="font-medium">Nursing procedures</h2>
        <ul className="mt-3 space-y-2">
          {ordersForDepartment(state.visits, 'NURSING').length === 0 && (
            <li className="rounded-lg border border-dashed border-slate-200 px-3 py-8 text-center text-sm text-slate-500">
              No nursing procedures in the queue.
            </li>
          )}
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
                    <button
                      type="button"
                      onClick={() => {
                        const name = patientName(visit.id);
                        finishOrder(visit.id, order.id);
                        setPrompt({ kind: 'work_done', name, detail: 'Nursing work is finished. Send them to the next desk or to pay.' });
                      }}
                      className="rounded-lg bg-clinic-600 px-3 py-1.5 text-sm font-medium text-white"
                    >
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
    </DeskPage>
  );
}
