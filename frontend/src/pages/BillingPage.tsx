import { useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCare } from '../context/CareContext';
import BillItemPad, { type DraftBillLine } from '../components/BillItemPad';
import { HisCheckInHeader } from '../components/HisCheckInHeader';
import { HisPatientFields } from '../components/HisPatientFields';
import RecordSavedModal from '../components/RecordSavedModal';
import { isoToDateValue, todayDateValue } from '../components/PageDateBox';
import { btnPrimary, btnSecondary, inputClass } from './admin/adminUi';
import { canReceivePayment, isInpatientVisit, visitBalance } from '../workflow/billing';
import { formatGhs } from '../workflow/catalog';
import {
  CC_REQUIRED_HINT,
  COPAYER_RELATIONSHIPS,
  expiredCoverAsPrivateMessage,
  folderDisplayName,
  hasGhanaNhiss,
  lastVisitDate,
  nhisCoverExpired,
  visitMissingRequiredCc,
} from '../workflow/patientAdmin';
import { findByHospitalNo } from '../workflow/patientDb';
import { printVisitBill } from '../workflow/printReceipt';
import { PAY_METHODS } from '../workflow/deskUi';
import { appendBillLines, authenticateStaff, payAmountTowardBill, payBill, searchPatients, setVisitCcCode, setVisitCoverAsPrivate } from '../workflow/store';
import type { ClinicId, CopayerRelationship, PatientRecord, PayMethod, VisitRecord } from '../workflow/types';

type StayKind = 'out' | 'in';

export default function BillingPage() {
  const { user } = useAuth();
  const { state, updateCare } = useCare();
  const staffId = user?.id ?? 'staff-cashier';
  const canCollect = canReceivePayment(user?.role);
  const [billDate, setBillDate] = useState(todayDateValue);
  const [stay, setStay] = useState<StayKind>('out');
  const [query, setQuery] = useState('');
  const [folderNo, setFolderNo] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [clinic, setClinic] = useState<ClinicId>('GENERAL');
  const [ccCode, setCcCode] = useState('');
  const [draft, setDraft] = useState<DraftBillLine[]>([]);
  const [paymentType, setPaymentType] = useState<CopayerRelationship>('Self');
  const [message, setMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirm, setConfirm] = useState<{ visitId: string; name: string; amount: number; folder: string } | null>(null);
  const [typedAmount, setTypedAmount] = useState('');
  const [inHand, setInHand] = useState(false);
  const [payMethod, setPayMethod] = useState<PayMethod>('CASH');
  const [payPart, setPayPart] = useState('');
  const [witnessId, setWitnessId] = useState('');
  const [witnessPass, setWitnessPass] = useState('');
  const [expiredPrompt, setExpiredPrompt] = useState(false);
  const [asPrivate, setAsPrivate] = useState(false);
  const saveAfterPrivate = useRef(false);

  const dayVisits = useMemo(() => {
    return state.visits.filter((visit) => {
      if (isoToDateValue(visit.checkedInAt) !== billDate) return false;
      return stay === 'in' ? isInpatientVisit(visit) : !isInpatientVisit(visit);
    });
  }, [state.visits, billDate, stay]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return dayVisits
      .map((visit) => {
        const person = state.patients.find((item) => item.id === visit.patientId);
        const name = person ? `${person.lastName} ${person.firstName}` : 'Unknown patient';
        return { visit, person, name, folder: person?.hospitalNo ?? '' };
      })
      .filter((row) => {
        if (!q) return true;
        return row.name.toLowerCase().includes(q) || row.folder.toLowerCase().includes(q);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [dayVisits, query, state.patients]);

  const selected = state.visits.find((visit) => visit.id === selectedId);
  const selectedPatient = state.patients.find((item) => item.id === selected?.patientId);
  const lastVisit = selectedPatient ? lastVisitDate(state.visits, selectedPatient.id, selected?.id) : '';
  const due = selected ? visitBalance(selected) + draft.reduce((sum, line) => sum + line.subtotal, 0) : 0;
  const amountOk = confirm && Number(typedAmount).toFixed(2) === confirm.amount.toFixed(2);
  const folderHits = useMemo(() => {
    const q = folderNo.trim();
    if (!q || (selectedPatient && q.toLowerCase() === selectedPatient.hospitalNo.toLowerCase())) return [];
    const exact = findByHospitalNo(state.patients, q);
    const rest = searchPatients(state.patients, q).filter((p) => p.id !== exact?.id);
    return (exact ? [exact, ...rest] : rest).slice(0, 8);
  }, [folderNo, selectedPatient, state.patients]);

  function warnExpiredCover(person?: PatientRecord | null, visit?: VisitRecord | null) {
    const alreadyPrivate = Boolean(visit?.coverAsPrivate);
    setAsPrivate(alreadyPrivate);
    setExpiredPrompt(false);
    saveAfterPrivate.current = false;
    if (person && !alreadyPrivate && nhisCoverExpired(person)) setExpiredPrompt(true);
  }

  function selectVisit(visitId: string) {
    const visit = state.visits.find((item) => item.id === visitId);
    const person = state.patients.find((item) => item.id === visit?.patientId);
    setSelectedId(visitId);
    setFolderNo(person?.hospitalNo ?? '');
    setClinic(visit?.clinic ?? 'GENERAL');
    setCcCode(visit?.nhisCcCode ?? '');
    setDraft([]);
    setMessage(null);
    warnExpiredCover(person, visit);
  }

  function loadFolder() {
    const q = folderNo.trim();
    if (!q) return;
    const person = findByHospitalNo(state.patients, q) ?? searchPatients(state.patients, q)[0];
    if (!person) {
      setSelectedId(null);
      setMessage('No folder matches that number.');
      return;
    }
    const open = state.visits.find((visit) => visit.patientId === person.id && visit.stage !== 'COMPLETED');
    const latest = [...state.visits.filter((visit) => visit.patientId === person.id)].sort((a, b) =>
      (b.checkedInAt ?? '').localeCompare(a.checkedInAt ?? ''),
    )[0];
    const visit = open ?? latest;
    if (!visit) {
      setSelectedId(null);
      setFolderNo(person.hospitalNo);
      setMessage('This folder has no visit to bill. Check the patient in first.');
      return;
    }
    selectVisit(visit.id);
  }

  function pickPatientFolder(patientId: string) {
    const person = state.patients.find((item) => item.id === patientId);
    if (!person) return;
    setFolderNo(person.hospitalNo);
    const open = state.visits.find((visit) => visit.patientId === person.id && visit.stage !== 'COMPLETED');
    const latest = [...state.visits.filter((visit) => visit.patientId === person.id)].sort((a, b) =>
      (b.checkedInAt ?? '').localeCompare(a.checkedInAt ?? ''),
    )[0];
    const visit = open ?? latest;
    if (visit) selectVisit(visit.id);
  }

  function clearDesk() {
    setSelectedId(null);
    setFolderNo('');
    setClinic('GENERAL');
    setCcCode('');
    setDraft([]);
    setPaymentType('Self');
    setMessage(null);
    setExpiredPrompt(false);
    setAsPrivate(false);
    saveAfterPrivate.current = false;
  }

  function saveBill(treatPrivate = false) {
    if (!selected || !selectedPatient || draft.length === 0) return;
    const asPrivateVisit = treatPrivate || asPrivate || Boolean(selected.coverAsPrivate);
    if (nhisCoverExpired(selectedPatient) && !asPrivateVisit) {
      saveAfterPrivate.current = true;
      setExpiredPrompt(true);
      return;
    }
    if (!asPrivateVisit && visitMissingRequiredCc(selectedPatient, selected, ccCode)) {
      setMessage(CC_REQUIRED_HINT);
      return;
    }
    const extra = draft.map((line) => {
      const service = state.services.find((item) => item.id === line.serviceId);
      return {
        id: line.key,
        serviceId: line.serviceId,
        name: line.name,
        department: service?.department ?? ('RECORDS' as const),
        priceGhs: line.subtotal,
        qty: line.qty,
        unitPriceGhs: line.unitPriceGhs,
        status: 'DONE' as const,
      };
    });
    updateCare((current) => {
      const tagged = asPrivateVisit ? setVisitCoverAsPrivate(current, selected.id) : current;
      const withCc = !asPrivateVisit && ccCode.trim() ? setVisitCcCode(tagged, selected.id, ccCode) : tagged;
      return appendBillLines(
        withCc,
        selected.id,
        draft.map((line) => ({ serviceId: line.serviceId, qty: line.qty })),
      );
    });
    printVisitBill(selectedPatient, {
      ...selected,
      orders: [...selected.orders, ...extra],
      nhisCcCode: asPrivateVisit ? undefined : ccCode || selected.nhisCcCode,
      coverAsPrivate: asPrivateVisit || selected.coverAsPrivate,
    });
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
      saveBill(true);
    }
  }

  function receiveConfirmed() {
    if (!confirm || !canCollect) return;
    if (Number(typedAmount).toFixed(2) !== confirm.amount.toFixed(2) || !inHand) return;
    if (confirm.amount >= 200) {
      const witness = state.staff.find((item) => item.id === witnessId);
      if (!witness || witness.id === staffId) return;
      if (authenticateStaff(state, witness.email, witnessPass) === 'invalid') return;
    }
    const part = Number(payPart);
    updateCare((current) => {
      const after =
        part > 0 && part < confirm.amount
          ? payAmountTowardBill(current, confirm.visitId, part, staffId, payMethod, witnessId || undefined)
          : payBill(current, confirm.visitId, staffId);
      return {
        ...after,
        visits: after.visits.map((item) =>
          item.id === confirm.visitId ? { ...item, paymentMethod: payMethod, witnessId: witnessId || undefined } : item,
        ),
      };
    });
    setConfirm(null);
    setTypedAmount('');
    setInHand(false);
    setSaved(true);
  }

  return (
    <section className="desk-panel p-5">
      {saved && <RecordSavedModal kind="record_saved" onClose={() => setSaved(false)} />}
      {expiredPrompt && selectedPatient && (
        <RecordSavedModal kind="expired_cover" detail={expiredCoverAsPrivateMessage(selectedPatient)} onClose={acknowledgeExpired} />
      )}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3" onClick={() => setConfirm(null)}>
          <div role="dialog" aria-labelledby="confirm-pay-title" className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 id="confirm-pay-title" className="text-center text-lg font-semibold text-slate-900">
              Did you receive the money?
            </h2>
            <p className="mt-2 text-center text-lg font-semibold text-clinic-800">{confirm.name}</p>
            <p className="text-center font-mono text-sm text-slate-500">{confirm.folder}</p>
            <p className="mt-3 text-center text-2xl font-semibold text-emerald-700">{formatGhs(confirm.amount)}</p>
            <label className="mt-5 block text-sm font-medium text-slate-700">
              Type the amount to confirm
              <input
                inputMode="decimal"
                value={typedAmount}
                onChange={(e) => setTypedAmount(e.target.value)}
                placeholder={confirm.amount.toFixed(2)}
                className="mt-1 w-full rounded-xl border px-3 py-3 text-center text-lg font-semibold"
              />
            </label>
            {typedAmount && !amountOk && <p className="mt-2 text-center text-sm text-red-700">Amount does not match.</p>}
            <label className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-3 text-sm">
              <input type="checkbox" checked={inHand} onChange={(e) => setInHand(e.target.checked)} className="mt-0.5" />
              <span>The money is in my hand. I am not tapping this by mistake.</span>
            </label>
            <p className="mt-3 text-sm font-medium">How they are paying</p>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {PAY_METHODS.map((method) => (
                <button
                  key={method.id}
                  type="button"
                  onClick={() => setPayMethod(method.id)}
                  className={`rounded-xl border py-2 text-sm font-semibold ${payMethod === method.id ? 'border-clinic-600 bg-clinic-50' : ''}`}
                >
                  {method.label}
                </button>
              ))}
            </div>
            {confirm.amount >= 200 && (
              <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm">
                <p className="font-semibold">Large amount — second person must confirm</p>
                <select value={witnessId} onChange={(e) => setWitnessId(e.target.value)} className="mt-2 w-full rounded-lg border px-2 py-2">
                  <option value="">Choose supervisor</option>
                  {state.staff
                    .filter((item) => item.isActive && item.id !== staffId)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.firstName} {item.lastName}
                      </option>
                    ))}
                </select>
                <input type="password" value={witnessPass} onChange={(e) => setWitnessPass(e.target.value)} placeholder="Their password" className="mt-2 w-full rounded-lg border px-2 py-2" />
              </div>
            )}
            <label className="mt-3 block text-sm font-medium">
              Pay some now (leave blank to pay all)
              <input value={payPart} onChange={(e) => setPayPart(e.target.value)} inputMode="decimal" className="mt-1 w-full rounded-xl border px-3 py-2" />
            </label>
            <div className="mt-5 grid gap-2">
              <button type="button" disabled={!amountOk || !inHand} onClick={receiveConfirmed} className="rounded-lg bg-emerald-700 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300">
                Yes — money received
              </button>
              <button type="button" onClick={() => setConfirm(null)} className="rounded-lg border py-2.5 text-sm font-semibold text-slate-700">
                No — go back
              </button>
            </div>
          </div>
        </div>
      )}

      <h2 className="text-base font-semibold uppercase tracking-wide text-slate-800">Generate Bill</h2>

      <div className="mt-4">
        <HisCheckInHeader
          processDate={billDate}
          onProcessDateChange={setBillDate}
          clinic={clinic}
          onClinicChange={setClinic}
          ccCode={ccCode}
          onCcCodeChange={setCcCode}
          onMessage={setMessage}
          ccRequired={hasGhanaNhiss(selectedPatient) && !asPrivate && !selected?.coverAsPrivate}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setStay('out');
            clearDesk();
          }}
          className={`rounded-md px-4 py-2 text-sm font-semibold ${stay === 'out' ? 'bg-emerald-600 text-white' : 'border bg-white text-slate-700'}`}
        >
          Out-Patient
        </button>
        <button
          type="button"
          onClick={() => {
            setStay('in');
            clearDesk();
          }}
          className={`rounded-md px-4 py-2 text-sm font-semibold ${stay === 'in' ? 'bg-emerald-600 text-white' : 'border bg-white text-slate-700'}`}
        >
          In-Patient
        </button>
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(18rem,22rem)_1fr]">
        <HisPatientFields
          patient={selectedPatient}
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
              className={inputClass}
              aria-label="Folder No"
            />
          }
          folderHits={
            folderHits.length > 0 ? (
              <ul className="max-h-36 divide-y overflow-auto rounded-lg border">
                {folderHits.map((person) => (
                  <li key={person.id}>
                    <button type="button" className="flex w-full justify-between px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => pickPatientFolder(person.id)}>
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
          savedLines={selected?.orders}
          onDraftChange={setDraft}
          emptyHint={selected ? 'No items on this bill yet.' : 'Enter a folder number, then add items.'}
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

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button type="button" className={btnPrimary} disabled={!selected || draft.length === 0} onClick={() => saveBill()}>
          Save
        </button>
        <button type="button" className={btnSecondary} onClick={clearDesk}>
          Close
        </button>
        {selected && selectedPatient && due > 0 && draft.length === 0 && canCollect && (
          <button
            type="button"
            className={btnPrimary}
            onClick={() =>
              setConfirm({
                visitId: selected.id,
                name: `${selectedPatient.firstName} ${selectedPatient.lastName}`,
                amount: visitBalance(selected),
                folder: selectedPatient.hospitalNo,
              })
            }
          >
            Take payment {formatGhs(visitBalance(selected))}
          </button>
        )}
      </div>

      <div className="mt-5 overflow-hidden rounded-lg border border-slate-700">
        <div className="border-b border-slate-600 bg-slate-700 px-3 py-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            aria-label="Search"
            className={`${inputClass} max-w-sm`}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-700 text-left text-white">
                <th className="w-8 px-2 py-2" />
                <th className="px-2 py-2 font-semibold">Patient Name</th>
                <th className="px-2 py-2 font-semibold">F/No.</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr className="bg-slate-800">
                  <td colSpan={3} className="px-3 py-6 text-center text-slate-300">
                    {stay === 'in' ? 'No in-patients on this date.' : 'No out-patients on this date.'}
                  </td>
                </tr>
              ) : (
                rows.map((row, index) => (
                  <tr
                    key={row.visit.id}
                    className={
                      selectedId === row.visit.id
                        ? 'bg-slate-800 text-white'
                        : index % 2 === 0
                          ? 'bg-slate-600 text-white'
                          : 'bg-slate-700 text-white'
                    }
                  >
                    <td className="px-2 py-2">
                      <input
                        type="checkbox"
                        checked={selectedId === row.visit.id}
                        onChange={() => selectVisit(row.visit.id)}
                        aria-label={`Select ${row.person ? `${row.person.firstName} ${row.person.lastName}` : row.name}`}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <button type="button" className="w-full text-left font-medium" onClick={() => selectVisit(row.visit.id)}>
                        {row.person ? folderDisplayName(row.person) : row.name.toUpperCase()}
                      </button>
                    </td>
                    <td className="px-2 py-2 font-mono text-xs">{row.folder}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
