import { useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCare } from '../../context/CareContext';
import PatientIdentity from '../../components/PatientIdentity';
import PrintReceiptButton from '../../components/PrintReceiptButton';
import ReceiptPreview from '../../components/ReceiptPreview';
import RecordSavedModal from '../../components/RecordSavedModal';
import { StageBadge } from '../../components/StageBadge';
import { btnPrimary, btnSecondary, inputClass } from '../admin/adminUi';
import { CLINIC_LABELS, formatGhs } from '../../workflow/catalog';
import {
  collectionsSummary,
  patientDepositBalance,
  postExternalReceipt,
  postPatientDeposit,
  receiptsTakenByUser,
  salesSummaryByUser,
  visitBalance,
  type CollectionPeriod,
} from '../../workflow/billing';
import { PAY_METHODS } from '../../workflow/deskUi';
import { insuranceLabel } from '../../workflow/patientAdmin';
import {
  paidReceipts,
  printDepositSlip,
  printExternalReceiptSlip,
  printVisitBill,
  receiptFromVisit,
} from '../../workflow/printReceipt';
import { searchPatients, voidVisitPayment } from '../../workflow/store';
import type { PayMethod } from '../../workflow/types';
import { ROLE_LABELS } from '../../workflow/types';

function CollectionCard({ label, amount }: { label: string; amount: number }) {
  return (
    <article className="desk-panel p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-clinic-900">{formatGhs(amount)}</p>
    </article>
  );
}

function PatientFinder({
  query,
  onQuery,
  placeholder,
}: {
  query: string;
  onQuery: (value: string) => void;
  placeholder: string;
}) {
  return (
    <input
      value={query}
      onChange={(e) => onQuery(e.target.value)}
      placeholder={placeholder}
      className={`${inputClass} max-w-xl`}
    />
  );
}

export function CashDepositPage() {
  const { user } = useAuth();
  const { state, updateCare } = useCare();
  const staffId = user?.id ?? 'staff-cashier';
  const [query, setQuery] = useState('');
  const [patientId, setPatientId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [method, setMethod] = useState<PayMethod>('CASH');
  const [saved, setSaved] = useState<string | null>(null);
  const matches = useMemo(() => searchPatients(state.patients, query).slice(0, 8), [query, state.patients]);
  const patient = state.patients.find((item) => item.id === patientId);
  const balance = patient ? patientDepositBalance(state, patient.id) : 0;

  return (
    <section className="desk-panel p-5">
      {saved && <RecordSavedModal kind="paid" detail={`Deposit ${saved} saved.`} onClose={() => setSaved(null)} />}
      <h2 className="text-lg font-semibold text-slate-900">Patient deposit</h2>
      <p className="mt-1 text-sm text-slate-500">Take money on the folder before or after a visit. It stays as credit on the account.</p>
      <div className="mt-4">
        <PatientFinder query={query} onQuery={setQuery} placeholder="Folder number, name, or phone" />
      </div>
      {query.trim() && (
        <ul className="mt-3 max-h-48 divide-y overflow-auto rounded-lg border">
          {matches.length === 0 ? (
            <li className="px-3 py-2 text-sm text-slate-500">No matching folder.</li>
          ) : (
            matches.map((person) => (
              <li key={person.id}>
                <button
                  type="button"
                  onClick={() => {
                    setPatientId(person.id);
                    setQuery(person.hospitalNo);
                  }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-clinic-50"
                >
                  <PatientIdentity patient={person} extra={` · ${formatGhs(patientDepositBalance(state, person.id))} on folder`} />
                </button>
              </li>
            ))
          )}
        </ul>
      )}
      {patient && (
        <div className="mt-5 max-w-md space-y-3">
          <PatientIdentity patient={patient} />
          <p className="text-sm text-slate-600">Deposit on folder {formatGhs(balance)}</p>
          <label className="block text-sm font-medium">
            Amount
            <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className={`${inputClass} mt-1`} />
          </label>
          <div className="grid grid-cols-4 gap-2">
            {PAY_METHODS.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => setMethod(row.id)}
                className={`rounded-xl border py-2 text-sm font-semibold ${method === row.id ? 'border-clinic-600 bg-clinic-50' : ''}`}
              >
                {row.label}
              </button>
            ))}
          </div>
          <label className="block text-sm font-medium">
            Note (optional)
            <input value={note} onChange={(e) => setNote(e.target.value)} className={`${inputClass} mt-1`} />
          </label>
          <button
            type="button"
            className={btnPrimary}
            onClick={() => {
              const value = Number(amount);
              if (!Number.isFinite(value) || value <= 0) return;
              let receiptNo = '';
              updateCare((current) => {
                const next = postPatientDeposit(current, {
                  patientId: patient.id,
                  amountGhs: value,
                  staffId,
                  method,
                  note,
                });
                receiptNo = next.patientDeposits?.[0]?.receiptNo ?? '';
                return next;
              });
              printDepositSlip({
                patientName: `${patient.firstName} ${patient.lastName}`,
                hospitalNo: patient.hospitalNo,
                receiptNo,
                amountGhs: value,
                method: PAY_METHODS.find((row) => row.id === method)?.label ?? method,
                receivedBy: `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || 'Cashier',
                at: new Date().toISOString(),
                note,
              });
              setAmount('');
              setNote('');
              setSaved(receiptNo);
            }}
          >
            Take deposit
          </button>
        </div>
      )}
    </section>
  );
}

export function CashReceiptsByUserPage() {
  const { user } = useAuth();
  const { state } = useCare();
  const [staffId, setStaffId] = useState(user?.id ?? '');
  const [period, setPeriod] = useState<CollectionPeriod>('day');
  const cashiers = state.staff.filter((person) => person.role === 'CASHIER' || person.id === staffId);
  const pack = receiptsTakenByUser(state, staffId, period);

  return (
    <section className="desk-panel p-5">
      <h2 className="text-lg font-semibold text-slate-900">Patient receipt by user</h2>
      <p className="mt-1 text-sm text-slate-500">Receipts this cashier took. Change the name to check another till.</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <select value={staffId} onChange={(e) => setStaffId(e.target.value)} className={`${inputClass} max-w-xs`}>
          {cashiers.map((person) => (
            <option key={person.id} value={person.id}>
              {person.firstName} {person.lastName}
            </option>
          ))}
        </select>
        <select value={period} onChange={(e) => setPeriod(e.target.value as CollectionPeriod)} className={`${inputClass} max-w-[10rem]`}>
          <option value="day">Today</option>
          <option value="month">This month</option>
          <option value="year">This year</option>
        </select>
      </div>
      <ul className="mt-4 space-y-2">
        {pack.visitReceipts.length === 0 && pack.deposits.length === 0 && pack.external.length === 0 && (
          <li className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No receipts for this user in that period.</li>
        )}
        {pack.visitReceipts.map((row) => (
          <li key={row.visitId} className="rounded-xl border px-3 py-2 text-sm">
            <p className="font-medium">{row.patientName}</p>
            <p className="text-xs text-slate-500">
              {row.receiptNo} · {row.hospitalNo} · visit · {formatGhs(row.paidTotal)}
            </p>
          </li>
        ))}
        {pack.deposits.map((row) => (
          <li key={row.id} className="rounded-xl border px-3 py-2 text-sm">
            <p className="font-medium">Deposit {row.receiptNo}</p>
            <p className="text-xs text-slate-500">{formatGhs(row.amountGhs)} · {row.method}</p>
          </li>
        ))}
        {pack.external.map((row) => (
          <li key={row.id} className="rounded-xl border px-3 py-2 text-sm">
            <p className="font-medium">External {row.receiptNo} · {row.payerName}</p>
            <p className="text-xs text-slate-500">{row.description} · {formatGhs(row.amountGhs)}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function CashExternalReceiptPage() {
  const { user } = useAuth();
  const { state, updateCare } = useCare();
  const staffId = user?.id ?? 'staff-cashier';
  const [payerName, setPayerName] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [query, setQuery] = useState('');
  const [patientId, setPatientId] = useState<string | null>(null);
  const [method, setMethod] = useState<PayMethod>('CASH');
  const [saved, setSaved] = useState<string | null>(null);
  const matches = useMemo(() => searchPatients(state.patients, query).slice(0, 6), [query, state.patients]);
  const patient = state.patients.find((item) => item.id === patientId);

  return (
    <section className="desk-panel p-5">
      {saved && <RecordSavedModal kind="paid" detail={`Receipt ${saved} saved.`} onClose={() => setSaved(null)} />}
      <h2 className="text-lg font-semibold text-slate-900">Print external receipt</h2>
      <p className="mt-1 text-sm text-slate-500">
        Use this when money is received that is not on an open visit bill — a relative paying, a walk-in copy fee, or a similar cash take.
      </p>
      <div className="mt-4 grid max-w-xl gap-3">
        <label className="text-sm font-medium">
          Payer name
          <input value={payerName} onChange={(e) => setPayerName(e.target.value)} className={`${inputClass} mt-1`} />
        </label>
        <label className="text-sm font-medium">
          What it is for
          <input value={description} onChange={(e) => setDescription(e.target.value)} className={`${inputClass} mt-1`} />
        </label>
        <label className="text-sm font-medium">
          Amount
          <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className={`${inputClass} mt-1`} />
        </label>
        <label className="text-sm font-medium">
          Link to a folder (optional)
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPatientId(null);
            }}
            placeholder="Folder, name, or phone"
            className={`${inputClass} mt-1`}
          />
        </label>
        {query.trim() && !patientId && (
          <ul className="divide-y rounded-lg border">
            {matches.map((person) => (
              <li key={person.id}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-clinic-50"
                  onClick={() => {
                    setPatientId(person.id);
                    setQuery(person.hospitalNo);
                  }}
                >
                  <PatientIdentity patient={person} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="grid grid-cols-4 gap-2">
          {PAY_METHODS.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => setMethod(row.id)}
              className={`rounded-xl border py-2 text-sm font-semibold ${method === row.id ? 'border-clinic-600 bg-clinic-50' : ''}`}
            >
              {row.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={btnPrimary}
          onClick={() => {
            const value = Number(amount);
            if (!payerName.trim() || !description.trim() || !Number.isFinite(value) || value <= 0) return;
            let receiptNo = '';
            updateCare((current) => {
              const next = postExternalReceipt(current, {
                payerName,
                amountGhs: value,
                description,
                staffId,
                patientId: patientId ?? undefined,
                method,
              });
              receiptNo = next.externalReceipts?.[0]?.receiptNo ?? '';
              return next;
            });
            printExternalReceiptSlip({
              payerName,
              patientName: patient ? `${patient.firstName} ${patient.lastName}` : undefined,
              hospitalNo: patient?.hospitalNo,
              receiptNo,
              amountGhs: value,
              description,
              method: PAY_METHODS.find((row) => row.id === method)?.label ?? method,
              receivedBy: `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || 'Cashier',
              at: new Date().toISOString(),
            });
            setSaved(receiptNo);
            setAmount('');
            setDescription('');
          }}
        >
          Save and print
        </button>
      </div>
    </section>
  );
}

export function CashPrintReceiptPage() {
  const { state, updateCare } = useCare();
  const [receiptQuery, setReceiptQuery] = useState('');
  const [previewId, setPreviewId] = useState<string | null>(null);
  const dayReceipts = useMemo(() => paidReceipts(state, 'day'), [state]);
  const visible = useMemo(() => {
    const q = receiptQuery.trim().toLowerCase();
    if (!q) return dayReceipts;
    return dayReceipts.filter(
      (copy) =>
        copy.patientName.toLowerCase().includes(q) ||
        copy.hospitalNo.toLowerCase().includes(q) ||
        copy.receiptNo.toLowerCase().includes(q),
    );
  }, [dayReceipts, receiptQuery]);
  const previewVisit = state.visits.find((item) => item.id === previewId);
  const previewPatient = state.patients.find((item) => item.id === previewVisit?.patientId);
  const previewCopy = previewVisit ? receiptFromVisit(previewVisit, previewPatient, state.staff) : null;

  return (
    <section className="desk-panel p-5">
      <h2 className="text-lg font-semibold text-slate-900">Print receipt</h2>
      <p className="mt-1 text-sm text-slate-500">Reprint a paid visit receipt. Search today’s takes, or pick a name.</p>
      <select
        className={`${inputClass} mt-4 max-w-xl`}
        defaultValue=""
        onChange={(e) => {
          if (e.target.value) setPreviewId(e.target.value);
        }}
      >
        <option value="">Choose a name from today’s receipts…</option>
        {dayReceipts.map((copy) => (
          <option key={copy.visitId} value={copy.visitId}>
            {copy.patientName} · {copy.receiptNo} · {formatGhs(copy.paidTotal)}
          </option>
        ))}
      </select>
      <input
        value={receiptQuery}
        onChange={(e) => setReceiptQuery(e.target.value)}
        placeholder="Search name, folder, or receipt number"
        className={`${inputClass} mt-3 max-w-xl`}
      />
      <ul className="mt-4 space-y-3">
        {visible.map((copy) => {
          const visit = state.visits.find((item) => item.id === copy.visitId);
          const person = state.patients.find((item) => item.id === visit?.patientId);
          if (!visit) return null;
          return (
            <li key={copy.visitId} className="rounded-xl border p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <PatientIdentity patient={person} />
                  <p className="text-xs text-slate-500">
                    {copy.receiptNo} · {copy.clinic} · {formatGhs(copy.paidTotal)}
                  </p>
                </div>
                <StageBadge stage={visit.stage} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <PrintReceiptButton visit={visit} patient={person} staff={state.staff} onView={() => setPreviewId(visit.id)} />
                <button
                  type="button"
                  onClick={() => {
                    updateCare((current) => voidVisitPayment(current, visit.id));
                    setPreviewId(null);
                  }}
                  className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
                >
                  Undo — money was not received
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {previewCopy && (
        <ReceiptPreview copies={[previewCopy]} title={`Receipt ${previewCopy.receiptNo}`} onClose={() => setPreviewId(null)} />
      )}
    </section>
  );
}

export function CashSalesSummaryPage() {
  const { user } = useAuth();
  const { state, updateCare } = useCare();
  const staffId = user?.id ?? 'staff-cashier';
  const [period, setPeriod] = useState<CollectionPeriod>('day');
  const [counted, setCounted] = useState('');
  const [closeNote, setCloseNote] = useState('');
  const totals = collectionsSummary(state);
  const rows = salesSummaryByUser(state, period);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <CollectionCard label="Received today" amount={totals.day} />
        <CollectionCard label="This month" amount={totals.month} />
        <CollectionCard label="This year" amount={totals.year} />
      </div>
      <section className="desk-panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Sales summary by user</h2>
            <p className="mt-1 text-sm text-slate-500">Visit payments, deposits, and external receipts.</p>
          </div>
          <select value={period} onChange={(e) => setPeriod(e.target.value as CollectionPeriod)} className={`${inputClass} max-w-[10rem]`}>
            <option value="day">Today</option>
            <option value="month">This month</option>
            <option value="year">This year</option>
          </select>
        </div>
        {rows.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No sales in this period.</p>
        ) : (
          <table className="mt-4 w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="border px-3 py-2">Cashier</th>
                <th className="border px-3 py-2">Takes</th>
                <th className="border px-3 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const person = state.staff.find((item) => item.id === row.staffId);
                return (
                  <tr key={row.staffId}>
                    <td className="border px-3 py-2">
                      {person ? `${person.firstName} ${person.lastName}` : row.staffId}
                      {person ? ` · ${ROLE_LABELS[person.role]}` : ''}
                    </td>
                    <td className="border px-3 py-2">{row.bills}</td>
                    <td className="border px-3 py-2 text-right">{formatGhs(row.amount)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
      <section className="desk-panel p-5">
        <h2 className="font-medium">Daily cash close</h2>
        <p className="mt-1 text-sm text-slate-500">System received today: {formatGhs(totals.day)}</p>
        <label className="mt-3 block text-sm font-medium">
          Counted in the drawer
          <input value={counted} onChange={(e) => setCounted(e.target.value)} inputMode="decimal" className={`${inputClass} mt-1 max-w-xs`} />
        </label>
        <label className="mt-3 block text-sm font-medium">
          Note
          <input value={closeNote} onChange={(e) => setCloseNote(e.target.value)} className={`${inputClass} mt-1 max-w-xl`} />
        </label>
        <button
          type="button"
          className={`${btnPrimary} mt-3`}
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
          }}
        >
          Lock today
        </button>
        {(state.cashCloses ?? []).slice(0, 5).map((row) => (
          <p key={row.id} className="mt-2 text-xs text-slate-500">
            {row.date}: counted {formatGhs(row.counted)} · system {formatGhs(row.systemTotal)}
          </p>
        ))}
      </section>
    </div>
  );
}

export function CashBillDetailsPage() {
  const { state } = useCare();
  const [query, setQuery] = useState('');
  const [patientId, setPatientId] = useState<string | null>(null);
  const matches = useMemo(() => searchPatients(state.patients, query).slice(0, 8), [query, state.patients]);
  const patient = state.patients.find((item) => item.id === patientId);
  const visits = state.visits.filter((visit) => visit.patientId === patientId);

  return (
    <section className="desk-panel p-5">
      <h2 className="text-lg font-semibold text-slate-900">View patient bill details</h2>
      <p className="mt-1 text-sm text-slate-500">Look up a folder and see every charge, paid or still owing.</p>
      <div className="mt-4">
        <PatientFinder query={query} onQuery={setQuery} placeholder="Folder number, name, or phone" />
      </div>
      {query.trim() && !patientId && (
        <ul className="mt-3 max-h-48 divide-y overflow-auto rounded-lg border">
          {matches.map((person) => (
            <li key={person.id}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-clinic-50"
                onClick={() => {
                  setPatientId(person.id);
                  setQuery(person.hospitalNo);
                }}
              >
                <PatientIdentity patient={person} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {patient && (
        <div className="mt-5">
          <PatientIdentity patient={patient} extra={` · ${insuranceLabel(patient)}`} />
          <p className="mt-1 text-sm text-slate-600">Deposit on folder {formatGhs(patientDepositBalance(state, patient.id))}</p>
          {visits.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No visits on this folder.</p>
          ) : (
            <ul className="mt-4 space-y-4">
              {visits.map((visit) => (
                <li key={visit.id} className="rounded-xl border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">
                      {CLINIC_LABELS[visit.clinic ?? 'GENERAL']} · {new Date(visit.checkedInAt).toLocaleString()}
                    </p>
                    <StageBadge stage={visit.stage} />
                  </div>
                  <table className="mt-3 w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-left">
                        <th className="border px-2 py-1">Charge</th>
                        <th className="border px-2 py-1">Status</th>
                        <th className="border px-2 py-1 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visit.orders.map((order) => (
                        <tr key={order.id}>
                          <td className="border px-2 py-1">{order.name}</td>
                          <td className="border px-2 py-1 text-xs">
                            {order.chargeable === false ? 'not billed' : order.paidAt ? 'paid' : 'unpaid'}
                          </td>
                          <td className="border px-2 py-1 text-right">{formatGhs(order.priceGhs)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold">Balance {formatGhs(visitBalance(visit))}</p>
                    <button type="button" className={btnSecondary} onClick={() => printVisitBill(patient, visit)}>
                      Print bill
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
