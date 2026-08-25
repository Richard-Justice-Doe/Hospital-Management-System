import { useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCare } from '../context/CareContext';
import PatientIdentity from '../components/PatientIdentity';
import RecordSavedModal from '../components/RecordSavedModal';
import VisitChargeSummary, { AddChargesPanel } from '../components/VisitChargeSummary';
import { DepartmentBillsPanel, DepartmentServicesPanel } from '../components/DepartmentControls';
import DepartmentShiftPanel from '../components/DepartmentShiftPanel';
import type { PromptKind } from '../components/ActionPrompt';
import { btnPrimary, btnSecondary, EmptyState, Field, inputClass } from './admin/adminUi';
import { updateOt } from '../workflow/his';
import { completeOrder } from '../workflow/store';
import {
  ASA_CLASSES,
  OT_STATUS_LABEL,
  OT_STATUSES,
  casesForBoard,
  preopComplete,
  staffName,
  theatreStaff,
  theatreStats,
} from '../workflow/theatre';
import { printOpNote, printOtBoard, printOtConsent } from '../workflow/printReceipt';
import type { OtCaseRecord, OtStatus } from '../workflow/types';
import { canControlDepartment } from '../workflow/types';
import { DeskPage, PageHeader } from '../components/PageChrome';

function toLocalInput(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function TheatrePage() {
  const { user } = useAuth();
  const { state, updateCare, addToBill, removeFromBill, toggleService, updatePrice } = useCare();
  const isHead = canControlDepartment(user, 'THEATRE');
  const staffId = user?.id ?? 'staff-theatre';
  const stats = useMemo(() => theatreStats(state), [state]);
  const team = useMemo(() => theatreStaff(state.staff), [state.staff]);
  const [selectedId, setSelectedId] = useState<string | null>(state.otCases[0]?.id ?? null);
  const [prompt, setPrompt] = useState<{ kind: PromptKind; name: string; detail: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const selected = state.otCases.find((row) => row.id === selectedId) ?? state.otCases[0];
  const patient = state.patients.find((item) => item.id === selected?.patientId);
  const visit = state.visits.find((item) => item.id === selected?.visitId);

  function patchCase(next: Partial<OtCaseRecord>) {
    if (!selected) return;
    updateCare((current) => updateOt(current, selected.id, next, staffId));
  }

  function setStatus(status: OtStatus) {
    if (!selected || !patient) return;
    if (status === 'IN_THEATRE' && !preopComplete(selected)) {
      setError('Finish the pre-op checklist (consent, fasting, fitness) before taking the patient in.');
      return;
    }
    setError(null);
    updateCare((current) => {
      let next = updateOt(current, selected.id, { status }, staffId);
      if (status === 'DONE') {
        const open = next.visits.find((item) => item.id === selected.visitId);
        for (const order of open?.orders ?? []) {
          if (order.department === 'THEATRE' && order.status === 'ORDERED') {
            next = completeOrder(next, selected.visitId, order.id, selected.procedure);
          }
        }
      }
      return next;
    });
    const name = `${patient.firstName} ${patient.lastName}`;
    if (status === 'IN_THEATRE') setPrompt({ kind: 'sent_theatre', name, detail: 'Take the patient into theatre now.' });
    else if (status === 'RECOVERY') setPrompt({ kind: 'work_done', name, detail: 'Surgery is finished. Take them to recovery.' });
    else if (status === 'DONE') setPrompt({ kind: 'sent_accounts', name, detail: 'Theatre is done. If they have not paid, send them to Accounts.' });
    else setPrompt({ kind: 'saved', name, detail: 'Case is back on the scheduled list.' });
  }

  return (
    <DeskPage>
      {prompt && (
        <RecordSavedModal kind={prompt.kind} patientName={prompt.name} detail={prompt.detail} onClose={() => setPrompt(null)} />
      )}
      <PageHeader
        title="Theatre / OT"
        hint="Book the list, complete pre-op, operate, then recover. Theatre adds charges; the cashier collects."
        actions={
          <button type="button" className={btnSecondary} onClick={() => printOtBoard(state.otCases, state.patients, state.staff)}>
            Print OT list
          </button>
        }
      />

      <DepartmentShiftPanel department="THEATRE" />

      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <Stat label="Scheduled" value={stats.scheduled} hint={`${stats.blocked} still missing pre-op`} />
        <Stat label="In theatre" value={stats.inTheatre} hint="Knife to skin" />
        <Stat label="Recovery" value={stats.recovery} hint="Post-op observation" />
        <Stat label="Done" value={stats.done} hint="Ready for ward or home" />
      </div>

      {isHead && (
        <div className="mt-6">
          <DepartmentBillsPanel department="THEATRE" visits={state.visits} patients={state.patients} onRemove={removeFromBill} />
        </div>
      )}

      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
        <section className="space-y-3">
          {OT_STATUSES.map((status) => {
            const rows = casesForBoard(state, status);
            return (
              <div key={status} className="desk-panel p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-clinic-700">
                  {OT_STATUS_LABEL[status]} · {rows.length}
                </p>
                {rows.length === 0 ? (
                  <p className="mt-2 text-xs text-slate-500">None</p>
                ) : (
                  <ul className="mt-2 space-y-1">
                    {rows.map((row) => {
                      const person = state.patients.find((item) => item.id === row.patientId);
                      return (
                        <li key={row.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedId(row.id)}
                            className={`w-full rounded-lg px-2 py-2 text-left text-sm ${
                              selected?.id === row.id ? 'bg-clinic-50 font-medium text-clinic-900' : 'hover:bg-slate-50'
                            }`}
                          >
                            <span className="block">{person ? `${person.firstName} ${person.lastName}` : 'Patient'}</span>
                            <span className="block text-xs text-slate-500">{row.procedure}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </section>

        {!selected || !patient ? (
          <EmptyState title="No OT cases" hint="A doctor orders a theatre service on consult. The case then appears on this board." />
        ) : (
          <section className="space-y-4 desk-panel p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <PatientIdentity patient={patient} extra={` · ${patient.age}y ${patient.gender}`} />
                <p className="mt-1 text-sm text-slate-600">{selected.procedure}</p>
                <p className="text-xs text-slate-500">
                  {OT_STATUS_LABEL[selected.status]}
                  {staffName(state.staff, selected.surgeonStaffId) ? ` · ${staffName(state.staff, selected.surgeonStaffId)}` : ''}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={btnSecondary} onClick={() => printOtConsent(patient, selected)}>
                  Print consent
                </button>
                <button type="button" className={btnSecondary} onClick={() => printOpNote(patient, selected, state.staff)}>
                  Print op note
                </button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Procedure">
                <input className={inputClass} value={selected.procedure} onChange={(e) => patchCase({ procedure: e.target.value })} />
              </Field>
              <Field label="Start">
                <input
                  type="datetime-local"
                  className={inputClass}
                  value={toLocalInput(selected.startsAt)}
                  onChange={(e) => patchCase({ startsAt: new Date(e.target.value).toISOString() })}
                />
              </Field>
              <Field label="Duration (minutes)">
                <input
                  type="number"
                  min={10}
                  className={inputClass}
                  value={selected.durationMin ?? 30}
                  onChange={(e) => patchCase({ durationMin: Number(e.target.value) || 30 })}
                />
              </Field>
              <Field label="OT table">
                <select className={inputClass} value={selected.otBedId} onChange={(e) => patchCase({ otBedId: e.target.value })}>
                  {state.beds
                    .filter((bed) => bed.ward === 'OT')
                    .map((bed) => (
                      <option key={bed.id} value={bed.id}>
                        {bed.label} · {bed.status}
                      </option>
                    ))}
                </select>
              </Field>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-clinic-700">Surgical team</p>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <StaffPick label="Surgeon" value={selected.surgeonStaffId} team={team} onChange={(id) => patchCase({ surgeonStaffId: id })} />
                <StaffPick label="Assistant" value={selected.assistantStaffId} team={team} onChange={(id) => patchCase({ assistantStaffId: id })} />
                <StaffPick label="Anaesthetist" value={selected.anaesthetistStaffId} team={team} onChange={(id) => patchCase({ anaesthetistStaffId: id })} />
                <StaffPick label="Scrub nurse" value={selected.scrubNurseStaffId} team={team} onChange={(id) => patchCase({ scrubNurseStaffId: id })} />
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-clinic-700">Pre-op checklist</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                <Check label="Consent signed" checked={Boolean(selected.consentGiven)} onChange={(on) => patchCase({ consentGiven: on })} />
                <Check label="Fasting confirmed" checked={Boolean(selected.fastingOk)} onChange={(on) => patchCase({ fastingOk: on })} />
                <Check label="Fitness / clearance" checked={Boolean(selected.fitnessOk)} onChange={(on) => patchCase({ fitnessOk: on })} />
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {preopComplete(selected) ? 'Pre-op complete. Patient may go in.' : 'All three boxes must be ticked before IN THEATRE.'}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Anaesthesia">
                <input
                  className={inputClass}
                  value={selected.anesthesia}
                  placeholder="e.g. LA, spinal, GA"
                  onChange={(e) => patchCase({ anesthesia: e.target.value })}
                />
              </Field>
              <Field label="ASA class">
                <select className={inputClass} value={selected.asaClass ?? 'I'} onChange={(e) => patchCase({ asaClass: e.target.value })}>
                  {ASA_CLASSES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Findings">
                <textarea className={inputClass} rows={2} value={selected.findings ?? ''} onChange={(e) => patchCase({ findings: e.target.value })} />
              </Field>
              <Field label="Complications">
                <textarea className={inputClass} rows={2} value={selected.complications ?? ''} onChange={(e) => patchCase({ complications: e.target.value })} />
              </Field>
            </div>
            <Field label="Intra-op notes">
              <textarea className={inputClass} rows={3} value={selected.surgicalNotes} onChange={(e) => patchCase({ surgicalNotes: e.target.value })} />
            </Field>
            <Field label="Recovery notes">
              <textarea className={inputClass} rows={2} value={selected.recoveryNotes ?? ''} onChange={(e) => patchCase({ recoveryNotes: e.target.value })} />
            </Field>

            <div className="flex flex-wrap gap-2">
              {OT_STATUSES.map((status) => (
                <button
                  key={status}
                  type="button"
                  className={selected.status === status ? btnPrimary : btnSecondary}
                  onClick={() => setStatus(status)}
                >
                  {OT_STATUS_LABEL[status]}
                </button>
              ))}
            </div>

            {visit && (
              <>
                <VisitChargeSummary
                  visit={visit}
                  managedDepartment="THEATRE"
                  onRemoveCharge={isHead ? (orderId) => removeFromBill(visit.id, orderId) : undefined}
                />
                <AddChargesPanel visit={visit} department="THEATRE" services={state.services} onAdd={addToBill} />
                <p className="text-xs text-slate-500">Add theatre time, consumables, or an implant to the visit bill. Cash stays with the cashier.</p>
              </>
            )}
          </section>
        )}
      </div>

      {isHead && (
        <div className="mt-6">
          <DepartmentServicesPanel department="THEATRE" services={state.services} onToggle={toggleService} onPrice={updatePrice} />
        </div>
      )}
    </DeskPage>
  );
}

function Stat({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <article className="desk-panel p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-clinic-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </article>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (on: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function StaffPick({
  label,
  value,
  team,
  onChange,
}: {
  label: string;
  value?: string;
  team: ReturnType<typeof theatreStaff>;
  onChange: (id: string) => void;
}) {
  return (
    <Field label={label}>
      <select className={inputClass} value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
        <option value="">Not assigned</option>
        {team.map((person) => (
          <option key={person.id} value={person.id}>
            {person.firstName} {person.lastName}
          </option>
        ))}
      </select>
    </Field>
  );
}
