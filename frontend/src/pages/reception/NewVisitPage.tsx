import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import BillItemPad, { type DraftBillLine } from '../../components/BillItemPad';
import { HisCheckInHeader } from '../../components/HisCheckInHeader';
import { HisPatientFields } from '../../components/HisPatientFields';
import RecordSavedModal from '../../components/RecordSavedModal';
import { isoToDateValue, todayDateValue } from '../../components/PageDateBox';
import { btnPrimary, btnSecondary, inputClass } from '../admin/adminUi';
import { useAuth } from '../../context/AuthContext';
import { useCare } from '../../context/CareContext';
import { HIS_CLINIC_LABELS, serviceHisCode } from '../../workflow/catalog';
import {
  alreadyCheckedInMessage,
  CC_REQUIRED_HINT,
  COPAYER_RELATIONSHIPS,
  expiredCoverAsPrivateMessage,
  folderDisplayName,
  formatHisTime,
  hasGhanaNhiss,
  insuranceNameShort,
  lastVisitDate,
  nhisCoverExpired,
  patientAgeLabel,
  visitMissingRequiredCc,
} from '../../workflow/patientAdmin';
import { findByHospitalNo } from '../../workflow/patientDb';
import { appendBillLines, savePatientCheckIn, searchPatients, setVisitCcCode, setVisitCoverAsPrivate, visitOnProcessDate } from '../../workflow/store';
import type { ClinicId, CopayerRelationship, PatientRecord } from '../../workflow/types';

export default function NewVisitPage() {
  const { user } = useAuth();
  const { state, updateCare, patientCopayers } = useCare();
  const staffId = user?.id ?? 'staff-reception';
  const [params, setParams] = useSearchParams();
  const billLater = params.get('mode') === 'bill';
  const [processDate, setProcessDate] = useState(todayDateValue);
  const [folderNo, setFolderNo] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(params.get('patient'));
  const [clinic, setClinic] = useState<ClinicId>('GENERAL');
  const [ccCode, setCcCode] = useState('');
  const [paymentType, setPaymentType] = useState<CopayerRelationship>('Self');
  const [draft, setDraft] = useState<DraftBillLine[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [alreadyIn, setAlreadyIn] = useState(false);
  const [expiredPrompt, setExpiredPrompt] = useState(false);
  const [asPrivate, setAsPrivate] = useState(false);
  const saveAfterPrivate = useRef(false);

  const selected = state.patients.find((p) => p.id === selectedId) ?? findByHospitalNo(state.patients, folderNo);
  const visit = state.visits.find((v) => v.patientId === selected?.id && v.stage !== 'COMPLETED');
  const copayers = selected ? patientCopayers(selected.id) : [];
  const lastVisit = selected ? lastVisitDate(state.visits, selected.id, visit?.id) : '';
  const folderHits = useMemo(() => {
    const q = folderNo.trim();
    if (!q || (selected && q.toLowerCase() === selected.hospitalNo.toLowerCase())) return [];
    const exact = findByHospitalNo(state.patients, q);
    const rest = searchPatients(state.patients, q).filter((p) => p.id !== exact?.id);
    return (exact ? [exact, ...rest] : rest).slice(0, 8);
  }, [folderNo, selected, state.patients]);

  const todayRows = useMemo(() => {
    return state.visits
      .filter((item) => isoToDateValue(item.checkedInAt) === processDate)
      .map((item) => {
        const person = state.patients.find((p) => p.id === item.patientId);
        const staff = state.staff.find((s) => s.id === item.checkedInBy);
        const billed = item.orders.find((order) => order.chargeable !== false && order.department !== 'RECORDS') ?? item.orders[0];
        return {
          visit: item,
          person,
          name: person ? folderDisplayName(person) : 'UNKNOWN',
          folder: person?.hospitalNo ?? '',
          sponsor: item.coverAsPrivate ? 'PRIVATE' : insuranceNameShort(person),
          clinic: HIS_CLINIC_LABELS[item.clinic] ?? item.clinic,
          cc: item.nhisCcCode ?? '',
          code: billed ? serviceHisCode(billed.serviceId) : '',
          age: person ? patientAgeLabel(person) : '',
          time: formatHisTime(item.checkedInAt),
          staff: staff ? `${staff.firstName} ${staff.lastName}`.toUpperCase() : '',
        };
      })
      .sort((a, b) => (b.visit.checkedInAt ?? '').localeCompare(a.visit.checkedInAt ?? ''));
  }, [processDate, state.patients, state.staff, state.visits]);

  useEffect(() => {
    const fromUrl = params.get('patient');
    if (!fromUrl) return;
    const person = state.patients.find((p) => p.id === fromUrl);
    if (person) {
      setSelectedId(person.id);
      setFolderNo(person.hospitalNo);
    }
  }, [params, state.patients]);

  useEffect(() => {
    if (visit?.nhisCcCode) setCcCode(visit.nhisCcCode);
    else setCcCode('');
  }, [selected?.id, visit?.id, visit?.nhisCcCode]);

  useEffect(() => {
    if (!selected) return;
    if (visit?.clinic) setClinic(visit.clinic);
    const primary = copayers.find((c) => c.isPrimary);
    setPaymentType(primary?.relationship ?? 'Self');
  }, [selected?.id, visit?.id]);

  useEffect(() => {
    if (!selected || billLater || asPrivate || visit?.coverAsPrivate) return;
    if (visitOnProcessDate(state.visits, selected.id, processDate)) return;
    if (nhisCoverExpired(selected)) setExpiredPrompt(true);
  }, [selected?.id]);

  function pickPatient(patient: PatientRecord, warnIfToday = false) {
    setSelectedId(patient.id);
    setFolderNo(patient.hospitalNo);
    const next = new URLSearchParams(params);
    next.set('patient', patient.id);
    setParams(next, { replace: true });
    setDraft([]);
    setMessage(null);
    setSaved(false);
    setAsPrivate(false);
    setExpiredPrompt(false);
    saveAfterPrivate.current = false;
    if (!billLater && warnIfToday && visitOnProcessDate(state.visits, patient.id, processDate)) {
      setAlreadyIn(true);
    } else {
      setAlreadyIn(false);
      if (!billLater && nhisCoverExpired(patient)) setExpiredPrompt(true);
    }
  }

  function loadFolder() {
    if (!folderNo.trim()) return;
    const found = findByHospitalNo(state.patients, folderNo) ?? searchPatients(state.patients, folderNo)[0];
    if (!found) {
      setSelectedId(null);
      setMessage('No folder matches that number.');
      return;
    }
    pickPatient(found, true);
    if (billLater && !state.visits.some((v) => v.patientId === found.id && v.stage !== 'COMPLETED')) {
      setMessage('This folder has no open visit. Use Patient Check In first.');
    }
  }

  function clearDesk() {
    setSelectedId(null);
    setFolderNo('');
    setClinic('GENERAL');
    setCcCode('');
    setPaymentType('Self');
    setDraft([]);
    setMessage(null);
    setSaved(false);
    setAlreadyIn(false);
    setExpiredPrompt(false);
    setAsPrivate(false);
    saveAfterPrivate.current = false;
    const next = new URLSearchParams(params);
    next.delete('patient');
    setParams(next, { replace: true });
  }

  function copayerForPayment() {
    if (asPrivate || paymentType === 'Self') return undefined;
    return copayers.find((c) => c.relationship === paymentType)?.id ?? copayers.find((c) => c.isPrimary)?.id;
  }

  function handleSave(treatPrivate = false) {
    if (!selected) {
      setMessage('Enter a folder number first.');
      return;
    }
    const asPrivateVisit = treatPrivate || asPrivate || Boolean(visit?.coverAsPrivate);
    if (!billLater && visitOnProcessDate(state.visits, selected.id, processDate)) {
      setAlreadyIn(true);
      return;
    }
    if (nhisCoverExpired(selected) && !asPrivateVisit) {
      saveAfterPrivate.current = true;
      setExpiredPrompt(true);
      return;
    }
    if (billLater) {
      if (!visit) {
        setMessage('This folder has no open visit. Use Patient Check In first.');
        return;
      }
      if (!asPrivateVisit && visitMissingRequiredCc(selected, visit, ccCode)) {
        setMessage(CC_REQUIRED_HINT);
        return;
      }
      if (draft.length > 0 || ccCode.trim() || asPrivateVisit) {
        updateCare((current) => {
          const tagged = asPrivateVisit ? setVisitCoverAsPrivate(current, visit.id) : current;
          const withCc = !asPrivateVisit && ccCode.trim() ? setVisitCcCode(tagged, visit.id, ccCode) : tagged;
          return draft.length > 0
            ? appendBillLines(
                withCc,
                visit.id,
                draft.map((line) => ({ serviceId: line.serviceId, qty: line.qty })),
              )
            : withCc;
        });
      }
      setDraft([]);
      setSaved(true);
      setMessage(null);
      return;
    }
    if (!asPrivateVisit && visitMissingRequiredCc(selected, visit, ccCode)) {
      setMessage(CC_REQUIRED_HINT);
      return;
    }
    updateCare((current) =>
      savePatientCheckIn(current, {
        patientId: selected.id,
        staffId,
        clinic,
        copayerId: copayerForPayment(),
        nhisCcCode: asPrivateVisit ? undefined : ccCode,
        onDate: processDate,
        coverAsPrivate: asPrivateVisit,
        lines: draft.map((line) => ({ serviceId: line.serviceId, qty: line.qty })),
      }),
    );
    setDraft([]);
    setSaved(true);
    setMessage(null);
  }

  function acknowledgeExpired() {
    setAsPrivate(true);
    setExpiredPrompt(false);
    setPaymentType('Self');
    if (saveAfterPrivate.current) {
      saveAfterPrivate.current = false;
      handleSave(true);
    }
  }

  const field = `${inputClass} mt-0`;

  return (
    <div className="space-y-4">
      {saved && (
        <RecordSavedModal
          kind="record_saved"
          detail="This person has been sent to Cash and Nursing."
          onClose={() => {
            setSaved(false);
            clearDesk();
          }}
        />
      )}
      {alreadyIn && selected && (
        <RecordSavedModal kind="already_checked_in" detail={alreadyCheckedInMessage(selected)} onClose={() => setAlreadyIn(false)} />
      )}
      {expiredPrompt && selected && (
        <RecordSavedModal kind="expired_cover" detail={expiredCoverAsPrivateMessage(selected)} onClose={acknowledgeExpired} />
      )}

      <section className="desk-panel p-4">
        <h2 className="text-base font-semibold uppercase tracking-wide text-slate-800">Patient Check In</h2>

        <div className="mt-4">
          <HisCheckInHeader
            processDate={processDate}
            onProcessDateChange={setProcessDate}
            clinic={clinic}
            onClinicChange={setClinic}
            ccCode={ccCode}
            onCcCodeChange={setCcCode}
            onMessage={setMessage}
            ccRequired={hasGhanaNhiss(selected) && !asPrivate}
          />
        </div>

        <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(18rem,22rem)_1fr]">
          <HisPatientFields
            patient={selected}
            lastVisit={lastVisit}
            folderInput={
              <input
                value={folderNo}
                onChange={(e) => {
                  setFolderNo(e.target.value);
                  if (selected) setSelectedId(null);
                }}
                onBlur={loadFolder}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    loadFolder();
                  }
                }}
                placeholder="A1/2026"
                className={field}
                aria-label="Folder No"
              />
            }
            folderHits={
              folderHits.length > 0 ? (
                <ul className="max-h-36 divide-y overflow-auto rounded-lg border">
                  {folderHits.map((person) => (
                    <li key={person.id}>
                      <button type="button" className="flex w-full justify-between px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => pickPatient(person)}>
                        <span>{folderDisplayName(person)}</span>
                        <span className="font-mono text-xs text-clinic-800">{person.hospitalNo}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null
            }
          />

          <BillItemPad
            services={state.services}
            enabled={Boolean(selected)}
            draft={draft}
            savedLines={visit?.orders}
            onDraftChange={setDraft}
            leftOfTotal={
              <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
                <span className="shrink-0">Payment Type:</span>
                <select
                  value={paymentType}
                  onChange={(e) => setPaymentType(e.target.value as CopayerRelationship)}
                  className={`${inputClass} max-w-xs`}
                  aria-label="Payment Type"
                >
                  {COPAYER_RELATIONSHIPS.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>
            }
          />
        </div>

        {message && <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">{message}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => handleSave()} className={btnPrimary}>
            Save
          </button>
          <button type="button" onClick={clearDesk} className={btnSecondary}>
            Close
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-700">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[64rem] border-collapse text-sm">
            <thead>
              <tr className="bg-slate-700 text-left text-white">
                <th className="px-3 py-2 font-semibold">Date</th>
                <th className="px-3 py-2 font-semibold">Name</th>
                <th className="px-3 py-2 font-semibold">Folder No</th>
                <th className="px-3 py-2 font-semibold">Sponsor</th>
                <th className="px-3 py-2 font-semibold">Clinic</th>
                <th className="px-3 py-2 font-semibold">CC</th>
                <th className="px-3 py-2 font-semibold">Code</th>
                <th className="px-3 py-2 font-semibold">Age</th>
                <th className="px-3 py-2 font-semibold">Time</th>
                <th className="px-3 py-2 font-semibold">Staff</th>
              </tr>
            </thead>
            <tbody>
              {todayRows.length === 0 ? (
                <tr className="bg-slate-800">
                  <td colSpan={10} className="px-3 py-8 text-center text-slate-300">
                    No check-ins on this date.
                  </td>
                </tr>
              ) : (
                todayRows.map((row, index) => {
                  const active = Boolean(visit && row.visit.id === visit.id);
                  return (
                    <tr
                      key={row.visit.id}
                      className={
                        active
                          ? 'bg-slate-800 text-white'
                          : index % 2 === 0
                            ? 'bg-slate-600 text-white'
                            : 'bg-slate-700 text-white'
                      }
                    >
                      <td className="px-3 py-2 font-semibold text-red-400">{isoToDateValue(row.visit.checkedInAt)}</td>
                      <td className="px-3 py-2">
                        <button type="button" className="text-left font-medium hover:underline" onClick={() => row.person && pickPatient(row.person)}>
                          {row.name}
                        </button>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{row.folder}</td>
                      <td className="px-3 py-2">{row.sponsor}</td>
                      <td className="px-3 py-2">{row.clinic}</td>
                      <td className="px-3 py-2 font-mono">{row.cc}</td>
                      <td className="px-3 py-2 font-mono">{row.code}</td>
                      <td className="px-3 py-2">{row.age}</td>
                      <td className="px-3 py-2">{row.time}</td>
                      <td className="px-3 py-2">{row.staff}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {billLater && (
          <p className="border-t px-3 py-2 text-xs text-slate-500">
            Bill later uses this same desk. Find the folder, add items, then Save.{' '}
            <Link to="/care/reception/patients" className="font-medium text-clinic-700 hover:underline">
              Patient Records
            </Link>
          </p>
        )}
      </section>
    </div>
  );
}
