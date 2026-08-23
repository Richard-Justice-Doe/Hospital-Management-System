import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCare } from '../../context/CareContext';
import PatientIdentity from '../../components/PatientIdentity';
import RecordSavedModal from '../../components/RecordSavedModal';
import VisitChargeSummary from '../../components/VisitChargeSummary';
import { DepartmentBillsPanel } from '../../components/DepartmentControls';
import { applyVisitBilling, checkInExisting, searchPatients, setVisitCcCode } from '../../workflow/store';
import PatientJourneyCard from '../../components/PatientJourneyCard';
import { printQueueTicket } from '../../workflow/printReceipt';
import { findByHospitalNo } from '../../workflow/patientDb';
import { CLINIC_LABELS, CLINICS, DEPARTMENT_LABELS, formatGhs, getClinic } from '../../workflow/catalog';
import { hasGhanaNhiss, insuranceLabel, isCashPrivatePatient, isStaffRelated, stayLabel, staffRelationLabel, visitMissingRequiredCc } from '../../workflow/patientAdmin';
import { canRemoveBill } from '../../workflow/billing';
import { canControlDepartment, type ClinicId, type Department, type HospitalService, type PatientRecord, type VisitRecord } from '../../workflow/types';

function ServicePickList({
  suggested,
  extrasByDept,
  selectedServices,
  onToggle,
}: {
  suggested: HospitalService[];
  extrasByDept: Array<[Department, HospitalService[]]>;
  selectedServices: string[];
  onToggle: (id: string) => void;
}) {
  const groups: Array<{ label: string; items: HospitalService[] }> = [
    ...(suggested.length > 0 ? [{ label: 'Usual charges', items: suggested }] : []),
    ...extrasByDept.map(([dept, items]) => ({ label: DEPARTMENT_LABELS[dept], items })),
  ];
  const byId = new Map(groups.flatMap((group) => group.items.map((item) => [item.id, item])));
  const chosen = selectedServices.map((id) => byId.get(id)).filter((item): item is HospitalService => Boolean(item));

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-slate-700">
        Services
        <select
          value=""
          onChange={(e) => {
            if (e.target.value && !selectedServices.includes(e.target.value)) onToggle(e.target.value);
          }}
          className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm"
        >
          <option value="">Choose a service…</option>
          {groups.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.items.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name} — {formatGhs(service.priceGhs)}
                  {selectedServices.includes(service.id) ? ' ✓' : ''}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      {chosen.length > 0 && (
        <ul className="space-y-1">
          {chosen.map((service) => (
            <li key={service.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
              <span>
                {service.name} <span className="text-slate-500">{formatGhs(service.priceGhs)}</span>
              </span>
              <button type="button" onClick={() => onToggle(service.id)} className="text-xs font-semibold text-slate-600 hover:text-red-700">
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

async function pasteText() {
  try {
    return (await navigator.clipboard.readText()).trim();
  } catch {
    return '';
  }
}

function needsBill(visit: VisitRecord) {
  return visit.stage !== 'COMPLETED' && !visit.billingDecidedAt;
}

function CcCodeField({
  value,
  onChange,
  onSave,
}: {
  value: string;
  onChange: (value: string) => void;
  onSave?: () => void;
}) {
  return (
    <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
      <label className="block text-sm font-medium text-slate-700">
        CC code <span className="text-red-600">*</span>
        <input
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Required for NHIS / Ghana Card"
          className="mt-1 w-full rounded-xl border px-3 py-2 font-mono"
        />
      </label>
      <p className="mt-2 text-xs text-emerald-900">Required for every NHIS and Ghana Card patient before check-in or billing.</p>
      {onSave && value.trim() && (
        <button type="button" className="mt-2 w-full rounded-lg border bg-white py-2 text-sm font-semibold" onClick={onSave}>
          Save CC code
        </button>
      )}
    </div>
  );
}

export default function NewVisitPage() {
  const { user } = useAuth();
  const { state, updateCare, patientCopayers, removeFromBill } = useCare();
  const staffId = user?.id ?? 'staff-reception';
  const canRemove = canRemoveBill(user, user?.role === 'ADMIN' ? undefined : 'RECORDS') && canControlDepartment(user, 'RECORDS');
  const [params, setParams] = useSearchParams();
  const billLater = params.get('mode') === 'bill';
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(params.get('patient'));
  const [reason, setReason] = useState('');
  const [clinic, setClinic] = useState<ClinicId>('GENERAL');
  const [copayerId, setCopayerId] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [billable, setBillable] = useState(true);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [saved, setSaved] = useState<{ name: string; visit: VisitRecord; patient: PatientRecord } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [ccCode, setCcCode] = useState('');

  const matches = useMemo(() => searchPatients(state.patients, query), [state.patients, query]);
  const lookup = findByHospitalNo(state.patients, query);
  const selected = state.patients.find((p) => p.id === selectedId) ?? lookup;
  const visit = state.visits.find((v) => v.patientId === selected?.id && v.stage !== 'COMPLETED');
  const copayers = selected ? patientCopayers(selected.id) : [];
  const visitClinic = getClinic(visit?.clinic ?? clinic);
  const relation = selected ? staffRelationLabel(selected, state.staff) : null;

  const suggested = useMemo(() => {
    if (!selected) return [];
    const ids = [selected.folderCreatedAt ? 'reg-review' : 'reg-folder', visitClinic.serviceId];
    return state.services.filter((s) => s.enabled && ids.includes(s.id));
  }, [selected, state.services, visitClinic.serviceId]);

  const extrasByDept = useMemo(() => {
    const grouped = new Map<Department, typeof state.services>();
    for (const service of state.services.filter((s) => s.enabled && !suggested.some((x) => x.id === s.id))) {
      const list = grouped.get(service.department) ?? [];
      list.push(service);
      grouped.set(service.department, list);
    }
    return [...grouped.entries()];
  }, [state.services, suggested]);

  const unbilled = useMemo(
    () =>
      state.visits
        .filter(needsBill)
        .map((open) => ({ visit: open, patient: state.patients.find((p) => p.id === open.patientId) }))
        .filter((row) => row.patient),
    [state.patients, state.visits],
  );

  useEffect(() => {
    const fromUrl = params.get('patient');
    if (fromUrl && fromUrl !== selectedId) setSelectedId(fromUrl);
  }, [params, selectedId]);

  useEffect(() => {
    if (!selected) return;
    const related = isStaffRelated(selected);
    if (visit) {
      setBillable(visit.billable ?? !related);
      const alreadyCharged = visit.orders.filter((o) => o.chargeable !== false).map((o) => o.serviceId);
      setSelectedServices(alreadyCharged.length > 0 ? alreadyCharged : related ? [] : suggested.map((s) => s.id));
      return;
    }
    setBillable(!related);
    setSelectedServices(related ? [] : suggested.map((s) => s.id));
  }, [selected?.id, visit?.id, suggested]);

  useEffect(() => {
    if (visit?.nhisCcCode) setCcCode(visit.nhisCcCode);
  }, [visit?.id, visit?.nhisCcCode]);

  function pickPatient(patientId: string) {
    setSelectedId(patientId);
    const next = new URLSearchParams(params);
    next.set('patient', patientId);
    setParams(next);
    const primary = patientCopayers(patientId).find((c) => c.isPrimary);
    setCopayerId(primary?.id ?? '');
    setCcCode('');
    setMessage(null);
  }

  function setMode(mode: 'checkin' | 'bill') {
    const next = new URLSearchParams(params);
    if (mode === 'bill') next.set('mode', 'bill');
    else next.delete('mode');
    setParams(next);
    setMessage(null);
  }

  function clearDesk() {
    setSelectedId(null);
    setQuery('');
    setReason('');
    setClinic('GENERAL');
    setCopayerId('');
    setMessage(null);
    setSelectedServices([]);
    setBillable(true);
    setCcCode('');
    const next = new URLSearchParams();
    setParams(next);
  }

  function toggleService(id: string) {
    setSelectedServices((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  async function handleCopy(folderNo: string) {
    const ok = await copyText(folderNo);
    if (ok) {
      setCopied(folderNo);
      window.setTimeout(() => setCopied(null), 1600);
    }
  }

  async function handlePasteFolder() {
    const text = await pasteText();
    if (!text) {
      setMessage('Paste the folder number into the box, then tap Find.');
      return;
    }
    setQuery(text);
    const found = findByHospitalNo(state.patients, text);
    if (found) pickPatient(found.id);
    else setMessage('No folder matches that number.');
  }

  function findByFolder() {
    if (!query.trim()) {
      setMessage('Type or paste the folder number first.');
      return;
    }
    const found = findByHospitalNo(state.patients, query) ?? searchPatients(state.patients, query)[0];
    if (!found) {
      setMessage('No folder matches that number.');
      return;
    }
    pickPatient(found.id);
    if (!state.visits.some((v) => v.patientId === found.id && v.stage !== 'COMPLETED')) {
      setMessage('This folder has no open visit. Use Check-in & bill first, or tap Check in below.');
    }
  }

  function handleStartVisit(withBill: boolean) {
    if (!selected) {
      setMessage('Find the patient first.');
      return;
    }
    if (!reason.trim()) {
      setMessage('Enter why they came today.');
      return;
    }
    if (visitMissingRequiredCc(selected, visit, ccCode)) {
      setMessage('Enter the CC code. It is required for every NHIS and Ghana Card patient.');
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
      setMessage('This patient already has an open visit. Use the billing side.');
      return;
    }
    let opened: VisitRecord | undefined;
    updateCare((current) => {
      let after = checkInExisting(current, selected.id, reason, staffId, clinic, copayerId || undefined, ccCode);
      const open = after.visits.find((v) => v.patientId === selected.id && v.stage !== 'COMPLETED');
      opened = open;
      if (open && ccCode.trim()) after = setVisitCcCode(after, open.id, ccCode);
      if (!withBill) return after;
      if (!open) return after;
      return applyVisitBilling(after, open.id, {
        billable,
        serviceIds: billable ? selectedServices : [],
        waivedReason: billable ? undefined : relation ? `Related to worker: ${relation}` : 'Not billed',
        staffId,
      });
    });
    setReason('');
    if (opened) setSaved({ name: `${selected.firstName} ${selected.lastName}`, visit: opened, patient: selected });
    if (withBill) clearDesk();
  }

  function handleSaveBill() {
    if (!visit || !selected) return;
    if (visitMissingRequiredCc(selected, visit, ccCode)) {
      setMessage('Enter the CC code. It is required for every NHIS and Ghana Card patient.');
      return;
    }
    updateCare((current) => {
      const after = ccCode.trim() ? setVisitCcCode(current, visit.id, ccCode) : current;
      return applyVisitBilling(after, visit.id, {
        billable,
        serviceIds: billable ? selectedServices : [],
        waivedReason: billable ? undefined : relation ? `Related to worker: ${relation}` : 'Not billed',
        staffId,
      });
    });
    setSaved({ name: `${selected.firstName} ${selected.lastName}`, visit, patient: selected });
    clearDesk();
  }

  return (
    <div className="space-y-6">
      {saved && (
        <RecordSavedModal
          kind="checked_in"
          patientName={saved.name}
          detail={
            saved.visit.queueNo
              ? `Queue ticket ${saved.visit.queueNo}. Send them to Nursing with the printed ticket.`
              : 'Visit is open. Print a queue ticket for Nursing.'
          }
          nextLabel="Print queue ticket"
          onNext={() => printQueueTicket(saved.patient, saved.visit)}
          onClose={() => setSaved(null)}
        />
      )}
      {canRemove && (
        <DepartmentBillsPanel department={user?.role === 'ADMIN' ? 'ALL' : 'RECORDS'} visits={state.visits} patients={state.patients} onRemove={removeFromBill} />
      )}

      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => setMode('checkin')}
          className={`rounded-xl px-4 py-3 text-sm font-semibold ${!billLater ? 'bg-white text-clinic-800 shadow' : 'text-slate-600'}`}
        >
          🚪 Check in
        </button>
        <button
          type="button"
          onClick={() => setMode('bill')}
          className={`rounded-xl px-4 py-3 text-sm font-semibold ${billLater ? 'bg-white text-clinic-800 shadow' : 'text-slate-600'}`}
        >
          🧾 Bill later
        </button>
      </div>

      {message && <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">{message}</p>}

      {billLater ? (
        <section className="rounded-2xl border-2 border-amber-200 bg-white p-5">
          <h3 className="text-lg font-semibold text-slate-900">Forgot to bill?</h3>
          <p className="mt-1 text-sm text-slate-600">Paste or type the folder number, then add the same services on the billing side.</p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              placeholder="Folder number, e.g. A1/2026"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-xl border px-4 py-3 font-mono text-base"
            />
            <button type="button" onClick={() => void handlePasteFolder()} className="rounded-xl border px-4 py-3 text-sm font-semibold hover:bg-slate-50">
              Paste
            </button>
            <button type="button" onClick={findByFolder} className="rounded-xl bg-clinic-600 px-5 py-3 text-sm font-semibold text-white hover:bg-clinic-700">
              Find
            </button>
          </div>
          {unbilled.length > 0 && (
            <div className="mt-5">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Open visits not billed yet</p>
              <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                {unbilled.map(({ visit: open, patient }) => (
                  <li key={open.id} className="rounded-xl border p-3">
                    <PatientIdentity patient={patient} extra={` · ${CLINIC_LABELS[open.clinic ?? 'GENERAL']}`} />
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void handleCopy(patient!.hospitalNo)}
                        className="rounded-lg border px-3 py-2 text-xs font-semibold"
                      >
                        {copied === patient!.hospitalNo ? 'Copied' : 'Copy folder'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setQuery(patient!.hospitalNo);
                          pickPatient(patient!.id);
                        }}
                        className="rounded-lg bg-clinic-600 px-3 py-2 text-xs font-semibold text-white"
                      >
                        Bill this visit
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      ) : (
        <section className="rounded-2xl border bg-white p-5">
          <h3 className="text-lg font-semibold">Find patient</h3>
          <input
            placeholder="Folder number, name, or phone"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="mt-3 w-full rounded-xl border px-4 py-3 font-mono text-base"
          />
          <ul className="mt-3 max-h-48 space-y-1 overflow-auto">
            {(lookup ? [lookup, ...matches.filter((p) => p.id !== lookup.id)] : matches).slice(0, 8).map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => pickPatient(p.id)}
                  className={`w-full rounded-xl border px-3 py-3 text-left text-sm ${selected?.id === p.id ? 'border-clinic-500 bg-clinic-50' : 'border-slate-100 hover:bg-slate-50'}`}
                >
                  <PatientIdentity patient={p} extra={` · ${p.age}y`} />
                  {isStaffRelated(p) && <span className="mt-1 block text-xs text-amber-800">Worker / relative</span>}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className={`grid gap-4 ${billLater ? '' : 'lg:grid-cols-2'}`}>
        {!billLater && (
          <section className="rounded-2xl border-2 border-sky-200 bg-white p-5">
            <h3 className="text-lg font-semibold text-sky-900">Check in</h3>
            {selected ? (
              <>
                <div className="mt-3">
                  <PatientJourneyCard patient={selected} visit={visit} />
                </div>
                <div className="mt-3 rounded-xl bg-sky-50 px-3 py-3 text-sm">
                  <PatientIdentity patient={selected} extra={` · ${selected.age}y ${selected.gender}`} />
                  <p className="mt-1 text-xs text-slate-500">
                    DOB {selected.dateOfBirth ? new Date(selected.dateOfBirth).toLocaleDateString() : '—'} · {selected.phone}
                  </p>
                  <p className="text-xs text-slate-500">Stays: {stayLabel(selected)}</p>
                  <p className="text-xs text-slate-500">{insuranceLabel(selected)}</p>
                  {isStaffRelated(selected) && (
                    <p className="mt-1 text-xs font-medium text-amber-800">{staffRelationLabel(selected, state.staff)}</p>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleCopy(selected.hospitalNo)}
                    className="mt-2 rounded-lg border bg-white px-3 py-1.5 text-xs font-semibold"
                  >
                    {copied === selected.hospitalNo ? 'Copied' : `Copy folder ${selected.hospitalNo}`}
                  </button>
                </div>
                {visit && (
                  <p className="mt-3 rounded-lg bg-clinic-50 px-3 py-2 text-sm text-clinic-800">
                    Open visit: {CLINIC_LABELS[visit.clinic]} · {visit.reason}
                  </p>
                )}
                {hasGhanaNhiss(selected) && (
                  <CcCodeField
                    value={ccCode || visit?.nhisCcCode || ''}
                    onChange={setCcCode}
                    onSave={visit ? () => updateCare((current) => setVisitCcCode(current, visit.id, ccCode)) : undefined}
                  />
                )}
                {isCashPrivatePatient(selected) && !isStaffRelated(selected) && (
                  <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    Private patient. If you bill them, they pay cash at Accounts.
                  </p>
                )}
                <label className="mt-3 block text-sm font-medium text-slate-700">Department / clinic</label>
                <select value={clinic} onChange={(e) => setClinic(e.target.value as ClinicId)} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm">
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
                  className="mt-3 w-full rounded-xl border px-3 py-2 text-sm"
                />
                <label className="mt-3 block text-sm font-medium text-slate-700">Co-payer for this visit</label>
                <select value={copayerId} onChange={(e) => setCopayerId(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm">
                  <option value="">Patient pays</option>
                  {copayers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.firstName} {c.lastName} ({c.relationship})
                    </option>
                  ))}
                </select>
                <div className="mt-4">
                  <ServicePickList
                    suggested={suggested}
                    extrasByDept={extrasByDept}
                    selectedServices={selectedServices}
                    onToggle={toggleService}
                  />
                </div>
                <div className="mt-4 grid gap-2">
                  <button
                    type="button"
                    onClick={() => handleStartVisit(true)}
                    className="w-full rounded-xl bg-clinic-600 py-3 text-sm font-semibold text-white hover:bg-clinic-700"
                  >
                    Check in and bill
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStartVisit(false)}
                    className="w-full rounded-xl border-2 border-sky-300 py-3 text-sm font-semibold text-sky-800 hover:bg-sky-50"
                  >
                    Check in only
                  </button>
                  {visit && (
                    <button
                      type="button"
                      onClick={() => printQueueTicket(selected, visit)}
                      className="w-full rounded-xl border py-3 text-sm font-semibold"
                    >
                      Print queue ticket{visit.queueNo ? ` #${visit.queueNo}` : ''}
                    </button>
                  )}
                </div>
              </>
            ) : (
              <p className="mt-3 text-sm text-slate-500">Select a patient on the left first.</p>
            )}
          </section>
        )}

        <section className="rounded-2xl border-2 border-amber-200 bg-white p-5">
          <h3 className="text-lg font-semibold text-amber-900">Billing</h3>
          {!selected && <p className="mt-3 text-sm text-slate-500">Find a patient, or paste a folder number on Bill later.</p>}
          {selected && !visit && (
            <p className="mt-3 text-sm text-slate-500">No open visit. Check them in first, or use Check in and bill.</p>
          )}
          {selected && visit && (
            <>
              <div className="mt-3 rounded-xl bg-amber-50 px-3 py-3 text-sm">
                <PatientIdentity patient={selected} />
                <p className="mt-1 text-xs text-slate-600">
                  {CLINIC_LABELS[visit.clinic ?? 'GENERAL']} · {visit.reason}
                </p>
                <button
                  type="button"
                  onClick={() => void handleCopy(selected.hospitalNo)}
                  className="mt-2 rounded-lg border bg-white px-3 py-1.5 text-xs font-semibold"
                >
                  {copied === selected.hospitalNo ? 'Copied' : `Copy folder ${selected.hospitalNo}`}
                </button>
              </div>
              {hasGhanaNhiss(selected) && (
                <CcCodeField
                  value={ccCode || visit.nhisCcCode || ''}
                  onChange={setCcCode}
                  onSave={() => updateCare((current) => setVisitCcCode(current, visit.id, ccCode))}
                />
              )}
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
                <div className="mt-4">
                  <ServicePickList
                    suggested={suggested}
                    extrasByDept={extrasByDept}
                    selectedServices={selectedServices}
                    onToggle={toggleService}
                  />
                </div>
              )}
              <VisitChargeSummary
                visit={visit}
                showResults
                managedDepartment={user?.role === 'ADMIN' ? undefined : 'RECORDS'}
                onRemoveCharge={canRemove ? (orderId) => removeFromBill(visit.id, orderId) : undefined}
              />
              <button
                type="button"
                onClick={handleSaveBill}
                className="mt-4 w-full rounded-xl bg-amber-600 py-3 text-sm font-semibold text-white hover:bg-amber-700"
              >
                {billable ? 'Save bill' : 'Save as not billed'}
              </button>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
