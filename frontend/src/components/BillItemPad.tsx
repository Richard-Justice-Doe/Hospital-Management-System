import { useMemo, useRef, useState, type ReactNode } from 'react';
import { btnPrimary, inputClass } from '../pages/admin/adminUi';
import { DEPARTMENT_LABELS, formatGhs } from '../workflow/catalog';
import { billLineQty, billLineUnitPrice } from '../workflow/billing';
import type { Department, HospitalService, ServiceOrder } from '../workflow/types';

export type DraftBillLine = {
  key: string;
  serviceId: string;
  name: string;
  unitPriceGhs: number;
  qty: number;
  subtotal: number;
};

function roundMoney(amount: number) {
  return Math.round(amount * 100) / 100;
}

export function draftFromService(service: HospitalService, qty: number): DraftBillLine {
  const units = Math.max(1, Math.floor(qty) || 1);
  return {
    key: `draft-${Date.now()}-${service.id}`,
    serviceId: service.id,
    name: service.name,
    unitPriceGhs: service.priceGhs,
    qty: units,
    subtotal: roundMoney(service.priceGhs * units),
  };
}

export default function BillItemPad({
  services,
  enabled,
  draft,
  savedLines,
  onDraftChange,
  emptyHint,
  leftOfTotal,
}: {
  services: HospitalService[];
  enabled: boolean;
  draft: DraftBillLine[];
  savedLines?: ServiceOrder[];
  onDraftChange: (lines: DraftBillLine[]) => void;
  emptyHint?: string;
  leftOfTotal?: ReactNode;
}) {
  const [itemQuery, setItemQuery] = useState('');
  const [picked, setPicked] = useState<HospitalService | null>(null);
  const [qty, setQty] = useState('1');
  const [open, setOpen] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const qtyValue = Math.max(1, Math.floor(Number(qty)) || 1);
  const unitPrice = picked?.priceGhs ?? 0;
  const subtotal = picked ? roundMoney(unitPrice * qtyValue) : 0;
  const catalog = useMemo(() => services.filter((service) => service.enabled), [services]);
  const itemMatches = useMemo(() => {
    const q = (picked ? '' : itemQuery).trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter(
      (service) =>
        service.name.toLowerCase().includes(q) ||
        DEPARTMENT_LABELS[service.department].toLowerCase().includes(q) ||
        String(service.priceGhs).includes(q),
    );
  }, [catalog, itemQuery, picked]);
  const grouped = useMemo(() => {
    const groups: Array<{ department: Department; label: string; items: HospitalService[] }> = [];
    for (const service of itemMatches) {
      const last = groups[groups.length - 1];
      if (last && last.department === service.department) {
        last.items.push(service);
      } else {
        groups.push({ department: service.department, label: DEPARTMENT_LABELS[service.department], items: [service] });
      }
    }
    return groups;
  }, [itemMatches]);
  const tableLines = [
    ...(savedLines ?? [])
      .filter((order) => order.chargeable !== false)
      .map((order) => ({
        key: order.id,
        name: order.name,
        unit: billLineUnitPrice(order),
        qty: billLineQty(order),
        subtotal: order.priceGhs,
        saved: true,
        paid: Boolean(order.paidAt),
      })),
    ...draft.map((line) => ({
      key: line.key,
      name: line.name,
      unit: line.unitPriceGhs,
      qty: line.qty,
      subtotal: line.subtotal,
      saved: false,
      paid: false,
    })),
  ];
  const total = tableLines.reduce((sum, line) => sum + line.subtotal, 0);

  function pickService(service: HospitalService) {
    setPicked(service);
    setItemQuery(service.name);
    setOpen(false);
  }

  function addItem() {
    if (!picked || !enabled) return;
    onDraftChange([...draft, draftFromService(picked, qtyValue)]);
    setItemQuery('');
    setPicked(null);
    setQty('1');
    setOpen(false);
  }

  return (
    <div className="space-y-3">
      <div className="grid items-end gap-2 md:grid-cols-[minmax(0,1.6fr)_7rem_5rem_7rem_auto]">
        <label className="relative text-sm font-medium text-slate-700">
          Item
          <input
            value={picked?.name ?? itemQuery}
            onChange={(e) => {
              setItemQuery(e.target.value);
              setPicked(null);
              setOpen(true);
            }}
            onFocus={() => {
              if (!enabled) return;
              window.clearTimeout(blurTimer.current);
              setOpen(true);
            }}
            onBlur={() => {
              blurTimer.current = window.setTimeout(() => setOpen(false), 150);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (picked) addItem();
                else if (itemMatches[0]) pickService(itemMatches[0]);
              }
              if (e.key === 'Escape') setOpen(false);
            }}
            placeholder="Item"
            className={`${inputClass} mt-1`}
            disabled={!enabled}
            autoComplete="off"
            aria-label="Item"
            aria-expanded={open}
            aria-controls="bill-item-list"
          />
          {enabled && open && (
            <ul
              id="bill-item-list"
              role="listbox"
              aria-label="Services"
              className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-lg border bg-white shadow-lg"
            >
              {itemMatches.length === 0 ? (
                <li className="px-3 py-2 text-sm text-slate-500">No matching service.</li>
              ) : (
                grouped.map((group) => (
                  <li key={group.department}>
                    <p className="sticky top-0 bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {group.label}
                    </p>
                    <ul>
                      {group.items.map((service) => (
                        <li key={service.id}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={picked?.id === service.id}
                            className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-clinic-50"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => pickService(service)}
                          >
                            <span>{service.name}</span>
                            <span className="shrink-0 font-mono text-xs font-semibold text-clinic-800">{formatGhs(service.priceGhs)}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))
              )}
            </ul>
          )}
        </label>
        <label className="text-sm font-medium text-slate-700">
          Price
          <input readOnly value={picked ? picked.priceGhs.toFixed(2) : ''} placeholder="price" className={`${inputClass} mt-1 bg-slate-100`} />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Qty
          <input
            inputMode="numeric"
            value={qty}
            onChange={(e) => setQty(e.target.value.replace(/[^\d]/g, ''))}
            placeholder="qty"
            className={`${inputClass} mt-1`}
            disabled={!enabled}
          />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Sub Total
          <input readOnly value={picked ? subtotal.toFixed(2) : ''} placeholder="subtotal" className={`${inputClass} mt-1 bg-slate-100`} />
        </label>
        <button type="button" className={`${btnPrimary} h-10`} disabled={!picked || !enabled} onClick={addItem}>
          Add
        </button>
      </div>
      {!enabled ? (
        <p className="text-sm text-slate-500">Enter the folder number first, then click Item to choose a service and its price.</p>
      ) : null}
      <div className="overflow-hidden rounded-lg border">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 text-left">
              <th className="border-b px-3 py-2 font-semibold">Service Name</th>
              <th className="border-b px-3 py-2 font-semibold">Price</th>
              <th className="border-b px-3 py-2 font-semibold">Qty</th>
              <th className="border-b px-3 py-2 text-right font-semibold">SubTotal</th>
              <th className="w-10 border-b px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {tableLines.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-slate-400">
                  {emptyHint ?? ''}
                </td>
              </tr>
            ) : (
              tableLines.map((line) => (
                <tr key={line.key} className={line.saved ? '' : 'bg-amber-50'}>
                  <td className="border-b px-3 py-2">
                    {line.name}
                    {line.paid ? <span className="ml-2 text-xs text-emerald-700">paid</span> : null}
                  </td>
                  <td className="border-b px-3 py-2">{line.unit.toFixed(2)}</td>
                  <td className="border-b px-3 py-2">{line.qty}</td>
                  <td className="border-b px-3 py-2 text-right">{line.subtotal.toFixed(2)}</td>
                  <td className="border-b px-2 py-2 text-center">
                    {line.saved ? null : (
                      <button
                        type="button"
                        className="text-lg leading-none text-red-600 hover:text-red-800"
                        aria-label={`Remove ${line.name}`}
                        onClick={() => onDraftChange(draft.filter((item) => item.key !== line.key))}
                      >
                        ×
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="text-right text-lg font-semibold text-slate-800">Total : GH₵ {total > 0 ? total.toFixed(2) : ''}</p>
      {leftOfTotal ? <div>{leftOfTotal}</div> : null}
    </div>
  );
}
