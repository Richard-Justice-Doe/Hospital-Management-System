import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCare } from '../context/CareContext';
import { StageBadge } from '../components/StageBadge';
import PatientIdentity from '../components/PatientIdentity';
import { CLINIC_LABELS, OPD_CLINICS, DEPARTMENT_LABELS, billTotal, formatGhs } from '../workflow/catalog';
import { labResults, unreviewedLabOrders } from '../workflow/store';
import { linesFromOrder } from '../workflow/labPanels';
import { printLabReport } from '../workflow/printReceipt';
import CombinedLabSheet from '../components/CombinedLabSheet';
import VisitChargeSummary from '../components/VisitChargeSummary';
import { DepartmentBillsPanel, DepartmentServicesPanel } from '../components/DepartmentControls';
import { evaluateCds } from '../workflow/his';
import { canControlDepartment } from '../workflow/types';
import type { Department, VisitDisposition } from '../workflow/types';
import DepartmentShiftPanel from '../components/DepartmentShiftPanel';

const PICKABLE: Department[] = [
  'LAB',
  'PHARMACY',
  'RADIOLOGY',
  'PHYSIO',
  'NURSING',
  'DENTAL',
  'EYE',
  'ENT',
  'MATERNITY',
  'THEATRE',
  'WARD',
];

export default function DoctorCarePage() {
  const { user } = useAuth();
  const { state, visitsByStage, planVisit, removeFromBill, toggleService: setServiceOn, updatePrice } = useCare();
  const consultQueue = visitsByStage('WITH_DOCTOR').filter((v) => OPD_CLINICS.includes(v.clinic ?? 'GENERAL'));
  const labReview = consultQueue.filter((v) => unreviewedLabOrders(v).length > 0);
  const firstLook = consultQueue.filter((v) => unreviewedLabOrders(v).length === 0);
  const queue = [...labReview, ...firstLook];
  const [selectedId, setSelectedId] = useState<string | null>(queue[0]?.id ?? null);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [cdsOverride, setCdsOverride] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isHead = canControlDepartment(user, 'CONSULTATION');
  const [form, setForm] = useState({
    diagnosis: '',
    prescription: '',
    notes: '',
    disposition: 'DISCHARGED' as VisitDisposition,
    referredTo: '',
  });
  const selected = state.visits.find((v) => v.id === selectedId);
  const patient = state.patients.find((p) => p.id === selected?.patientId);
  const prior = state.visits.filter(
    (v) => v.patientId === selected?.patientId && v.id !== selected?.id && v.stage === 'COMPLETED',
  );
  const cds = selected ? evaluateCds(state, selected.patientId, form.prescription, selectedServices) : [];
  const enabled = state.services.filter((s) => s.enabled && PICKABLE.includes(s.department));
  const previewTotal = billTotal([
    ...(selected?.orders ?? []),
    ...enabled.filter((s) => selectedServices.includes(s.id)).map((s) => ({ priceGhs: s.priceGhs })),
  ]);

  function toggleService(id: string) {
    setSelectedServices((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  function submit() {
    if (!selected) return;
    if (cds.some((a) => a.severity === 'critical') && !cdsOverride) {
      setError('Critical allergy/interaction alert. Tick override to continue (this is audited by saving the consult).');
      return;
    }
    setError(null);
    planVisit(selected.id, { ...form, serviceIds: selectedServices, soapAssessment: form.diagnosis, soapPlan: form.notes });
    setForm({ diagnosis: '', prescription: '', notes: '', disposition: 'DISCHARGED', referredTo: '' });
    setSelectedServices([]);
    setCdsOverride(false);
    setSelectedId(null);
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-clinic-900">Doctor</h1>
      <DepartmentShiftPanel department="CONSULTATION" />

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

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <section className="rounded-xl border bg-white p-5">
          <h2 className="font-medium">Ready for consult ({queue.length})</h2>
          {labReview.length > 0 && (
            <p className="mt-1 text-xs font-medium text-clinic-700">{labReview.length} with lab results to review</p>
          )}
          <ul className="mt-3 space-y-2">
            {queue.length === 0 && <li className="text-sm text-slate-500">No patients waiting.</li>}
            {queue.map((v) => {
              const p = state.patients.find((x) => x.id === v.patientId);
              const flagged = (v.vitals?.abnormalFlags.length ?? 0) > 0;
              const labsReady = unreviewedLabOrders(v).length > 0;
              return (
                <li key={v.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(v.id);
                      setSelectedServices([]);
                      setForm({
                        diagnosis: v.diagnosis ?? '',
                        prescription: v.prescription ?? '',
                        notes: v.notes ?? '',
                        disposition: v.disposition ?? 'DISCHARGED',
                        referredTo: v.referredTo ?? '',
                      });
                    }}
                    className={`w-full rounded-lg border px-3 py-2 text-left text-sm hover:bg-clinic-50 ${selectedId === v.id ? 'border-clinic-500 bg-clinic-50' : 'border-slate-100'}`}
                  >
                    <PatientIdentity patient={p} />
                    {flagged && <span className="ml-2 text-xs text-red-600">Abnormal vitals</span>}
                    {labsReady && <span className="ml-2 text-xs font-medium text-clinic-700">Lab results ready</span>}
                    <p className="mt-1 text-xs text-slate-500">
                      {CLINIC_LABELS[v.clinic ?? 'GENERAL']} · {v.reason}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="lg:col-span-2 space-y-4">
          {!selected || !patient ? (
            <div className="rounded-xl border bg-white p-5 text-sm text-slate-500">Select a patient from the consult queue.</div>
          ) : (
            <>
              <div className="rounded-xl border bg-white p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-medium">
                      <PatientIdentity patient={patient} />
                    </h2>
                    <p className="text-sm text-slate-500">
                      {patient.age}y {patient.gender} · {patient.phone}
                    </p>
                    <p className="mt-1 text-sm text-slate-700">Chief complaint: {selected.reason}</p>
                    {state.allergies.filter((a) => a.patientId === patient.id).length > 0 && (
                      <p className="mt-2 text-sm font-medium text-red-700">
                        Allergies: {state.allergies.filter((a) => a.patientId === patient.id).map((a) => `${a.substance} (${a.reaction})`).join('; ')}
                      </p>
                    )}
                  </div>
                  <StageBadge stage={selected.stage} />
                </div>
                {selected.history && (
                  <p className="mt-3 rounded bg-slate-50 p-2 text-sm text-slate-600">History: {selected.history}</p>
                )}
                {prior.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-medium uppercase text-slate-500">Prior visits</p>
                    <ul className="mt-1 space-y-1 text-sm">
                      {prior.map((v) => (
                        <li key={v.id} className="text-slate-600">
                          {new Date(v.completedAt ?? v.checkedInAt).toLocaleDateString()} — {v.diagnosis}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {selected.vitals && (
                  <table className="mt-4 w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-left">
                        <th className="border border-slate-200 px-2 py-1 font-semibold">Vital</th>
                        <th className="border border-slate-200 px-2 py-1 font-semibold">Result</th>
                        <th className="border border-slate-200 px-2 py-1 font-semibold">Flag</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(
                        [
                          ['BP', `${selected.vitals.systolicBp}/${selected.vitals.diastolicBp}`, ['High blood pressure', 'Low blood pressure']],
                          ['Temp', `${selected.vitals.temperatureC}°C`, ['Fever', 'Hypothermia']],
                          ['Pulse', `${selected.vitals.pulseBpm}`, ['Tachycardia', 'Bradycardia']],
                          ['SpO2', `${selected.vitals.spo2}%`, ['Low SpO2']],
                        ] as const
                      ).map(([name, value, keys]) => {
                        const hit = keys.find((key) => selected.vitals?.abnormalFlags.includes(key));
                        const flag = hit?.startsWith('Low') || hit === 'Hypothermia' || hit === 'Bradycardia' ? 'L' : hit ? 'H' : '';
                        return (
                          <tr key={name}>
                            <td className="border border-slate-200 px-2 py-1">{name}</td>
                            <td className="border border-slate-200 px-2 py-1">{value}</td>
                            <td className={`border border-slate-200 px-2 py-1 font-bold ${flag ? 'text-red-600' : ''}`}>
                              {flag}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
                {(selected.vitals?.abnormalFlags.length ?? 0) > 0 && (
                  <p className="mt-2 text-sm font-medium text-red-700">
                    Flags: {selected.vitals?.abnormalFlags.join(', ')}
                  </p>
                )}
                {selected.orders.length > 0 && (
                  <VisitChargeSummary
                    visit={selected}
                    showResults
                    managedDepartment={undefined}
                    onRemoveCharge={isHead ? (orderId) => removeFromBill(selected.id, orderId) : undefined}
                  />
                )}
                {labResults(selected).length > 0 && (
                  <div className="mt-4">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-clinic-700">
                        {unreviewedLabOrders(selected).length > 0
                          ? `Lab results for further consultation (${labResults(selected).length} ${labResults(selected).length === 1 ? 'test' : 'tests'})`
                          : `Lab results (${labResults(selected).length})`}
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          printLabReport({
                            patientName: `${patient.firstName} ${patient.lastName}`,
                            hospitalNo: patient.hospitalNo,
                            clinic: CLINIC_LABELS[selected.clinic ?? 'GENERAL'],
                            diagnosis: selected.diagnosis,
                            lines: labResults(selected).flatMap((order) => [
                              { name: order.name, value: '', unit: '', flag: '', heading: true },
                              ...linesFromOrder(order),
                            ]),
                          })
                        }
                        className="text-xs font-medium text-clinic-700 hover:underline"
                      >
                        View / print table
                      </button>
                    </div>
                    <CombinedLabSheet orders={labResults(selected)} editable={false} />
                  </div>
                )}
              </div>

              <form
                className="space-y-3 rounded-xl border bg-white p-5"
                onSubmit={(e) => {
                  e.preventDefault();
                  submit();
                }}
              >
                <label className="block text-sm font-medium text-slate-700">
                  Diagnosis
                  <input
                    required
                    placeholder="e.g. Uncomplicated malaria"
                    value={form.diagnosis}
                    onChange={(e) => setForm({ ...form, diagnosis: e.target.value })}
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm font-normal"
                  />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Prescription
                  <input
                    placeholder="Adds a pharmacy fee if you type here"
                    value={form.prescription}
                    onChange={(e) => setForm({ ...form, prescription: e.target.value })}
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm font-normal"
                  />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Clinical notes
                  <textarea
                    placeholder="What you found and what happens next"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="mt-1 h-20 w-full rounded-lg border px-3 py-2 text-sm font-normal"
                  />
                </label>

                <div>
                  <p className="text-sm font-medium">Order sets</p>
                  <ul className="mt-1 flex flex-wrap gap-2">
                    {state.orderSets.map((set) => (
                      <li key={set.id}>
                        <button
                          type="button"
                          className="rounded-full border px-3 py-1 text-xs"
                          onClick={() =>
                            setSelectedServices((cur) => Array.from(new Set([...cur, ...set.serviceIds.filter((id) => enabled.some((s) => s.id === id))])))
                          }
                        >
                          {set.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
                {cds.length > 0 && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                    {cds.map((a) => (
                      <p key={a.title}>
                        {a.severity.toUpperCase()}: {a.title} — {a.detail}
                      </p>
                    ))}
                    <label className="mt-2 flex items-center gap-2">
                      <input type="checkbox" checked={cdsOverride} onChange={(e) => setCdsOverride(e.target.checked)} />
                      Override alerts (reason is the consult note)
                    </label>
                  </div>
                )}
                {error && <p className="text-sm text-red-700">{error}</p>}
                <div>
                  <p className="text-sm font-medium">Send to hospital services</p>
                  <p className="text-xs text-slate-500">Tick what this patient needs. Admin can turn items off in Services.</p>
                  <div className="mt-2 max-h-72 space-y-3 overflow-auto rounded-lg border border-slate-100 p-3">
                    {PICKABLE.map((dept) => {
                      const items = enabled.filter((s) => s.department === dept);
                      if (items.length === 0) return null;
                      return (
                        <div key={dept}>
                          <p className="text-xs font-semibold uppercase tracking-wide text-clinic-700">
                            {DEPARTMENT_LABELS[dept]}
                          </p>
                          <ul className="mt-1 space-y-1">
                            {items.map((s) => (
                              <li key={s.id}>
                                <label className="flex items-center justify-between gap-2 text-sm">
                                  <span className="flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      checked={selectedServices.includes(s.id)}
                                      onChange={() => toggleService(s.id)}
                                    />
                                    {s.name}
                                  </span>
                                  <span className="shrink-0 text-slate-500">{formatGhs(s.priceGhs)}</span>
                                </label>
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <select
                  value={form.disposition}
                  onChange={(e) => setForm({ ...form, disposition: e.target.value as VisitDisposition })}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                >
                  <option value="DISCHARGED">Plan: discharge after services & bill</option>
                  <option value="REFERRED">Refer to specialist</option>
                  <option value="ADMITTED">Admit to ward</option>
                </select>
                {form.disposition === 'REFERRED' && (
                  <input
                    required
                    placeholder="Specialist / facility"
                    value={form.referredTo}
                    onChange={(e) => setForm({ ...form, referredTo: e.target.value })}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  />
                )}
                <p className="text-sm font-medium">Estimated bill: {formatGhs(previewTotal)}</p>
                <button type="submit" className="w-full rounded-lg bg-clinic-600 py-2 text-sm text-white">
                  {unreviewedLabOrders(selected).length > 0
                    ? selectedServices.length || form.prescription
                      ? 'Record consult and send for more services'
                      : 'Record consult after lab results'
                    : selectedServices.length || form.prescription
                      ? 'Send to selected departments'
                      : 'Send to cashier for billing'}
                </button>
              </form>
            </>
          )}
        </section>
      </div>
      {isHead && (
        <div className="mt-6">
          <DepartmentServicesPanel
            department="CONSULTATION"
            services={state.services}
            onToggle={setServiceOn}
            onPrice={updatePrice}
          />
        </div>
      )}
    </div>
  );
}
