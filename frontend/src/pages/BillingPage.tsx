import { useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCare } from '../context/CareContext';
import { StageBadge } from '../components/StageBadge';
import PatientIdentity from '../components/PatientIdentity';
import PrintReceiptButton from '../components/PrintReceiptButton';
import ReceiptPreview from '../components/ReceiptPreview';
import { canReceivePayment, canRemoveBill, collectionsSummary, unpaidOrders, visitBalance, type CollectionPeriod } from '../workflow/billing';
import { isoToDateValue } from '../components/PageDateBox';
import { CLINIC_LABELS, DEPARTMENT_LABELS, formatGhs } from '../workflow/catalog';
import { insuranceLabel, isCashPrivatePatient } from '../workflow/patientAdmin';
import { paidReceipts, receiptFromVisit, type ReceiptCopy } from '../workflow/printReceipt';
import { canAccessPage } from '../workflow/permissions';
import { authenticateStaff, markPayLater, payAmountTowardBill, payBill, searchPatients, voidVisitPayment } from '../workflow/store';
import { PAY_METHODS } from '../workflow/deskUi';
import { useStaffAccess } from '../hooks/useStaffAccess';
import RecordSavedModal from '../components/RecordSavedModal';
import { DepartmentBillsPanel } from '../components/DepartmentControls';
import { accountantClaimPack, downloadAccountantClaimsExcel } from '../workflow/claimsExcel';
import {
  accountantInboxTotals,
  CLAIM_STATUS_LABEL,
  claimsForAccountantCash,
  purchasesForAccountant,
  receiveClaimRemittance,
  receivePurchaseForAccounts,
  visitClaimAmount,
} from '../workflow/supportDesks';
import { btnPrimary, btnSecondary } from './admin/adminUi';
import AccountantDesk from './AccountantDesk';
import type { PayMethod, VisitRecord } from '../workflow/types';

function matchesQuery(visit: VisitRecord, patientName: string, hospitalNo: string, phone: string, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  return (
    patientName.toLowerCase().includes(q) ||
    hospitalNo.toLowerCase().includes(q) ||
    phone.includes(q) ||
    (visit.reason ?? '').toLowerCase().includes(q) ||
    CLINIC_LABELS[visit.clinic ?? 'GENERAL'].toLowerCase().includes(q)
  );
}

export default function BillingPage() {
  const { user } = useAuth();
  const { state, updateCare, removeFromBill } = useCare();
  const access = useStaffAccess();
  const staffId = user?.id ?? 'staff-cashier';
  const isAccountant = Boolean(user && (user.role === 'ACCOUNTANT' || user.role === 'ADMIN' || canAccessPage(access, 'collections')));
  const canCollect = canReceivePayment(user?.role);
  const canRemove = canRemoveBill(user);
  const removeDepartment = user?.role === 'ADMIN' ? 'ALL' : user?.inChargeOf;
  const queue = state.visits.filter((v) => v.stage !== 'COMPLETED' && unpaidOrders(v).length > 0);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [receiptQuery, setReceiptQuery] = useState('');
  const [preview, setPreview] = useState<{ mode: CollectionPeriod | 'one'; visitId?: string } | null>(null);
  const [paid, setPaid] = useState<{ name: string; visitId: string } | null>(null);
  const [confirm, setConfirm] = useState<{ visitId: string; name: string; amount: number; folder: string } | null>(null);
  const [typedAmount, setTypedAmount] = useState('');
  const [tendered, setTendered] = useState('');
  const [inHand, setInHand] = useState(false);
  const [payMethod, setPayMethod] = useState<PayMethod>('CASH');
  const [payPart, setPayPart] = useState('');
  const [laterReason, setLaterReason] = useState('');
  const [witnessId, setWitnessId] = useState('');
  const [witnessPass, setWitnessPass] = useState('');
  const [counted, setCounted] = useState('');
  const [closeNote, setCloseNote] = useState('');

  const totals = useMemo(() => collectionsSummary(state), [state]);
  const accountantClaims = useMemo(() => accountantClaimPack(state), [state]);
  const claimsCash = useMemo(() => claimsForAccountantCash(state), [state]);
  const purchaseInbox = useMemo(() => purchasesForAccountant(state), [state]);
  const inboxTotals = useMemo(() => accountantInboxTotals(state), [state]);
  const dayReceipts = useMemo(() => paidReceipts(state, 'day'), [state]);
  const monthReceipts = useMemo(() => paidReceipts(state, 'month'), [state]);
  const yearReceipts = useMemo(() => paidReceipts(state, 'year'), [state]);

  const matches = useMemo(() => {
    if (!query.trim()) return [];
    const people = searchPatients(state.patients, query);
    const byId = new Set(people.map((p) => p.id));
    return queue.filter((visit) => {
      const person = state.patients.find((p) => p.id === visit.patientId);
      const name = person ? `${person.firstName} ${person.lastName}` : '';
      return byId.has(visit.patientId) || matchesQuery(visit, name, person?.hospitalNo ?? '', person?.phone ?? '', query);
    });
  }, [query, queue, state.patients]);

  const waitingNames = useMemo(
    () =>
      queue
        .map((visit) => {
          const person = state.patients.find((p) => p.id === visit.patientId);
          const name = person ? `${person.firstName} ${person.lastName}` : 'Unknown patient';
          return {
            visitId: visit.id,
            name,
            folder: person?.hospitalNo ?? '',
            date: isoToDateValue(visit.checkedInAt || visit.billingDecidedAt),
            amount: visitBalance(visit),
            label: `${name} · ${person?.hospitalNo ?? ''} · ${isoToDateValue(visit.checkedInAt)} · ${formatGhs(visitBalance(visit))}`,
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name)),
    [queue, state.patients],
  );

  const selected = queue.find((visit) => visit.id === selectedId);
  const selectedPatient = state.patients.find((p) => p.id === selected?.patientId);
  const selectedTotal = selected ? visitBalance(selected) : 0;
  const tenderedValue = Number(tendered);
  const changeDue = Number.isFinite(tenderedValue) && tenderedValue > 0 ? tenderedValue - selectedTotal : null;

  const visibleReceipts = useMemo(() => {
    if (!receiptQuery.trim()) return [];
    const people = searchPatients(state.patients, receiptQuery);
    const ids = new Set(people.map((p) => p.id));
    return dayReceipts.filter((copy) => {
      const visit = state.visits.find((item) => item.id === copy.visitId);
      const person = state.patients.find((item) => item.id === visit?.patientId);
      const name = person ? `${person.firstName} ${person.lastName}` : '';
      return (visit && ids.has(visit.patientId)) || name.toLowerCase().includes(receiptQuery.trim().toLowerCase()) || copy.receiptNo.toLowerCase().includes(receiptQuery.trim().toLowerCase());
    });
  }, [dayReceipts, receiptQuery, state.patients, state.visits]);

  const previewCopies: ReceiptCopy[] = useMemo(() => {
    if (!preview) return [];
    if (preview.mode === 'day') return dayReceipts;
    if (preview.mode === 'month') return monthReceipts;
    if (preview.mode === 'year') return yearReceipts;
    if (preview.mode === 'all') return yearReceipts;
    const visit = state.visits.find((item) => item.id === preview.visitId);
    if (!visit) return [];
    const patient = state.patients.find((item) => item.id === visit.patientId);
    const copy = receiptFromVisit(visit, patient, state.staff);
    return copy ? [copy] : [];
  }, [preview, state, dayReceipts, monthReceipts, yearReceipts]);

  function askReceive(visitId: string) {
    const visit = state.visits.find((item) => item.id === visitId);
    const person = state.patients.find((item) => item.id === visit?.patientId);
    if (!visit) return;
    setTypedAmount('');
    setTendered('');
    setInHand(false);
    setConfirm({
      visitId,
      name: person ? `${person.firstName} ${person.lastName}` : 'Patient',
      amount: visitBalance(visit),
      folder: person?.hospitalNo ?? '',
    });
  }

  function receiveConfirmed() {
    if (!confirm || !canCollect) return;
    const expected = confirm.amount.toFixed(2);
    const typed = Number(typedAmount).toFixed(2);
    if (typed !== expected || !inHand) return;
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
    setPaid({ name: confirm.name, visitId: confirm.visitId });
    setConfirm(null);
    setSelectedId(null);
    setQuery('');
    setTypedAmount('');
    setTendered('');
    setInHand(false);
  }

  function undoPayment(visitId: string) {
    if (!canCollect) return;
    updateCare((current) => voidVisitPayment(current, visitId));
    setPaid(null);
    setPreview(null);
  }

  const previewTitle =
    preview?.mode === 'day'
      ? 'Receipts today'
      : preview?.mode === 'month'
        ? 'Receipts this month'
        : preview?.mode === 'year'
          ? 'Receipts this year'
          : previewCopies[0]
            ? `Receipt ${previewCopies[0].receiptNo}`
            : 'Receipt';

  const amountOk = confirm && Number(typedAmount).toFixed(2) === confirm.amount.toFixed(2);

  if (isAccountant) return <AccountantDesk />;

  return (
    <div className="p-6">
      {paid && (
        <RecordSavedModal
          onClose={() => {
            setPreview({ mode: 'one', visitId: paid.visitId });
            setPaid(null);
          }}
        />
      )}

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3" onClick={() => setConfirm(null)}>
          <div
            role="dialog"
            aria-labelledby="confirm-pay-title"
            className="w-full max-w-md rounded-[2rem] bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-center text-4xl">💵</p>
            <h2 id="confirm-pay-title" className="mt-3 text-center text-2xl font-black text-slate-900">
              Did you receive the money?
            </h2>
            <p className="mt-2 text-center text-lg font-semibold text-clinic-800">{confirm.name}</p>
            <p className="text-center font-mono text-sm text-slate-500">{confirm.folder}</p>
            <p className="mt-3 text-center text-3xl font-black text-emerald-700">{formatGhs(confirm.amount)}</p>
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
            <div className="mt-5 grid gap-2">
              <button
                type="button"
                disabled={!amountOk || !inHand}
                onClick={receiveConfirmed}
                className="rounded-2xl bg-emerald-600 py-4 text-lg font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Yes — money received
              </button>
              <button type="button" onClick={() => setConfirm(null)} className="rounded-2xl border-2 py-3 text-base font-semibold text-slate-700">
                No — go back
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-clinic-900">
            {canCollect ? 'Accounts — receive payment' : 'Accounts — money books'}
          </h1>
          {isAccountant && (
            <p className="mt-1 text-sm text-slate-500">All hospital money: allocation, spending, remaining, claims remittance, purchases, and worker pay.</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={dayReceipts.length === 0}
            onClick={() => setPreview({ mode: 'day' })}
            className="rounded-lg bg-clinic-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            View / print receipts today
          </button>
          {isAccountant && (
            <>
              <button
                type="button"
                disabled={monthReceipts.length === 0}
                onClick={() => setPreview({ mode: 'month' })}
                className="rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
              >
                This month
              </button>
              <button
                type="button"
                disabled={yearReceipts.length === 0}
                onClick={() => setPreview({ mode: 'year' })}
                className="rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
              >
                This year
              </button>
            </>
          )}
        </div>
      </div>

      <div className={`mt-6 grid gap-3 ${isAccountant ? 'sm:grid-cols-3' : 'sm:grid-cols-1 max-w-sm'}`}>
        <CollectionCard label="Received today" amount={totals.day} />
        {isAccountant && <CollectionCard label="Received this month" amount={totals.month} />}
        {isAccountant && <CollectionCard label="Received this year" amount={totals.year} />}
      </div>
      {isAccountant && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <CollectionCard label="Claims remittance waiting" amount={inboxTotals.remittanceWaiting} />
          <CollectionCard label="Things to purchase" amount={inboxTotals.purchasesWaiting} />
        </div>
      )}

      {isAccountant && (
        <section className="mt-6 rounded-2xl border border-clinic-100 bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Claims Excel for review</h2>
              <p className="mt-1 text-sm text-slate-500">
                Claims desk prepares this spreadsheet. Check the amounts here before the hospital sends the pack to NHIS / government for remittance.
              </p>
            </div>
            <button type="button" className={btnSecondary} onClick={() => downloadAccountantClaimsExcel(state)}>
              Download Excel
            </button>
          </div>
          {accountantClaims.claims.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No submitted claims waiting for accountant review.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left">
                    <th className="border border-slate-200 px-3 py-2 font-semibold">Claim</th>
                    <th className="border border-slate-200 px-3 py-2 font-semibold">Patient</th>
                    <th className="border border-slate-200 px-3 py-2 font-semibold">Scheme</th>
                    <th className="border border-slate-200 px-3 py-2 font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {accountantClaims.claims.map((row) => (
                    <tr key={row.claimNo}>
                      <td className="border border-slate-200 px-3 py-2">{row.claimNo}</td>
                      <td className="border border-slate-200 px-3 py-2">
                        {row.patientName}
                        <span className="ml-2 font-mono text-xs text-clinic-700">{row.hospitalNo}</span>
                      </td>
                      <td className="border border-slate-200 px-3 py-2">{row.scheme}</td>
                      <td className="border border-slate-200 px-3 py-2">{formatGhs(row.amountGhs)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {isAccountant && (
        <section className="mt-6 rounded-2xl border border-emerald-100 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">Cash received from claims</h2>
          <p className="mt-1 text-sm text-slate-500">
            Claims desk sends submitted packs and remittance here. Receive the insurer cash into the books when it arrives.
          </p>
          {claimsCash.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No claims remittance waiting.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {claimsCash.map((row) => {
                const amount = row.claim?.amountGhs ?? visitClaimAmount(row.visit);
                const received = Boolean(row.claim?.accountsReceivedAt);
                return (
                  <li key={row.visit.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-3 text-sm">
                    <div>
                      <p className="font-medium text-slate-900">
                        {row.claim?.claimNo ?? 'No claim no'} · {row.patient ? `${row.patient.firstName} ${row.patient.lastName}` : 'Unknown patient'}
                      </p>
                      <p className="text-xs text-slate-500">
                        {row.scheme === 'NHIS' ? 'NHIS / Ghana Card' : row.patient?.insuranceProvider ?? 'Private'} ·{' '}
                        {CLAIM_STATUS_LABEL[row.claim?.status ?? 'DRAFT']} · {formatGhs(amount)}
                        {received ? ' · Received into collections' : ''}
                      </p>
                    </div>
                    {received ? (
                      <p className="text-xs font-semibold text-emerald-800">Cash received</p>
                    ) : (
                      <button
                        type="button"
                        className={btnPrimary}
                        onClick={() => updateCare((current) => receiveClaimRemittance(current, row.visit.id, staffId))}
                      >
                        Receive remittance {formatGhs(amount)}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {isAccountant && (
        <section className="mt-6 rounded-2xl border border-amber-100 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">Things to purchase</h2>
          <p className="mt-1 text-sm text-slate-500">
            Procurement and pharmacy send items that need to be bought. Receive the request so Accounts has it on the books.
          </p>
          {purchaseInbox.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No open purchase requests.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {purchaseInbox.map((row) => {
                const vendor = state.vendors.find((item) => item.id === row.vendorId);
                const received = Boolean(row.accountsReceivedAt);
                return (
                  <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-3 text-sm">
                    <div>
                      <p className="font-medium text-slate-900">
                        {row.poNo} · {row.itemName} × {row.quantity}
                      </p>
                      <p className="text-xs text-slate-500">
                        {DEPARTMENT_LABELS[row.department]} · {vendor?.name ?? 'Vendor'} · {row.status}
                        {row.amountGhs ? ` · ${formatGhs(row.amountGhs)}` : ''}
                        {row.note ? ` · ${row.note}` : ''}
                      </p>
                    </div>
                    {received ? (
                      <p className="text-xs font-semibold text-emerald-800">On the books</p>
                    ) : (
                      <button
                        type="button"
                        className={btnPrimary}
                        onClick={() => updateCare((current) => receivePurchaseForAccounts(current, row.id, staffId))}
                      >
                        Receive purchase request
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {canRemove && removeDepartment && (
        <div className="mt-6">
          <DepartmentBillsPanel
            department={removeDepartment}
            visits={state.visits}
            patients={state.patients}
            onRemove={removeFromBill}
          />
        </div>
      )}

      {canCollect && (
        <section className="mt-6 rounded-2xl border bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">Find who is paying</h2>
          <p className="mt-1 text-sm text-slate-500">
            {queue.length} unpaid bill{queue.length === 1 ? '' : 's'} waiting. Use the name list if they could not pay earlier, or search.
          </p>
          <label className="mt-4 block text-sm font-medium text-slate-700">
            Names still owing
            <select
              value={selectedId ?? ''}
              onChange={(e) => {
                setSelectedId(e.target.value || null);
                setQuery('');
              }}
              size={Math.min(8, Math.max(3, waitingNames.length + 1))}
              className="mt-1 w-full rounded-2xl border px-3 py-2 text-base leading-8"
            >
              <option value="">Choose a name…</option>
              {waitingNames.map((row) => (
                <option key={row.visitId} value={row.visitId}>
                  {row.label}
                </option>
              ))}
            </select>
          </label>
          {waitingNames.length > 0 && (
            <ul className="mt-3 max-h-64 space-y-2 overflow-auto">
              {waitingNames.map((row) => (
                <li key={`row-${row.visitId}`}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(row.visitId);
                      setQuery('');
                    }}
                    className={`flex w-full flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left ${
                      selectedId === row.visitId ? 'border-clinic-600 bg-clinic-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <span className="font-semibold text-slate-800">{row.name}</span>
                    <span className="font-mono text-xs text-clinic-700">{row.folder}</span>
                    <input type="date" readOnly value={row.date} className="rounded-lg border bg-white px-2 py-1 text-sm" />
                    <span className="text-sm font-medium">{formatGhs(row.amount)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedId(null);
            }}
            placeholder="Or search name, folder number, or phone"
            className="mt-3 w-full rounded-2xl border px-4 py-3 text-base"
          />
          {waitingNames.length === 0 && !query.trim() && (
            <p className="mt-6 rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              No unpaid bills waiting.
            </p>
          )}
          {query.trim() && matches.length === 0 && (
            <p className="mt-6 rounded-xl bg-amber-50 px-4 py-6 text-center text-sm text-amber-900">No unpaid bill matches that search.</p>
          )}
          {query.trim() && matches.length > 0 && (
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {matches.map((visit) => {
                const person = state.patients.find((p) => p.id === visit.patientId);
                const active = selected?.id === visit.id;
                return (
                  <li key={visit.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(visit.id)}
                      className={`w-full rounded-2xl border px-4 py-3 text-left ${active ? 'border-clinic-600 bg-clinic-50' : 'hover:bg-slate-50'}`}
                    >
                      <PatientIdentity patient={person} />
                      <p className="mt-1 text-sm text-slate-600">
                        {CLINIC_LABELS[visit.clinic ?? 'GENERAL']} · {formatGhs(visitBalance(visit))}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {selected && selectedPatient && (
            <div className="mt-5 rounded-2xl border-2 border-amber-200 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <PatientIdentity patient={selectedPatient} />
                  <p className="text-sm text-slate-600">
                    {CLINIC_LABELS[selected.clinic ?? 'GENERAL']} · {selected.diagnosis ?? selected.reason}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{insuranceLabel(selectedPatient)}</p>
                  {isCashPrivatePatient(selectedPatient) && (
                    <p className="mt-1 text-xs font-medium text-amber-800">Private patient — collect the full cash bill.</p>
                  )}
                </div>
                <StageBadge stage={selected.stage} />
              </div>
              <table className="mt-3 w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left">
                    <th className="border border-slate-200 px-2 py-1.5 font-semibold">Check</th>
                    <th className="border border-slate-200 px-2 py-1.5 font-semibold">Work</th>
                    <th className="border border-slate-200 px-2 py-1.5 font-semibold">Bill</th>
                    <th className="border border-slate-200 px-2 py-1.5 text-right font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.orders.map((o) => (
                    <tr key={o.id}>
                      <td className="border border-slate-200 px-2 py-1.5">{o.name}</td>
                      <td className="border border-slate-200 px-2 py-1.5 text-xs text-slate-600">
                        {o.status === 'DONE' ? 'Done' : o.department === 'LAB' ? 'Checking' : 'Waiting'}
                      </td>
                      <td className="border border-slate-200 px-2 py-1.5 text-xs text-slate-500">
                        {o.chargeable === false ? 'not billed' : o.paidAt ? 'paid' : 'unpaid'}
                      </td>
                      <td className="border border-slate-200 px-2 py-1.5 text-right">{formatGhs(o.priceGhs)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-3 text-right text-lg font-semibold">Amount due {formatGhs(selectedTotal)}</p>
              <label className="mt-3 block text-sm font-medium text-slate-700">
                Cash given (optional — to see change)
                <input
                  inputMode="decimal"
                  value={tendered}
                  onChange={(e) => setTendered(e.target.value)}
                  placeholder="0.00"
                  className="mt-1 w-full rounded-xl border px-3 py-2"
                />
              </label>
              {changeDue !== null && (
                <p className={`mt-2 text-sm font-semibold ${changeDue < 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                  {changeDue < 0 ? `Still short ${formatGhs(Math.abs(changeDue))}` : `Give change ${formatGhs(changeDue)}`}
                </p>
              )}
              <p className="mt-3 text-sm font-medium">How they are paying</p>
              <div className="mt-2 grid grid-cols-4 gap-2">
                {PAY_METHODS.map((method) => (
                  <button
                    key={method.id}
                    type="button"
                    onClick={() => setPayMethod(method.id)}
                    className={`rounded-xl border py-2 text-sm font-semibold ${payMethod === method.id ? 'border-clinic-600 bg-clinic-50' : ''}`}
                  >
                    {method.icon} {method.label}
                  </button>
                ))}
              </div>
              <label className="mt-3 block text-sm font-medium">
                Pay some now (leave blank to pay all)
                <input value={payPart} onChange={(e) => setPayPart(e.target.value)} inputMode="decimal" className="mt-1 w-full rounded-xl border px-3 py-2" />
              </label>
              <label className="mt-3 block text-sm font-medium">
                No money now — pay later reason
                <input value={laterReason} onChange={(e) => setLaterReason(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" placeholder="e.g. Will bring money this evening" />
              </label>
              {selectedTotal >= 200 && (
                <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm">
                  <p className="font-semibold">Large amount — second person must confirm</p>
                  <select value={witnessId} onChange={(e) => setWitnessId(e.target.value)} className="mt-2 w-full rounded-lg border px-2 py-2">
                    <option value="">Choose supervisor</option>
                    {state.staff.filter((item) => item.isActive && item.id !== staffId).map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.firstName} {item.lastName}
                      </option>
                    ))}
                  </select>
                  <input type="password" value={witnessPass} onChange={(e) => setWitnessPass(e.target.value)} placeholder="Their password" className="mt-2 w-full rounded-lg border px-2 py-2" />
                </div>
              )}
              <button
                type="button"
                onClick={() => askReceive(selected.id)}
                className="mt-4 w-full rounded-2xl bg-clinic-600 py-3 text-base font-semibold text-white hover:bg-clinic-700"
              >
                Take payment {formatGhs(selectedTotal)}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!laterReason.trim()) return;
                  updateCare((current) => markPayLater(current, selected.id, laterReason, staffId));
                  setPaid({ name: `${selectedPatient.firstName} ${selectedPatient.lastName}`, visitId: selected.id });
                }}
                className="mt-2 w-full rounded-2xl border py-3 text-sm font-semibold"
              >
                Save as pay later
              </button>
              <PrintReceiptButton
                visit={selected}
                patient={selectedPatient}
                staff={state.staff}
                onView={() => setPreview({ mode: 'one', visitId: selected.id })}
              />
            </div>
          )}
        </section>
      )}

      <section className="mt-8 rounded-2xl border bg-white p-5">
        <h2 className="font-medium">Reprint a receipt</h2>
        <select
          className="mt-3 w-full rounded-2xl border px-4 py-3"
          defaultValue=""
          onChange={(e) => {
            if (e.target.value) setPreview({ mode: 'one', visitId: e.target.value });
          }}
        >
          <option value="">Choose a name from today’s receipts…</option>
          {dayReceipts.map((copy) => (
            <option key={copy.visitId} value={copy.visitId}>
              {copy.patientName} · {copy.receiptNo} · {formatGhs(copy.paidTotal)}
            </option>
          ))}
        </select>
        <h2 className="mt-6 font-medium">Find a receipt from today</h2>
        <input
          value={receiptQuery}
          onChange={(e) => setReceiptQuery(e.target.value)}
          placeholder="Search name, folder, or receipt number"
          className="mt-3 w-full rounded-2xl border px-4 py-3 text-base"
        />
        {!receiptQuery.trim() && (
          <p className="mt-4 text-sm text-slate-500">{dayReceipts.length} receipt{dayReceipts.length === 1 ? '' : 's'} today. Search to open one.</p>
        )}
        <ul className="mt-4 space-y-3">
          {receiptQuery.trim() && visibleReceipts.length === 0 && (
            <li className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No receipt matches that search.</li>
          )}
          {visibleReceipts.map((copy) => {
            const visit = state.visits.find((item) => item.id === copy.visitId);
            const patient = state.patients.find((item) => item.id === visit?.patientId);
            if (!visit) return null;
            return (
              <li key={`rcpt-${copy.visitId}`} className="rounded-xl border p-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <PatientIdentity patient={patient} />
                    <p className="text-xs text-slate-500">
                      {copy.receiptNo} · {copy.clinic} · {formatGhs(copy.paidTotal)}
                    </p>
                  </div>
                  <StageBadge stage={visit.stage} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <PrintReceiptButton
                    visit={visit}
                    patient={patient}
                    staff={state.staff}
                    onView={() => setPreview({ mode: 'one', visitId: visit.id })}
                  />
                  <button
                    type="button"
                    onClick={() => undoPayment(visit.id)}
                    className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
                  >
                    Undo — money was not received
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-8 rounded-2xl border bg-white p-5">
        <h2 className="font-medium">Daily cash close</h2>
        <p className="mt-1 text-sm text-slate-500">System received today: {formatGhs(totals.day)}</p>
        <label className="mt-3 block text-sm font-medium">
          Counted in the drawer
          <input value={counted} onChange={(e) => setCounted(e.target.value)} inputMode="decimal" className="mt-1 w-full rounded-xl border px-3 py-2" />
        </label>
        <label className="mt-3 block text-sm font-medium">
          Note
          <input value={closeNote} onChange={(e) => setCloseNote(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" />
        </label>
        <button
          type="button"
          onClick={() => {
            const amount = Number(counted);
            if (!Number.isFinite(amount)) return;
            updateCare((current) => ({
              ...current,
              cashCloses: [
                {
                  id: `close-${Date.now()}`,
                  date: new Date().toISOString().slice(0, 10),
                  staffId,
                  counted: amount,
                  systemTotal: totals.day,
                  note: closeNote || undefined,
                  at: new Date().toISOString(),
                },
                ...(current.cashCloses ?? []),
              ],
            }));
            setCounted('');
            setCloseNote('');
            setPaid({ name: 'Cash close', visitId: selectedId ?? dayReceipts[0]?.visitId ?? '' });
          }}
          className="mt-3 rounded-xl bg-clinic-600 px-4 py-2 text-sm font-semibold text-white"
        >
          Lock today
        </button>
        {(state.cashCloses ?? []).slice(0, 3).map((row) => (
          <p key={row.id} className="mt-2 text-xs text-slate-500">
            {row.date}: counted {formatGhs(row.counted)} · system {formatGhs(row.systemTotal)}
          </p>
        ))}
      </section>

      {preview && previewCopies.length > 0 && (
        <ReceiptPreview copies={previewCopies} title={previewTitle} onClose={() => setPreview(null)} />
      )}
    </div>
  );
}

function CollectionCard({ label, amount }: { label: string; amount: number }) {
  return (
    <article className="rounded-xl border bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-clinic-900">{formatGhs(amount)}</p>
    </article>
  );
}
