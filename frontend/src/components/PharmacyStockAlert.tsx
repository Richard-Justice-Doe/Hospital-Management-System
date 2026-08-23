import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCare } from '../context/CareContext';
import { lowStockItems, outOfStockItems, stockAlertKey } from '../workflow/pharmacyStock';
import { hasOpenPharmacyRestock, sendPharmacyRestockToProcurement } from '../workflow/supportDesks';
import type { DrugStockRecord } from '../workflow/types';

export default function PharmacyStockAlert({ stock }: { stock: DrugStockRecord[] }) {
  const { user } = useAuth();
  const { state, updateCare } = useCare();
  const empty = useMemo(() => outOfStockItems(stock), [stock]);
  const low = useMemo(() => lowStockItems(stock), [stock]);
  const key = useMemo(() => stockAlertKey(stock), [stock]);
  const alreadyQueued =
    empty.length > 0 && [...empty, ...low].every((item) => hasOpenPharmacyRestock(state, item.name));
  const [open, setOpen] = useState(empty.length > 0 && !alreadyQueued);
  const [sent, setSent] = useState(false);
  const justSent = useRef(false);

  useEffect(() => {
    if (empty.length === 0) {
      setOpen(false);
      setSent(false);
      justSent.current = false;
      return;
    }
    const dismissed = sessionStorage.getItem('cms-stock-alert');
    if (dismissed === key) {
      setOpen(false);
      return;
    }
    if (alreadyQueued && !justSent.current) {
      setOpen(false);
      return;
    }
    setOpen(true);
  }, [alreadyQueued, empty.length, key]);

  function dismiss() {
    sessionStorage.setItem('cms-stock-alert', key);
    setOpen(false);
  }

  function sendToProcurement() {
    justSent.current = true;
    updateCare((next) => sendPharmacyRestockToProcurement(next, { requestedBy: user?.id ?? 'staff-pharmacy' }));
    setSent(true);
  }

  if (!open || empty.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl" role="alertdialog" aria-labelledby="stock-alert-title">
        <p className="text-xs font-semibold uppercase tracking-wide text-red-700">Pharmacy alert</p>
        <h2 id="stock-alert-title" className="mt-1 text-lg font-semibold text-slate-900">
          {sent ? 'Sent to procurement' : 'Medicines out of stock'}
        </h2>
        {sent ? (
          <p className="mt-1 text-sm text-slate-600">
            The procurement officer now has purchase requests for these medicines. They can order and receive them from the procurement desk.
          </p>
        ) : (
          <p className="mt-1 text-sm text-slate-600">
            Reorder these items before dispensing. The queue will stay open, but these packs cannot go out.
          </p>
        )}
        <ul className="mt-4 divide-y rounded-lg border border-red-100 bg-red-50">
          {empty.map((item) => (
            <li key={item.id} className="px-3 py-2 text-sm text-red-900">
              <span className="font-medium">{item.name}</span>
              <span className="block text-xs text-red-700">0 on shelf · reorder at {item.reorderAt}</span>
            </li>
          ))}
        </ul>
        {low.length > 0 && (
          <div className="mt-4">
            <p className="text-sm font-medium text-amber-800">Also running low</p>
            <ul className="mt-2 text-sm text-amber-900">
              {low.map((item) => (
                <li key={item.id}>
                  {item.name}: {item.quantity} left (reorder at {item.reorderAt})
                </li>
              ))}
            </ul>
          </div>
        )}
        {sent ? (
          <button type="button" className="mt-5 w-full rounded-lg bg-clinic-600 py-2 text-sm font-medium text-white" onClick={dismiss}>
            Close
          </button>
        ) : (
          <div className="mt-5 grid gap-2">
            <button type="button" className="w-full rounded-lg bg-clinic-600 py-2 text-sm font-medium text-white" onClick={sendToProcurement}>
              Send to procurement
            </button>
            <button type="button" className="w-full rounded-lg border border-slate-300 bg-white py-2 text-sm font-medium text-slate-700" onClick={dismiss}>
              I will reorder later
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
