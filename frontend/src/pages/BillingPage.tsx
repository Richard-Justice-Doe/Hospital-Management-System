import { useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCare } from '../context/CareContext';
import { StageBadge } from '../components/StageBadge';
import PatientIdentity from '../components/PatientIdentity';
import PrintReceiptButton from '../components/PrintReceiptButton';
import ReceiptPreview from '../components/ReceiptPreview';
import { collectionsSummary, unpaidOrders, visitBalance, type CollectionPeriod } from '../workflow/billing';
import { CLINIC_LABELS, formatGhs } from '../workflow/catalog';
import { insuranceLabel, isCashPrivatePatient } from '../workflow/patientAdmin';
import { paidReceipts, receiptFromVisit, type ReceiptCopy } from '../workflow/printReceipt';
import { canAccessPage } from '../workflow/permissions';
import { useStaffAccess } from '../hooks/useStaffAccess';

export default function BillingPage() {
  const { user } = useAuth();
  const { state, collectPayment } = useCare();
  const access = useStaffAccess();
  const staffId = user?.id ?? 'staff-cashier';
  const isAccountant = Boolean(user && (user.role === 'ACCOUNTANT' || user.role === 'ADMIN' || canAccessPage(access, 'collections')));
  const canCollect = Boolean(user && (user.role === 'CASHIER' || user.role === 'ADMIN' || canAccessPage(access, 'billing')));
  const queue = state.visits.filter((v) => v.stage !== 'COMPLETED' && unpaidOrders(v).length > 0);
  const [preview, setPreview] = useState<{ mode: CollectionPeriod | 'one'; visitId?: string } | null>(null);

  const totals = useMemo(() => collectionsSummary(state), [state]);
  const dayReceipts = useMemo(() => paidReceipts(state, 'day'), [state]);
  const monthReceipts = useMemo(() => paidReceipts(state, 'month'), [state]);
  const yearReceipts = useMemo(() => paidReceipts(state, 'year'), [state]);

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

  function receive(visitId: string) {
    collectPayment(visitId, staffId);
    setPreview({ mode: 'one', visitId });
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

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-clinic-900">
            {user?.role === 'ACCOUNTANT' ? 'Accounts — collections' : 'Accounts — receive payment'}
          </h1>
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

      {canCollect && (
        <ul className="mt-6 space-y-4">
          {queue.length === 0 && (
            <li className="rounded-xl border bg-white p-5 text-sm text-slate-500">No unpaid bills waiting.</li>
          )}
          {queue.map((v) => {
            const p = state.patients.find((x) => x.id === v.patientId);
            const total = visitBalance(v);
            return (
              <li key={v.id} className="rounded-xl border bg-white p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p>
                      <PatientIdentity patient={p} />
                    </p>
                    <p className="text-sm text-slate-600">
                      {CLINIC_LABELS[v.clinic ?? 'GENERAL']} · {v.diagnosis ?? v.reason}
                    </p>
                    {p && <p className="mt-1 text-xs text-slate-500">{insuranceLabel(p)}</p>}
                    {isCashPrivatePatient(p) && (
                      <p className="mt-1 text-xs font-medium text-amber-800">Private patient — collect the full cash bill.</p>
                    )}
                  </div>
                  <StageBadge stage={v.stage} />
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
                    {v.orders.map((o) => (
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
                <p className="mt-3 text-right text-base font-semibold">Amount due {formatGhs(total)}</p>
                <button
                  type="button"
                  onClick={() => receive(v.id)}
                  className="mt-3 w-full rounded-lg bg-clinic-600 py-2 text-sm text-white"
                >
                  Receive {formatGhs(total)}
                </button>
                <PrintReceiptButton visit={v} patient={p} staff={state.staff} onView={() => setPreview({ mode: 'one', visitId: v.id })} />
              </li>
            );
          })}
        </ul>
      )}

      <section className="mt-8">
        <h2 className="font-medium">Paid receipts today</h2>
        <ul className="mt-4 space-y-3">
          {dayReceipts.length === 0 && (
            <li className="rounded-xl border bg-white p-4 text-sm text-slate-500">No receipts paid today yet.</li>
          )}
          {dayReceipts.map((copy) => {
            const visit = state.visits.find((item) => item.id === copy.visitId);
            const patient = state.patients.find((item) => item.id === visit?.patientId);
            if (!visit) return null;
            return (
              <li key={`rcpt-${copy.visitId}`} className="rounded-xl border bg-white p-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <PatientIdentity patient={patient} />
                    <p className="text-xs text-slate-500">
                      {copy.receiptNo} · {copy.clinic} · {formatGhs(copy.paidTotal)}
                    </p>
                  </div>
                  <StageBadge stage={visit.stage} />
                </div>
                <PrintReceiptButton
                  visit={visit}
                  patient={patient}
                  staff={state.staff}
                  onView={() => setPreview({ mode: 'one', visitId: visit.id })}
                />
              </li>
            );
          })}
        </ul>
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
