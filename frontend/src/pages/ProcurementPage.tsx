import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCare } from '../context/CareContext';
import { DEPARTMENT_LABELS, formatGhs } from '../workflow/catalog';
import { isLowSupply, pharmacyRestockOrders, receivePurchase, requestPurchase, setPurchaseStatus } from '../workflow/supportDesks';
import type { Department } from '../workflow/types';
import { btnPrimary, btnSecondary, EmptyState, Field, inputClass } from './admin/adminUi';

export default function ProcurementPage() {
  const { user } = useAuth();
  const { state, updateCare } = useCare();
  const staffId = user?.id ?? 'staff-procurement';
  const [form, setForm] = useState({
    itemName: state.supplies.find((item) => isLowSupply(item))?.name ?? '',
    quantity: 10,
    vendorId: state.vendors[0]?.id ?? '',
    department: 'NURSING' as Department,
    note: '',
    amountGhs: '',
  });
  const orders = state.purchaseOrders ?? [];
  const pharmacyRequests = pharmacyRestockOrders(state);

  return (
    <div className="space-y-4 p-6">
      <div>
        <h1 className="text-xl font-semibold text-clinic-900">Procurement</h1>
        <p className="mt-1 text-sm text-slate-600">
          Raise a request — Accounts receives it as something to purchase. Then mark it ordered, and stores receives the goods.
        </p>
      </div>

      <section className="rounded-xl border border-red-100 bg-white p-5">
        <h2 className="font-medium text-slate-900">From pharmacy</h2>
        <p className="mt-1 text-sm text-slate-600">Pharmacists send empty or low medicines here as purchase requests.</p>
        {pharmacyRequests.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No pharmacy restock waiting.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {pharmacyRequests.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm">
                <div>
                  <p className="font-medium text-red-950">
                    {row.poNo} · {row.itemName} × {row.quantity}
                  </p>
                  <p className="text-xs text-red-800">
                    {row.status} · {row.note ?? 'Pharmacy restock'}
                    {row.amountGhs ? ` · ${formatGhs(row.amountGhs)}` : ''}
                    {row.accountsReceivedAt ? ' · Accounts has this' : ' · Sent to accounts'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {row.status === 'REQUESTED' && (
                    <button type="button" className={btnSecondary} onClick={() => updateCare((next) => setPurchaseStatus(next, row.id, 'ORDERED'))}>
                      Mark ordered
                    </button>
                  )}
                  <button type="button" className={btnPrimary} onClick={() => updateCare((next) => receivePurchase(next, row.id, staffId))}>
                    Receive into pharmacy
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border bg-white p-5">
        <h2 className="font-medium text-slate-900">Low stock in stores</h2>
        <ul className="mt-2 text-sm text-slate-700">
          {state.supplies.filter(isLowSupply).map((item) => (
            <li key={item.id}>
              {item.name}: {item.quantity} left (reorder at {item.reorderAt})
            </li>
          ))}
          {state.supplies.filter(isLowSupply).length === 0 ? <li>Nothing is below the reorder point.</li> : null}
        </ul>
      </section>

      <form
        className="grid gap-3 rounded-xl border bg-white p-5 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          updateCare((next) =>
            requestPurchase(next, {
              ...form,
              quantity: Number(form.quantity) || 0,
              amountGhs: Number(form.amountGhs) || undefined,
              requestedBy: staffId,
            }),
          );
          setForm({ ...form, note: '', amountGhs: '' });
        }}
      >
        <h2 className="font-medium text-slate-900 sm:col-span-2">New purchase request</h2>
        <Field label="Item">
          <input
            className={inputClass}
            list="store-items"
            value={form.itemName}
            onChange={(e) => setForm({ ...form, itemName: e.target.value })}
            required
          />
          <datalist id="store-items">
            {state.supplies.map((item) => (
              <option key={item.id} value={item.name} />
            ))}
          </datalist>
        </Field>
        <Field label="Quantity">
          <input className={inputClass} type="number" min={1} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) || 1 })} />
        </Field>
        <Field label="Vendor">
          <select className={inputClass} value={form.vendorId} onChange={(e) => setForm({ ...form, vendorId: e.target.value })}>
            {state.vendors.map((vendor) => (
              <option key={vendor.id} value={vendor.id}>
                {vendor.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Estimated cost (GHS)">
          <input
            className={inputClass}
            inputMode="decimal"
            value={form.amountGhs}
            onChange={(e) => setForm({ ...form, amountGhs: e.target.value })}
            placeholder="Sent to the accountant"
          />
        </Field>
        <Field label="For department">
          <select className={inputClass} value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value as Department })}>
            {(Object.keys(DEPARTMENT_LABELS) as Department[]).map((dept) => (
              <option key={dept} value={dept}>
                {DEPARTMENT_LABELS[dept]}
              </option>
            ))}
          </select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Note">
            <input className={inputClass} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </Field>
        </div>
        <button type="submit" className={btnPrimary}>
          Save request
        </button>
      </form>

      <section className="rounded-xl border bg-white p-5">
        <h2 className="font-medium text-slate-900">Purchase orders</h2>
        {orders.filter((row) => !pharmacyRequests.some((item) => item.id === row.id)).length === 0 ? (
          <div className="mt-3">
            <EmptyState title="No purchase orders" hint="Raise a request from the form above." />
          </div>
        ) : (
          <ul className="mt-3 space-y-2">
            {orders
              .filter((row) => !pharmacyRequests.some((item) => item.id === row.id))
              .map((row) => {
              const vendor = state.vendors.find((item) => item.id === row.vendorId);
              return (
                <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium">
                      {row.poNo} · {row.itemName} × {row.quantity}
                    </p>
                    <p className="text-xs text-slate-500">
                      {row.status} · {DEPARTMENT_LABELS[row.department]} · {vendor?.name ?? 'Vendor'}
                      {row.amountGhs ? ` · ${formatGhs(row.amountGhs)}` : ''}
                      {row.accountsReceivedAt ? ' · Accounts has this' : ' · Sent to accounts'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {row.status === 'REQUESTED' && (
                      <button type="button" className={btnSecondary} onClick={() => updateCare((next) => setPurchaseStatus(next, row.id, 'ORDERED'))}>
                        Mark ordered
                      </button>
                    )}
                    {(row.status === 'REQUESTED' || row.status === 'ORDERED') && (
                      <>
                        <button type="button" className={btnPrimary} onClick={() => updateCare((next) => receivePurchase(next, row.id, staffId))}>
                          Receive into stores
                        </button>
                        <button type="button" className={btnSecondary} onClick={() => updateCare((next) => setPurchaseStatus(next, row.id, 'CANCELLED'))}>
                          Cancel
                        </button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
