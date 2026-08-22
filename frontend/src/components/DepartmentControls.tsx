import { DEPARTMENT_LABELS, formatGhs } from '../workflow/catalog';
import { unpaidOrders } from '../workflow/billing';
import type { Department, HospitalService, PatientRecord, VisitRecord } from '../workflow/types';
import PatientIdentity from './PatientIdentity';

export function RemoveBillButton({
  onClick,
  disabled = false,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
    >
      Remove bill
    </button>
  );
}

export function DepartmentServicesPanel({
  department,
  services,
  onToggle,
  onPrice,
}: {
  department: Department;
  services: HospitalService[];
  onToggle: (serviceId: string, enabled: boolean) => void;
  onPrice: (serviceId: string, priceGhs: number) => void;
}) {
  const items = services.filter((service) => service.department === department);
  if (items.length === 0) return null;
  return (
    <section className="rounded-xl border bg-white p-5">
      <h2 className="font-medium text-slate-900">Department services</h2>
      <ul className="mt-3 divide-y rounded-lg border border-slate-100">
        {items.map((service) => (
          <li key={service.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5">
            <div>
              <p className="font-medium text-slate-800">{service.name}</p>
              <p className="text-xs text-slate-500">{service.enabled ? 'Available to order' : 'Hidden'}</p>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1 text-sm text-slate-600">
                GH₵
                <input
                  type="number"
                  min={0}
                  defaultValue={service.priceGhs}
                  key={`${service.id}-${service.priceGhs}`}
                  onBlur={(e) => {
                    const next = Number(e.target.value);
                    if (!Number.isNaN(next) && next !== service.priceGhs) onPrice(service.id, next);
                  }}
                  className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                  aria-label={`Price for ${service.name}`}
                />
              </label>
              <button
                type="button"
                role="switch"
                aria-checked={service.enabled}
                aria-label={`${service.enabled ? 'Turn off' : 'Turn on'} ${service.name}`}
                onClick={() => onToggle(service.id, !service.enabled)}
                className={`relative h-7 w-12 rounded-full ${service.enabled ? 'bg-clinic-600' : 'bg-slate-300'}`}
              >
                <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white ${service.enabled ? 'left-5' : 'left-0.5'}`} />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function DepartmentBillsPanel({
  department,
  visits,
  patients,
  onRemove,
}: {
  department: Department | 'ALL';
  visits: VisitRecord[];
  patients: Array<Pick<PatientRecord, 'id' | 'firstName' | 'lastName' | 'hospitalNo'>>;
  onRemove: (visitId: string, orderId: string) => void;
}) {
  const scope = department === 'ALL' ? 'ALL' : [department];
  const rows = visits.flatMap((visit) => unpaidOrders(visit, scope).map((order) => ({ visit, order })));
  const label = department === 'ALL' ? 'every department' : DEPARTMENT_LABELS[department].toLowerCase();
  return (
    <section className="rounded-xl border border-red-100 bg-white p-5">
      <h2 className="font-medium text-slate-900">Remove bill</h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">No unpaid {label} bills.</p>
      ) : (
        <ul className="mt-3 divide-y rounded-lg border border-slate-100">
          {rows.map(({ visit, order }) => {
            const patient = patients.find((item) => item.id === visit.patientId);
            return (
              <li key={order.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5">
                <div>
                  <PatientIdentity patient={patient} extra={` — ${order.name}`} />
                  <p className="text-xs text-slate-500">
                    {DEPARTMENT_LABELS[order.department]} · {formatGhs(order.priceGhs)} unpaid
                  </p>
                </div>
                <RemoveBillButton onClick={() => onRemove(visit.id, order.id)} />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
