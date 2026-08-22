import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCare } from '../../context/CareContext';
import PatientIdentity from '../../components/PatientIdentity';
import RecordSavedModal from '../../components/RecordSavedModal';
import VisitChargeSummary from '../../components/VisitChargeSummary';
import { DepartmentBillsPanel } from '../../components/DepartmentControls';
import { searchPatients } from '../../workflow/store';
import { findByHospitalNo } from '../../workflow/patientDb';
import { CLINIC_LABELS, CLINICS, DEPARTMENT_LABELS, formatGhs, getClinic } from '../../workflow/catalog';
import { insuranceLabel, isCashPrivatePatient, isStaffRelated, stayLabel, staffRelationLabel } from '../../workflow/patientAdmin';
import { canControlDepartment, type ClinicId, type Department } from '../../workflow/types';

export default function NewVisitPage() {
  const { user } = useAuth();
  const { state, checkIn, decideBilling, patientCopayers, removeFromBill } = useCare();
  const staffId = user?.id ?? 'staff-reception';
  const canRemove = canControlDepartment(user, 'RECORDS');
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(params.get('patient'));
  const [reason, setReason] = useState('');
  const [clinic, setClinic] = useState<ClinicId>('GENERAL');
  const [copayerId, setCopayerId] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [billable, setBillable] = useState(true);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [saved, setSaved] = useState<string | null>(null);

  const matches = useMemo(() => searchPatients(state.patients, query), [state.patients, query]);
  const lookup = findByHospitalNo(state.patients, query);
  const selected = state.patients.find((p) => p.id === selectedId) ?? lookup;
  const visit = state.visits.find((v) => v.patientId === selected?.id && v.stage !== 'COMPLETED');
  const copayers = selected ? patientCopayers(selected.id) : [];
  const visitClinic = getClinic(visit?.clinic);
  const relation = selected ? staffRelationLabel(selected, state.staff) : null;

  const suggested = useMemo(() => {
    if (!visit || !selected) return [];
    const ids = [selected.folderCreatedAt ? 'reg-review' : 'reg-folder', visitClinic.serviceId];
    return state.services.filter((s) => s.enabled && ids.includes(s.id));
  }, [selected, state.services, visit, visitClinic.serviceId]);

  const extrasByDept = useMemo(() => {
    const grouped = new Map<Department, typeof state.services>();
    for (const service of state.services.filter((s) => s.enabled && !suggested.some((x) => x.id === s.id))) {
      const list = grouped.get(service.department) ?? [];
      list.push(service);
      grouped.set(service.department, list);
    }
    return [...grouped.entries()];
  }, [state.services, suggested]);

  useEffect(() => {
    const fromUrl = params.get('patient');
    if (fromUrl && fromUrl !== selectedId) setSelectedId(fromUrl);
  }, [params, selectedId]);

  useEffect(() => {
    if (!selected || !visit) return;
    const related = isStaffRelated(selected);
    setBillable(visit.billable ?? !related);
    const alreadyCharged = visit.orders.filter((o) => o.chargeable !== false).map((o) => o.serviceId);
    setSelectedServices(alreadyCharged.length > 0 ? alreadyCharged : related ? [] : suggested.map((s) => s.id));
  }, [selected?.id, visit?.id]);

  function pickPatient(patientId: string) {
    setSelectedId(patientId);
    setParams({ patient: patientId });
    const primary = patientCopayers(patientId).find((c) => c.isPrimary);
    setCopayerId(primary?.id ?? '');
    setMessage(null);
  }

  function handleStartVisit() {
    if (!selected) {
      setMessage('Find the patient first.');
      return;
    }
    if (!reason.trim()) {
      setMessage('Enter why they came today.');
      return;
    }
    const active = state.visits.find((v) => v.patientId === selected.id && v.stage !== 'COMPLETED');
    const folderOnly =
      active &&
      (active.reason === 'New patient folder' ||
        active.reason === 'Open patient folder' ||
        (active.stage === 'READY_TO_BILL' &&
          active.orders.length > 0 &&
          active.orders.every((o) => o.department === 'RECORDS')));
    if (active && !folderOnly) {
      setMessage('This patient already has an open visit. Use billing on this page.');
      return;
    }
    checkIn(selected.id, reason, staffId, clinic, copayerId || undefined);
    setReason('');
    setSaved(`${selected.firstName} ${selected.lastName} assigned to ${CLINIC_LABELS[clinic]}.`);
  }

  function toggleService(id: string) {
    setSelectedServices((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  function handleSaveBill() {
    if (!visit || !selected) return;
    decideBilling(visit.id, {
      billable,
      serviceIds: billable ? selectedServices : [],
      waivedReason: billable ? undefined : relation ? `Related to worker: ${relation}` : 'Not billed',
      staffId,
    });
    setSaved(
      billable
        ? `Bill saved for ${selected.firstName} ${selected.lastName}.`
        : `${selected.firstName} ${selected.lastName} will not be billed for this visit.`,
    );
  }

  return (
    <div className="space-y-6">
      {saved && <RecordSavedModal title="Record saved" detail={saved} onClose={() => setSaved(null)} />}
      {canRemove && (
        <DepartmentBillsPanel department="ALL" visits={state.visits} patients={state.patients} onRemove={removeFromBill} />
      )}

      <section className="rounded-xl border bg-white p-5">
        <h3 className="font-medium">Find patient</h3>
        {message && <p className="mt-3 rounded-lg bg-clinic-50 px-3 py-2 text-sm text-clinic-700">{message}</p>}
        <input
          placeholder="Hospital number, name, or phone"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="mt-3 w-full rounded-lg border px-3 py-2 font-mono text-sm"
        />
        <ul className="mt-3 max-h-48 space-y-1 overflow-auto">
          {(lookup ? [lookup, ...matches.filter((p) => p.id !== lookup.id)] : matches).slice(0, 8).map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => pickPatient(p.id)}
                className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${selected?.id === p.id ? 'border-clinic-500 bg-clinic-50' : 'border-slate-100 hover:bg-slate-50'}`}
              >
                <PatientIdentity patient={p} extra={` · ${p.age}y`} />
                {isStaffRelated(p) && <span className="mt-1 block text-xs text-amber-800">Worker / relative</span>}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border bg-white p-5">
          <h3 className="font-medium">New visit</h3>
          {selected ? (
            <>
              <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <PatientIdentity patient={selected} extra={` · ${selected.age}y ${selected.gender}`} />
                <p className="mt-1 text-xs text-slate-500">DOB {selected.dateOfBirth ? new Date(selected.dateOfBirth).toLocaleDateString() : '—'} · {selected.phone}</p>
                <p className="text-xs text-slate-500">Stays: {stayLabel(selected)}</p>
                <p className="text-xs text-slate-500">{insuranceLabel(selected)}</p>
                {isStaffRelated(selected) && (
                  <p className="mt-1 text-xs font-medium text-amber-800">{staffRelationLabel(selected, state.staff)}</p>
                )}
              </div>
              {visit && (
                <p className="mt-3 rounded-lg bg-clinic-50 px-3 py-2 text-sm text-clinic-800">
                  Open visit: {CLINIC_LABELS[visit.clinic]} · {visit.reason}
                </p>
              )}
              {isCashPrivatePatient(selected) && !isStaffRelated(selected) && (
                <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  Private patient with no insurance. If you bill them, they pay cash at Accounts.
                </p>
              )}
              <label className="mt-3 block text-sm font-medium text-slate-700">Department / clinic</label>
              <select value={clinic} onChange={(e) => setClinic(e.target.value as ClinicId)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm">
                {CLINICS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
              <input
                placeholder="Reason for this visit"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="mt-3 w-full rounded-lg border px-3 py-2 text-sm"
              />
              <label className="mt-3 block text-sm font-medium text-slate-700">Co-payer for this visit</label>
              <select value={copayerId} onChange={(e) => setCopayerId(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm">
                <option value="">Patient pays</option>
                {copayers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.firstName} {c.lastName} ({c.relationship})
                  </option>
                ))}
              </select>
              <button type="button" onClick={handleStartVisit} className="mt-4 w-full rounded-lg bg-clinic-600 py-2 text-sm font-medium text-white hover:bg-clinic-700">
                Assign to {CLINIC_LABELS[clinic]}
              </button>
            </>
          ) : (
            <p className="mt-3 text-sm text-slate-500">Select a patient above.</p>
          )}
        </section>

        <section className="rounded-xl border bg-white p-5">
          <h3 className="font-medium">Billing</h3>
          {!selected && <p className="mt-3 text-sm text-slate-500">Select a patient above.</p>}
          {selected && !visit && (
            <p className="mt-3 text-sm text-slate-500">No open visit.</p>
          )}
          {selected && visit && (
            <>
              {relation && (
                <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  Related to a worker: {relation}. You may choose not to bill.
                </p>
              )}
              <fieldset className="mt-4 space-y-2">
                <legend className="text-sm font-medium text-slate-700">Bill this visit?</legend>
                <label className="flex items-start gap-2 text-sm">
                  <input type="radio" name="billable" checked={billable} onChange={() => setBillable(true)} className="mt-1" />
                  <span>Yes — add charges below</span>
                </label>
                <label className="flex items-start gap-2 text-sm">
                  <input type="radio" name="billable" checked={!billable} onChange={() => setBillable(false)} className="mt-1" />
                  <span>No — do not bill (worker or worker’s relative)</span>
                </label>
              </fieldset>
              {billable && (
                <div className="mt-4 space-y-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-clinic-700">Usual reception charges</p>
                    <ul className="mt-2 space-y-1">
                      {suggested.map((s) => (
                        <li key={s.id}>
                          <label className="flex items-center justify-between gap-2 text-sm">
                            <span className="flex items-center gap-2">
                              <input type="checkbox" checked={selectedServices.includes(s.id)} onChange={() => toggleService(s.id)} />
                              {s.name}
                            </span>
                            <span className="text-slate-500">{formatGhs(s.priceGhs)}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {extrasByDept.map(([dept, items]) => (
                    <details key={dept} className="rounded-lg border border-slate-100 px-3 py-2">
                      <summary className="cursor-pointer text-sm font-medium text-slate-700">{DEPARTMENT_LABELS[dept]}</summary>
                      <ul className="mt-2 space-y-1">
                        {items.map((s) => (
                          <li key={s.id}>
                            <label className="flex items-center justify-between gap-2 text-sm">
                              <span className="flex items-center gap-2">
                                <input type="checkbox" checked={selectedServices.includes(s.id)} onChange={() => toggleService(s.id)} />
                                {s.name}
                              </span>
                              <span className="text-slate-500">{formatGhs(s.priceGhs)}</span>
                            </label>
                          </li>
                        ))}
                      </ul>
                    </details>
                  ))}
                </div>
              )}
              <VisitChargeSummary
                visit={visit}
                showResults
                onRemoveCharge={canRemove ? (orderId) => removeFromBill(visit.id, orderId) : undefined}
              />
              <button type="button" onClick={handleSaveBill} className="mt-4 w-full rounded-lg bg-clinic-600 py-2 text-sm font-medium text-white hover:bg-clinic-700">
                {billable ? 'Save bill' : 'Save as not billed'}
              </button>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
