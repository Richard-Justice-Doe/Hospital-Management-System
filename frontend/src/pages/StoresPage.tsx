import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCare } from '../context/CareContext';
import { DEPARTMENT_LABELS } from '../workflow/catalog';
import {
  addStoreItem,
  isLowSupply,
  issueSupply,
  receivePurchase,
  receiveStoreStock,
} from '../workflow/supportDesks';
import type { Department } from '../workflow/types';
import { btnPrimary, btnSecondary, EmptyState, Field, inputClass } from './admin/adminUi';
import { DeskPage, PageHeader } from '../components/PageChrome';

const ISSUE_DEPTS = (Object.keys(DEPARTMENT_LABELS) as Department[]).filter((dept) => dept !== 'STORES' && dept !== 'PROCUREMENT' && dept !== 'IT');

export default function StoresPage() {
  const { user } = useAuth();
  const { state, updateCare } = useCare();
  const [issue, setIssue] = useState({ supplyId: state.supplies[0]?.id ?? '', quantity: 1, toDepartment: 'NURSING' as Department, note: '' });
  const [item, setItem] = useState({ name: '', quantity: 10, reorderAt: 4, vendorId: state.vendors[0]?.id ?? '' });
  const [receiveQty, setReceiveQty] = useState(1);
  const staffId = user?.id ?? 'staff-stores';
  const openPos = (state.purchaseOrders ?? []).filter((row) => row.status === 'ORDERED');

  return (
    <DeskPage className="space-y-4">
      <PageHeader
        title="Central stores"
        hint="Consumables and non-drug stock. Pharmacy keeps medicine on its own desk."
      />

      <section className="desk-panel p-5">
        <h2 className="font-medium text-slate-900">Stock</h2>
        {state.supplies.length === 0 ? (
          <div className="mt-3">
            <EmptyState title="No store items" hint="Add an item or receive a purchase order." />
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2">Item</th>
                  <th>Qty</th>
                  <th>Reorder</th>
                  <th>Vendor</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {state.supplies.map((row) => {
                  const vendor = state.vendors.find((item) => item.id === row.vendorId);
                  return (
                    <tr key={row.id} className={`border-t ${isLowSupply(row) ? 'bg-amber-50' : ''}`}>
                      <td className="py-2">{row.name}</td>
                      <td>{row.quantity}</td>
                      <td>{row.reorderAt}</td>
                      <td>{vendor?.name ?? '—'}</td>
                      <td>
                        <button
                          type="button"
                          className="text-sm text-clinic-700"
                          onClick={() => updateCare((next) => receiveStoreStock(next, row.id, receiveQty))}
                        >
                          Receive {receiveQty}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-3 max-w-xs">
          <Field label="Receive quantity">
            <input className={inputClass} type="number" min={1} value={receiveQty} onChange={(e) => setReceiveQty(Number(e.target.value) || 1)} />
          </Field>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <form
          className="space-y-3 desk-panel p-5"
          onSubmit={(e) => {
            e.preventDefault();
            updateCare((next) =>
              issueSupply(next, {
                ...issue,
                quantity: Number(issue.quantity) || 0,
                issuedBy: staffId,
              }),
            );
          }}
        >
          <h2 className="font-medium text-slate-900">Issue to a department</h2>
          <Field label="Item">
            <select className={inputClass} value={issue.supplyId} onChange={(e) => setIssue({ ...issue, supplyId: e.target.value })}>
              {state.supplies.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name} ({row.quantity})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Quantity">
            <input className={inputClass} type="number" min={1} value={issue.quantity} onChange={(e) => setIssue({ ...issue, quantity: Number(e.target.value) || 1 })} />
          </Field>
          <Field label="Department">
            <select className={inputClass} value={issue.toDepartment} onChange={(e) => setIssue({ ...issue, toDepartment: e.target.value as Department })}>
              {ISSUE_DEPTS.map((dept) => (
                <option key={dept} value={dept}>
                  {DEPARTMENT_LABELS[dept]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Note">
            <input className={inputClass} value={issue.note} onChange={(e) => setIssue({ ...issue, note: e.target.value })} />
          </Field>
          <button type="submit" className={btnPrimary}>
            Issue stock
          </button>
        </form>

        <form
          className="space-y-3 desk-panel p-5"
          onSubmit={(e) => {
            e.preventDefault();
            updateCare((next) => addStoreItem(next, item));
            setItem({ ...item, name: '' });
          }}
        >
          <h2 className="font-medium text-slate-900">Add store item</h2>
          <Field label="Name">
            <input className={inputClass} value={item.name} onChange={(e) => setItem({ ...item, name: e.target.value })} required />
          </Field>
          <Field label="Quantity">
            <input className={inputClass} type="number" min={0} value={item.quantity} onChange={(e) => setItem({ ...item, quantity: Number(e.target.value) || 0 })} />
          </Field>
          <Field label="Reorder at">
            <input className={inputClass} type="number" min={0} value={item.reorderAt} onChange={(e) => setItem({ ...item, reorderAt: Number(e.target.value) || 0 })} />
          </Field>
          <Field label="Vendor">
            <select className={inputClass} value={item.vendorId} onChange={(e) => setItem({ ...item, vendorId: e.target.value })}>
              {state.vendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.name}
                </option>
              ))}
            </select>
          </Field>
          <button type="submit" className={btnSecondary}>
            Save item
          </button>
        </form>
      </section>

      <section className="desk-panel p-5">
        <h2 className="font-medium text-slate-900">Goods received from procurement</h2>
        {openPos.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No purchase orders waiting at the store.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {openPos.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2">
                <span>
                  {row.poNo} · {row.itemName} × {row.quantity} for {DEPARTMENT_LABELS[row.department]}
                </span>
                <button type="button" className={btnPrimary} onClick={() => updateCare((next) => receivePurchase(next, row.id, staffId))}>
                  Receive
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="desk-panel p-5">
        <h2 className="font-medium text-slate-900">Recent issues</h2>
        <ul className="mt-3 space-y-1 text-sm text-slate-700">
          {(state.storeIssues ?? []).slice(0, 12).map((row) => {
            const supply = state.supplies.find((item) => item.id === row.supplyId);
            return (
              <li key={row.id}>
                {row.quantity} × {supply?.name ?? row.supplyId} → {DEPARTMENT_LABELS[row.toDepartment]} · {new Date(row.at).toLocaleString()}
              </li>
            );
          })}
        </ul>
      </section>
    </DeskPage>
  );
}
