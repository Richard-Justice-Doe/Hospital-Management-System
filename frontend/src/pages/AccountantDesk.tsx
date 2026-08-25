import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AccountantMoneyDesk from '../components/AccountantMoneyDesk';
import PatientIdentity from '../components/PatientIdentity';
import PrintReceiptButton from '../components/PrintReceiptButton';
import { printVisitReceipt } from '../workflow/printReceipt';
import { useAuth } from '../context/AuthContext';
import { useCare } from '../context/CareContext';
import { DEPARTMENT_LABELS, formatGhs } from '../workflow/catalog';
import { downloadAccountantClaimsExcel } from '../workflow/claimsExcel';
import {
  agingSummary,
  addBankTxn,
  canSeeClinicalFinance,
  cashPosition,
  decideFinanceAdjust,
  EXPENSE_LABELS,
  financeDashboard,
  invoiceRows,
  invoiceStatus,
  lockFinancePeriod,
  matchBankTxn,
  payerReconciliation,
  periodIsLocked,
  profitAndLoss,
  progressVendorInvoice,
  REASON_LABELS,
  requestFinanceAdjust,
  resubmitClaim,
  revenueByDepartment,
  saveEob,
  savePaymentPlan,
  savePreAuth,
  saveVendorInvoice,
  staffCostByDepartment,
  threeWayMatch,
} from '../workflow/finance';
import { downloadFinancePackCsv, downloadInvoicesCsv, downloadPayrollCsv } from '../workflow/financeExport';
import { CLAIM_STATUS_LABEL, claimsForAccountantCash, purchasesForAccountant, receiveClaimRemittance, receivePurchaseForAccounts, visitClaimAmount } from '../workflow/supportDesks';
import { payAmountTowardBill } from '../workflow/store';
import { moneyPeriod } from '../workflow/accounts';
import type { ExpenseCategory, FinanceAdjustKind, FinanceReasonCode, PayMethod } from '../workflow/types';
import { btnPrimary, btnSecondary, Field, inputClass } from './admin/adminUi';
import { DeskPage, DeskTabs, PageHeader } from '../components/PageChrome';

const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'billing', label: 'Billing' },
  { id: 'payments', label: 'Payments' },
  { id: 'claims', label: 'Insurance' },
  { id: 'payables', label: 'Payables' },
  { id: 'payroll', label: 'Payroll' },
  { id: 'reports', label: 'Reports' },
  { id: 'reconcile', label: 'Reconcile' },
  { id: 'audit', label: 'Audit' },
] as const;

type TabId = (typeof TABS)[number]['id'];

function Card({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <article className="desk-panel p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-clinic-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </article>
  );
}

export default function AccountantDesk() {
  const { user } = useAuth();
  const { state, updateCare } = useCare();
  const staffId = user?.id ?? 'staff-accountant';
  const role = user?.role;
  const seeClinical = canSeeClinicalFinance(role);
  const [params, setParams] = useSearchParams();
  const tab = (TABS.some((item) => item.id === params.get('tab')) ? params.get('tab') : 'dashboard') as TabId;
  const dash = useMemo(() => financeDashboard(state), [state]);
  const invoices = useMemo(() => invoiceRows(state), [state]);
  const [invoiceQ, setInvoiceQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const shownInvoices = invoices.filter((row) => {
    if (statusFilter && row.status !== statusFilter) return false;
    const q = invoiceQ.trim().toLowerCase();
    if (!q) return true;
    return `${row.patientName} ${row.hospitalNo} ${row.payer} ${row.clinic}`.toLowerCase().includes(q);
  });
  const selectedInvoice = shownInvoices[0];

  function setTab(next: TabId) {
    const copy = new URLSearchParams(params);
    copy.set('tab', next);
    setParams(copy);
  }

  return (
    <DeskPage>
      <PageHeader
        title="Accounts — money books"
        hint="Financial work only. Clinical notes stay with the clinical team."
        actions={
          <button type="button" className={btnSecondary} onClick={() => downloadFinancePackCsv(state)}>
            Export finance pack
          </button>
        }
      />

      <div className="mt-4">
        <DeskTabs items={[...TABS]} value={tab} onChange={(id) => setTab(id as TabId)} />
      </div>

      {tab === 'dashboard' && (
        <div className="mt-6 space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Card label="Revenue today" value={formatGhs(dash.revenue.day)} hint={`Target ${formatGhs(dash.targets.day)}`} />
            <Card label="Revenue MTD" value={formatGhs(dash.revenue.month)} hint={`Target ${formatGhs(dash.targets.month)}`} />
            <Card label="Revenue YTD" value={formatGhs(dash.revenue.year)} hint={`Target ${formatGhs(dash.targets.year)}`} />
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            <Card label="Allocated" value={formatGhs(dash.books.allocated)} />
            <Card label="Spent" value={formatGhs(dash.books.spent)} />
            <Card label="Remaining" value={formatGhs(dash.books.remaining)} />
            <Card label="Outstanding AR" value={formatGhs(dash.outstanding)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            {(['0-30', '31-60', '61-90', '90+'] as const).map((bucket) => (
              <Card key={bucket} label={`Aging ${bucket}`} value={formatGhs(dash.aging[bucket].amount)} hint={`${dash.aging[bucket].count} bills`} />
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Card label="Claims pending" value={String(dash.claims.waitingPay)} hint="Submitted, awaiting remittance" />
            <Card label="Claims denied" value={String(dash.claims.denied)} />
            <Card label="Claims remitted" value={String(dash.claims.paid)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Card label="Cash drawer today" value={formatGhs(dash.cash.drawer)} />
            <Card label="Bank / cash position" value={formatGhs(dash.cash.bank)} hint={`${dash.cash.unmatched} unmatched bank lines`} />
          </div>
          <section className="desk-panel p-5">
            <h2 className="font-semibold">Alerts</h2>
            {dash.alerts.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">No finance alerts.</p>
            ) : (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900">
                {dash.alerts.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {tab === 'billing' && (
        <BillingTab
          state={state}
          shownInvoices={shownInvoices}
          invoiceQ={invoiceQ}
          setInvoiceQ={setInvoiceQ}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          seeClinical={seeClinical}
          staffId={staffId}
          role={role}
          onChange={updateCare}
        />
      )}

      {tab === 'payments' && (
        <PaymentsTab state={state} staffId={staffId} role={role} onChange={updateCare} invoices={invoices} />
      )}

      {tab === 'claims' && (
        <ClaimsTab state={state} staffId={staffId} onChange={updateCare} />
      )}

      {tab === 'payables' && <PayablesTab state={state} staffId={staffId} onChange={updateCare} />}

      {tab === 'payroll' && (
        <div className="mt-6 space-y-4">
          <div className="flex justify-end">
            <button type="button" className={btnSecondary} onClick={() => downloadPayrollCsv(state)}>
              Export payroll CSV
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {staffCostByDepartment(state).map((row) => (
              <Card key={row.label} label={row.label} value={formatGhs(row.paid + row.due)} hint={`Paid ${formatGhs(row.paid)} · due ${formatGhs(row.due)}`} />
            ))}
          </div>
          <AccountantMoneyDesk state={state} staffId={staffId} onChange={updateCare} />
        </div>
      )}

      {tab === 'reports' && <ReportsTab state={state} />}

      {tab === 'reconcile' && <ReconcileTab state={state} staffId={staffId} onChange={updateCare} />}

      {tab === 'audit' && <AuditTab state={state} staffId={staffId} onChange={updateCare} />}

      {selectedInvoice && periodIsLocked(state, selectedInvoice.date) ? (
        <p className="sr-only">Period locked</p>
      ) : null}
    </DeskPage>
  );
}

function BillingTab({
  state,
  shownInvoices,
  invoiceQ,
  setInvoiceQ,
  statusFilter,
  setStatusFilter,
  seeClinical,
  staffId,
  role,
  onChange,
}: {
  state: ReturnType<typeof useCare>['state'];
  shownInvoices: ReturnType<typeof invoiceRows>;
  invoiceQ: string;
  setInvoiceQ: (value: string) => void;
  statusFilter: string;
  setStatusFilter: (value: string) => void;
  seeClinical: boolean;
  staffId: string;
  role?: import('../workflow/types').StaffRole;
  onChange: ReturnType<typeof useCare>['updateCare'];
}) {
  const [picked, setPicked] = useState(shownInvoices[0]?.visit.id ?? '');
  const row = shownInvoices.find((item) => item.visit.id === picked) ?? shownInvoices[0];
  const [kind, setKind] = useState<FinanceAdjustKind>('DISCOUNT');
  const [amount, setAmount] = useState('');
  const [code, setCode] = useState<FinanceReasonCode>('HARDSHIP');
  const [reason, setReason] = useState('');
  const patient = row ? state.patients.find((item) => item.id === row.visit.patientId) : undefined;

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap gap-2">
        <input className={`${inputClass} max-w-sm`} value={invoiceQ} onChange={(e) => setInvoiceQ(e.target.value)} placeholder="Search patient, folder, payer, clinic" />
        <select className={inputClass} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {['Open', 'Partial', 'Paid', 'Voided', 'Not billed'].map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <button type="button" className={btnSecondary} onClick={() => downloadInvoicesCsv(state)}>
          Export invoices
        </button>
      </div>
      <Field label="Invoice">
        <select className={inputClass} size={8} value={row?.visit.id ?? ''} onChange={(e) => setPicked(e.target.value)}>
          {shownInvoices.map((item) => (
            <option key={item.visit.id} value={item.visit.id}>
              {item.patientName} · {item.hospitalNo} · {item.status} · {formatGhs(item.due)} due
            </option>
          ))}
        </select>
      </Field>
      {row && (
        <section className="desk-panel p-5">
          <div className="flex flex-wrap justify-between gap-2">
            <div>
              <PatientIdentity patient={patient} extra={` · ${row.payer}`} />
              <p className="mt-1 text-sm text-slate-600">
                {row.clinic} · {invoiceStatus(row.visit)} · {formatGhs(row.total)} · due {formatGhs(row.due)}
              </p>
              {seeClinical ? (
                <p className="text-xs text-slate-500">{row.visit.diagnosis ?? row.visit.reason}</p>
              ) : (
                <p className="text-xs text-slate-500">Service lines only — diagnosis is hidden.</p>
              )}
            </div>
            {patient && (
              <PrintReceiptButton
                visit={row.visit}
                patient={patient}
                staff={state.staff}
                onView={() => printVisitReceipt({ patient, visit: row.visit, receivedBy: 'Accounts' })}
              />
            )}
          </div>
          <table className="mt-4 w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="border px-2 py-1">Code / service</th>
                <th className="border px-2 py-1">Dept</th>
                <th className="border px-2 py-1 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {row.visit.orders.map((order) => (
                <tr key={order.id}>
                  <td className="border px-2 py-1">{order.serviceId} · {order.name}</td>
                  <td className="border px-2 py-1">{DEPARTMENT_LABELS[order.department]}</td>
                  <td className="border px-2 py-1 text-right">{order.chargeable === false ? 'waived' : formatGhs(order.priceGhs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 grid gap-2 sm:grid-cols-4">
            <select className={inputClass} value={kind} onChange={(e) => setKind(e.target.value as FinanceAdjustKind)}>
              <option value="DISCOUNT">Discount</option>
              <option value="WRITE_OFF">Write-off</option>
              <option value="VOID">Void invoice</option>
              <option value="REFUND">Refund</option>
            </select>
            <input className={inputClass} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount GHS" />
            <select className={inputClass} value={code} onChange={(e) => setCode(e.target.value as FinanceReasonCode)}>
              {Object.entries(REASON_LABELS).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
            <input className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (kept on audit)" />
          </div>
          <button
            type="button"
            className={`${btnPrimary} mt-3`}
            onClick={() => {
              onChange((current) =>
                requestFinanceAdjust(current, {
                  visitId: row.visit.id,
                  kind,
                  amountGhs: Number(amount) || row.due || 1,
                  reasonCode: code,
                  reason,
                  staffId,
                  role,
                }),
              );
              setAmount('');
              setReason('');
            }}
          >
            Post adjustment
          </button>
        </section>
      )}
    </div>
  );
}

function PaymentsTab({
  state,
  staffId,
  role,
  onChange,
  invoices,
}: {
  state: ReturnType<typeof useCare>['state'];
  staffId: string;
  role?: import('../workflow/types').StaffRole;
  onChange: ReturnType<typeof useCare>['updateCare'];
  invoices: ReturnType<typeof invoiceRows>;
}) {
  const owing = invoices.filter((row) => row.due > 0 && row.status !== 'Voided');
  const [visitId, setVisitId] = useState(owing[0]?.visit.id ?? '');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PayMethod>('BANK');
  const [planNote, setPlanNote] = useState('');
  const row = owing.find((item) => item.visit.id === visitId) ?? owing[0];
  const aging = agingSummary(state);
  const pending = (state.financeAdjustments ?? []).filter((item) => item.status === 'PENDING');

  return (
    <div className="mt-6 space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        {(['0-30', '31-60', '61-90', '90+'] as const).map((bucket) => (
          <Card key={bucket} label={bucket} value={formatGhs(aging[bucket].amount)} hint={`${aging[bucket].count} open`} />
        ))}
      </div>
      <section className="desk-panel p-5">
        <h2 className="font-semibold">Record a payment</h2>
        <p className="mt-1 text-sm text-slate-500">Cash stays with the cashier. Accounts can post MoMo, card, NHIS, or bank.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <select className={inputClass} value={row?.visit.id ?? ''} onChange={(e) => setVisitId(e.target.value)}>
            {owing.map((item) => (
              <option key={item.visit.id} value={item.visit.id}>
                {item.patientName} · {formatGhs(item.due)}
              </option>
            ))}
          </select>
          <input className={inputClass} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount now" />
          <select className={inputClass} value={method} onChange={(e) => setMethod(e.target.value as PayMethod)}>
            <option value="BANK">Bank transfer</option>
            <option value="MOMO">Mobile money</option>
            <option value="CARD">Card</option>
            <option value="NHIS">NHIS</option>
            {role === 'ADMIN' || role === 'CASHIER' ? <option value="CASH">Cash</option> : null}
          </select>
          <button
            type="button"
            className={btnPrimary}
            onClick={() => {
              if (!row) return;
              const part = Number(amount) || row.due;
              onChange((current) => payAmountTowardBill(current, row.visit.id, part, staffId, method));
              setAmount('');
            }}
          >
            Post payment
          </button>
        </div>
        {row && (
          <div className="mt-4 flex flex-wrap gap-2">
            <input className={`${inputClass} max-w-xs`} value={planNote} onChange={(e) => setPlanNote(e.target.value)} placeholder="Payment plan note" />
            <button type="button" className={btnSecondary} onClick={() => onChange((current) => savePaymentPlan(current, row.visit.id, 3, planNote, staffId))}>
              Save 3-part plan
            </button>
          </div>
        )}
      </section>
      <section className="desk-panel p-5">
        <h2 className="font-semibold">Refunds and write-offs awaiting approval</h2>
        {(state.financeAdjustments ?? []).length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">None yet.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {(state.financeAdjustments ?? []).slice(0, 12).map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2">
                <span>
                  {item.kind} · {formatGhs(item.amountGhs)} · {item.status} · {item.reason}
                </span>
                {item.status === 'PENDING' && role === 'ADMIN' && (
                  <span className="flex gap-2">
                    <button type="button" className={btnPrimary} onClick={() => onChange((current) => decideFinanceAdjust(current, item.id, true, staffId))}>
                      Approve
                    </button>
                    <button type="button" className={btnSecondary} onClick={() => onChange((current) => decideFinanceAdjust(current, item.id, false, staffId))}>
                      Deny
                    </button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        {pending.length > 0 && role !== 'ADMIN' ? <p className="mt-2 text-xs text-amber-800">Refunds of {formatGhs(200)} or more need an admin co-sign.</p> : null}
      </section>
    </div>
  );
}

function ClaimsTab({
  state,
  staffId,
  onChange,
}: {
  state: ReturnType<typeof useCare>['state'];
  staffId: string;
  onChange: ReturnType<typeof useCare>['updateCare'];
}) {
  const claims = claimsForAccountantCash(state);
  const recon = payerReconciliation(state);
  const [eobPaid, setEobPaid] = useState('');
  const [authRef, setAuthRef] = useState('');

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btnSecondary} onClick={() => downloadAccountantClaimsExcel(state)}>
          Download claims Excel
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {Object.entries(recon).map(([payer, row]) => (
          <Card
            key={payer}
            label={`${payer} reconciliation`}
            value={formatGhs(row.remitted)}
            hint={`Billed ${formatGhs(row.billed)} · submitted ${formatGhs(row.submitted)} · denied ${formatGhs(row.denied)}`}
          />
        ))}
      </div>
      <section className="desk-panel p-5">
        <h2 className="font-semibold">Claims queue</h2>
        <ul className="mt-3 space-y-2">
          {claims.map((row) => (
            <li key={row.visit.id} className="rounded-xl border px-3 py-3 text-sm">
              <p className="font-medium">
                {row.claim?.claimNo} · {row.patient ? `${row.patient.firstName} ${row.patient.lastName}` : 'Unknown'} · {formatGhs(row.claim?.amountGhs ?? visitClaimAmount(row.visit))}
              </p>
              <p className="text-xs text-slate-500">
                {CLAIM_STATUS_LABEL[row.claim?.status ?? 'DRAFT']} · CC {row.visit.nhisCcCode ?? '—'}
                {row.claim?.denialReason ? ` · ${row.claim.denialReason}` : ''}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {!row.claim?.accountsReceivedAt && (
                  <button type="button" className={btnPrimary} onClick={() => onChange((current) => receiveClaimRemittance(current, row.visit.id, staffId))}>
                    Receive remittance
                  </button>
                )}
                {row.claim?.status === 'DENIED' && (
                  <button type="button" className={btnSecondary} onClick={() => onChange((current) => resubmitClaim(current, row.visit.id, staffId))}>
                    Resubmit
                  </button>
                )}
                {row.claim && (
                  <button
                    type="button"
                    className={btnSecondary}
                    onClick={() =>
                      onChange((current) =>
                        saveEob(current, {
                          claimId: row.claim!.id,
                          amountGhs: row.claim!.amountGhs,
                          paidGhs: Number(eobPaid) || row.claim!.amountGhs,
                          ref: `EOB-${row.claim!.claimNo}`,
                          staffId,
                        }),
                      )
                    }
                  >
                    Match EOB
                  </button>
                )}
                <button
                  type="button"
                  className={btnSecondary}
                  onClick={() =>
                    onChange((current) =>
                      savePreAuth(current, { visitId: row.visit.id, payer: row.scheme, ref: authRef || `PA-${row.visit.id.slice(-4)}`, status: 'APPROVED', staffId }),
                    )
                  }
                >
                  Record pre-auth
                </button>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input className={inputClass} value={eobPaid} onChange={(e) => setEobPaid(e.target.value)} placeholder="EOB paid amount" />
          <input className={inputClass} value={authRef} onChange={(e) => setAuthRef(e.target.value)} placeholder="Pre-auth reference" />
        </div>
      </section>
    </div>
  );
}

function PayablesTab({
  state,
  staffId,
  onChange,
}: {
  state: ReturnType<typeof useCare>['state'];
  staffId: string;
  onChange: ReturnType<typeof useCare>['updateCare'];
}) {
  const [form, setForm] = useState({ invoiceNo: '', vendorId: state.vendors[0]?.id ?? '', poId: '', amountGhs: '', category: 'OTHER' as ExpenseCategory, note: '' });
  const purchases = purchasesForAccountant(state);

  return (
    <div className="mt-6 space-y-4">
      <section className="desk-panel p-5">
        <h2 className="font-semibold">Things to purchase</h2>
        <ul className="mt-3 space-y-2">
          {purchases.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
              <span>
                {row.poNo} · {row.itemName} × {row.quantity} · {row.amountGhs ? formatGhs(row.amountGhs) : 'No cost yet'}
                {row.accountsReceivedAt ? ' · on the books' : ''}
              </span>
              {!row.accountsReceivedAt && (
                <button type="button" className={btnPrimary} onClick={() => onChange((current) => receivePurchaseForAccounts(current, row.id, staffId))}>
                  Receive request
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>
      <form
        className="grid gap-2 desk-panel p-5 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          onChange((current) =>
            saveVendorInvoice(current, {
              ...form,
              amountGhs: Number(form.amountGhs),
              poId: form.poId || undefined,
              staffId,
            }),
          );
          setForm({ ...form, invoiceNo: '', amountGhs: '', note: '' });
        }}
      >
        <h2 className="font-semibold sm:col-span-2">Vendor invoice</h2>
        <input className={inputClass} required value={form.invoiceNo} onChange={(e) => setForm({ ...form, invoiceNo: e.target.value })} placeholder="Vendor invoice no" />
        <select className={inputClass} value={form.vendorId} onChange={(e) => setForm({ ...form, vendorId: e.target.value })}>
          {state.vendors.map((vendor) => (
            <option key={vendor.id} value={vendor.id}>
              {vendor.name}
            </option>
          ))}
        </select>
        <select className={inputClass} value={form.poId} onChange={(e) => setForm({ ...form, poId: e.target.value })}>
          <option value="">No PO</option>
          {(state.purchaseOrders ?? []).map((row) => (
            <option key={row.id} value={row.id}>
              {row.poNo} · {row.itemName}
            </option>
          ))}
        </select>
        <input className={inputClass} inputMode="decimal" value={form.amountGhs} onChange={(e) => setForm({ ...form, amountGhs: e.target.value })} placeholder="Amount GHS" />
        <select className={inputClass} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as ExpenseCategory })}>
          {Object.entries(EXPENSE_LABELS).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
        <input className={inputClass} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Note" />
        <button type="submit" className={btnPrimary}>
          Save vendor invoice
        </button>
      </form>
      <section className="desk-panel p-5">
        <h2 className="font-semibold">3-way match</h2>
        <ul className="mt-3 space-y-2">
          {(state.vendorInvoices ?? []).map((invoice) => {
            const match = threeWayMatch(state, invoice.id);
            const vendor = state.vendors.find((item) => item.id === invoice.vendorId);
            return (
              <li key={invoice.id} className="rounded-lg border px-3 py-2 text-sm">
                <p>
                  {invoice.invoiceNo} · {vendor?.name} · {formatGhs(invoice.amountGhs)} · {invoice.status} · {EXPENSE_LABELS[invoice.category]}
                </p>
                <p className="text-xs text-slate-500">
                  PO {match.hasPo ? 'yes' : 'no'} · goods {match.goodsIn ? 'in' : 'pending'} · amount {match.amountOk ? 'matches' : 'check'}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {invoice.status === 'DRAFT' && (
                    <button type="button" className={btnSecondary} onClick={() => onChange((current) => progressVendorInvoice(current, invoice.id, staffId, 'MATCHED'))}>
                      Mark matched
                    </button>
                  )}
                  {invoice.status === 'MATCHED' && (
                    <button type="button" className={btnSecondary} onClick={() => onChange((current) => progressVendorInvoice(current, invoice.id, staffId, 'APPROVED'))}>
                      Approve payment
                    </button>
                  )}
                  {invoice.status === 'APPROVED' && (
                    <button type="button" className={btnPrimary} onClick={() => onChange((current) => progressVendorInvoice(current, invoice.id, staffId, 'PAID'))}>
                      Mark paid
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function ReportsTab({ state }: { state: ReturnType<typeof useCare>['state'] }) {
  const pnl = profitAndLoss(state);
  const cash = cashPosition(state);
  return (
    <div className="mt-6 space-y-4">
      <div className="flex justify-end">
        <button type="button" className={btnSecondary} onClick={() => downloadFinancePackCsv(state)}>
          Export P&L / budget CSV
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Card label="Income" value={formatGhs(pnl.income)} />
        <Card label="Expenses + VAT" value={formatGhs(pnl.expenses)} hint={`VAT 15% ${formatGhs(pnl.vat)}`} />
        <Card label="Surplus" value={formatGhs(pnl.surplus)} />
      </div>
      <section className="desk-panel p-5">
        <h2 className="font-semibold">Revenue by department</h2>
        <ul className="mt-2 text-sm">
          {revenueByDepartment(state).map((row) => (
            <li key={row.label}>
              {row.label}: {formatGhs(row.amountGhs)}
            </li>
          ))}
          {revenueByDepartment(state).length === 0 ? <li>No paid service lines yet.</li> : null}
        </ul>
      </section>
      <section className="desk-panel p-5">
        <h2 className="font-semibold">Cash flow / position</h2>
        <p className="mt-2 text-sm">
          Drawer {formatGhs(cash.drawer)} · Bank {formatGhs(cash.bank)} · Opening {formatGhs(cash.opening)}
        </p>
      </section>
    </div>
  );
}

function ReconcileTab({
  state,
  staffId,
  onChange,
}: {
  state: ReturnType<typeof useCare>['state'];
  staffId: string;
  onChange: ReturnType<typeof useCare>['updateCare'];
}) {
  const [amount, setAmount] = useState('');
  const [ref, setRef] = useState('');
  const [direction, setDirection] = useState<'IN' | 'OUT'>('IN');
  const closes = state.cashCloses ?? [];

  return (
    <div className="mt-6 space-y-4">
      <section className="desk-panel p-5">
        <h2 className="font-semibold">Bank ledger</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          <input className={inputClass} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount" />
          <input className={inputClass} value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Reference" />
          <select className={inputClass} value={direction} onChange={(e) => setDirection(e.target.value as 'IN' | 'OUT')}>
            <option value="IN">In</option>
            <option value="OUT">Out</option>
          </select>
          <button
            type="button"
            className={btnPrimary}
            onClick={() => {
              onChange((current) => addBankTxn(current, { amountGhs: Number(amount), direction, reference: ref, staffId }));
              setAmount('');
              setRef('');
            }}
          >
            Add bank line
          </button>
        </div>
        <ul className="mt-3 space-y-2 text-sm">
          {(state.bankTxns ?? []).map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2">
              <span>
                {row.direction} · {formatGhs(row.amountGhs)} · {row.reference}
                {row.matchedId ? ' · matched' : ' · unmatched'}
              </span>
              {!row.matchedId && state.visits.find((item) => item.receiptNo) && (
                <button
                  type="button"
                  className={btnSecondary}
                  onClick={() => onChange((current) => matchBankTxn(current, row.id, state.visits.find((item) => item.receiptNo)!.id, 'RECEIPT', staffId))}
                >
                  Match to a receipt
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>
      <section className="desk-panel p-5">
        <h2 className="font-semibold">Cash drawer closes</h2>
        {closes.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No drawer closes yet. The cashier locks the till on the cash unit.</p>
        ) : (
          closes.slice(0, 8).map((row) => (
            <p key={row.id} className="mt-2 text-sm">
              {row.date}: counted {formatGhs(row.counted)} · system {formatGhs(row.systemTotal)}
            </p>
          ))
        )}
      </section>
    </div>
  );
}

function AuditTab({
  state,
  staffId,
  onChange,
}: {
  state: ReturnType<typeof useCare>['state'];
  staffId: string;
  onChange: ReturnType<typeof useCare>['updateCare'];
}) {
  const period = moneyPeriod();
  const financeLog = (state.auditLog ?? []).filter((row) =>
    /void|discount|write|refund|adjust|vendor|bank|period|eob|preauth|claim|payment/i.test(row.action),
  );
  return (
    <div className="mt-6 space-y-4">
      <section className="desk-panel p-5">
        <h2 className="font-semibold">Period lock</h2>
        <p className="mt-1 text-sm text-slate-500">Locking {period} stops edits to that month’s books for external audit.</p>
        <button type="button" className={`${btnPrimary} mt-3`} onClick={() => onChange((current) => lockFinancePeriod(current, period, staffId))}>
          Lock {period}
        </button>
        <ul className="mt-3 text-sm">
          {(state.periodLocks ?? []).map((row) => (
            <li key={row.id}>
              Locked {row.period} · {new Date(row.lockedAt).toLocaleString()}
            </li>
          ))}
        </ul>
      </section>
      <section className="desk-panel p-5">
        <h2 className="font-semibold">Financial audit trail</h2>
        <p className="mt-1 text-sm text-slate-500">Who, what, when. Invoices are voided, never deleted.</p>
        <ul className="mt-3 max-h-96 space-y-2 overflow-auto text-sm">
          {financeLog.slice(0, 40).map((row) => {
            const who = state.staff.find((item) => item.id === row.staffId);
            return (
              <li key={row.id} className="rounded-lg border px-3 py-2">
                {new Date(row.at).toLocaleString()} · {who ? `${who.firstName} ${who.lastName}` : row.staffId} · {row.action}
                {row.reason ? ` · ${row.reason}` : ''}
              </li>
            );
          })}
          {financeLog.length === 0 ? <li>No finance audit rows yet.</li> : null}
        </ul>
      </section>
      <button type="button" className={btnSecondary} onClick={() => downloadFinancePackCsv(state)}>
        Export pack for the external auditor
      </button>
    </div>
  );
}
