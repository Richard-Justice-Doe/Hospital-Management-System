import LabPage from './LabPage';
import DepartmentQueuePage from './DepartmentQueuePage';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCare } from '../context/CareContext';
import PatientIdentity from '../components/PatientIdentity';
import { StageBadge } from '../components/StageBadge';
import { RemoveBillButton } from '../components/DepartmentControls';
import PharmacyStockAlert from '../components/PharmacyStockAlert';
import DepartmentShiftPanel from '../components/DepartmentShiftPanel';
import RecordSavedModal from '../components/RecordSavedModal';
import { DEPARTMENT_LABELS, formatGhs } from '../workflow/catalog';
import { isLowStock, isOutOfStock } from '../workflow/pharmacyStock';
import { unpaidOrders } from '../workflow/billing';
import { ordersForDepartment } from '../workflow/store';
import { dispenseStock } from '../workflow/his';
import { canControlDepartment } from '../workflow/types';
import type { ControlledLogRecord, DrugStockRecord, HospitalService, PatientRecord, ServiceOrder, VisitRecord } from '../workflow/types';

const th = 'border border-slate-200 bg-slate-50 px-3 py-2 text-left font-semibold';
const td = 'border border-slate-200 px-3 py-2 align-top';

function stockForOrder(stock: DrugStockRecord[], serviceId: string) {
  return stock.find((item) => item.serviceId === serviceId && !item.controlled) ?? stock.find((item) => item.serviceId === serviceId);
}

function stockStatus(item?: DrugStockRecord) {
  if (!item) return <span className="text-xs text-slate-500">No shelf record</span>;
  if (isOutOfStock(item)) return <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">Out of stock</span>;
  if (isLowStock(item)) return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">Low · {item.quantity} left</span>;
  return <span className="text-xs text-slate-600">{item.quantity} on shelf</span>;
}

function billStatus(order: ServiceOrder) {
  if (order.chargeable === false) return 'Not billed';
  if (order.paidAt) return `Paid ${formatGhs(order.priceGhs)}`;
  return `Unpaid ${formatGhs(order.priceGhs)}`;
}

export default function PharmacyPage() {
  const { user } = useAuth();
  const { state, finishOrder, addToBill, removeFromBill, toggleService, updatePrice, updateCare } = useCare();
  const [tab, setTab] = useState<'queue' | 'stock'>('queue');
  const [prompt, setPrompt] = useState<{ name: string } | null>(null);
  const isHead = canControlDepartment(user, 'PHARMACY');
  const queue = ordersForDepartment(state.visits, 'PHARMACY');
  const bills = state.visits.flatMap((visit) => unpaidOrders(visit, ['PHARMACY']).map((order) => ({ visit, order })));
  const services = state.services.filter((service) => service.department === 'PHARMACY');
  const staffId = user?.id ?? 'staff-pharmacy';

  return (
    <div>
      <div className="flex gap-2 border-b px-6 pt-4">
        <button type="button" className={`px-3 py-2 text-sm ${tab === 'queue' ? 'border-b-2 border-clinic-600 font-medium' : 'text-slate-600'}`} onClick={() => setTab('queue')}>
          Dispense queue
        </button>
        <button type="button" className={`px-3 py-2 text-sm ${tab === 'stock' ? 'border-b-2 border-clinic-600 font-medium' : 'text-slate-600'}`} onClick={() => setTab('stock')}>
          Inventory
        </button>
      </div>
      <PharmacyStockAlert stock={state.drugStock} />
      {prompt && (
        <RecordSavedModal
          kind="sent_accounts"
          patientName={prompt.name}
          detail={`${DEPARTMENT_LABELS.PHARMACY}: Medicine is ready. If they have not paid, send them to Accounts.`}
          onClose={() => setPrompt(null)}
        />
      )}

      {tab === 'queue' ? (
        <div className="space-y-5 p-6">
          <div>
            <h1 className="text-xl font-semibold text-clinic-900">Pharmacy</h1>
            <p className="mt-1 text-sm text-slate-500">Verify the prescription, check the shelf, then dispense and label.</p>
          </div>
          <DepartmentShiftPanel department="PHARMACY" />
          <QueueTable
            queue={queue}
            patients={state.patients}
            stock={state.drugStock}
            services={services}
            isHead={isHead}
            onAdd={addToBill}
            onRemove={removeFromBill}
            onDispense={(visit, order, name) => {
              finishOrder(visit.id, order.id, 'Completed');
              setPrompt({ name });
            }}
          />
        </div>
      ) : (
        <div className="space-y-5 p-6">
          <div>
            <h1 className="text-xl font-semibold text-clinic-900">Pharmacy inventory</h1>
            <p className="mt-1 text-sm text-slate-600">
              Medicines on this desk.{' '}
              <Link className="text-clinic-700 hover:underline" to="/care/stores">
                Open stores
              </Link>
              {' · '}
              <Link className="text-clinic-700 hover:underline" to="/care/procurement">
                Open procurement
              </Link>
            </p>
          </div>
          {isHead && <BillsTable rows={bills} patients={state.patients} onRemove={removeFromBill} />}
          <StockTable
            stock={state.drugStock ?? []}
            onDispense={(item) =>
              updateCare((next) =>
                dispenseStock(next, {
                  serviceId: item.serviceId,
                  quantity: 1,
                  visitId: next.visits[0]?.id ?? '',
                  staffId,
                  witness: 'staff-nurse',
                }),
              )
            }
          />
          {(state.controlledLog ?? []).length > 0 && <ControlledTable rows={state.controlledLog} stock={state.drugStock ?? []} patients={state.patients} visits={state.visits} />}
          {isHead && <ServicesTable services={services} onToggle={toggleService} onPrice={updatePrice} />}
        </div>
      )}
    </div>
  );
}

function QueueTable({
  queue,
  patients,
  stock,
  services,
  isHead,
  onAdd,
  onRemove,
  onDispense,
}: {
  queue: Array<{ visit: VisitRecord; order: ServiceOrder }>;
  patients: PatientRecord[];
  stock: DrugStockRecord[];
  services: HospitalService[];
  isHead: boolean;
  onAdd: (visitId: string, serviceIds: string[]) => void;
  onRemove: (visitId: string, orderId: string) => void;
  onDispense: (visit: VisitRecord, order: ServiceOrder, name: string) => void;
}) {
  return (
    <section className="overflow-x-auto rounded-xl border bg-white">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className={th}>Patient</th>
            <th className={th}>Medicine</th>
            <th className={th}>Prescription</th>
            <th className={th}>Stock</th>
            <th className={th}>Bill</th>
            <th className={th}>Status</th>
            <th className={th}>Action</th>
          </tr>
        </thead>
        <tbody>
          {queue.length === 0 ? (
            <tr>
              <td className={`${td} text-slate-500`} colSpan={7}>
                No pending medicines to dispense.
              </td>
            </tr>
          ) : (
            queue.map(({ visit, order }) => {
              const patient = patients.find((item) => item.id === visit.patientId);
              const name = patient ? `${patient.firstName} ${patient.lastName}` : 'Patient';
              const extras = services.filter(
                (service) => service.enabled && !visit.orders.some((item) => item.serviceId === service.id),
              );
              return (
                <tr key={order.id}>
                  <td className={td}>
                    <PatientIdentity patient={patient} />
                    <p className="mt-1 text-xs text-slate-500">{visit.diagnosis ?? visit.reason}</p>
                  </td>
                  <td className={td}>
                    <p className="font-medium">{order.name}</p>
                  </td>
                  <td className={td}>{visit.prescription || '—'}</td>
                  <td className={td}>{stockStatus(stockForOrder(stock, order.serviceId))}</td>
                  <td className={td}>{billStatus(order)}</td>
                  <td className={td}>
                    <StageBadge stage={visit.stage} />
                  </td>
                  <td className={td}>
                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => onDispense(visit, order, name)}
                        className="rounded-lg bg-clinic-600 px-3 py-1.5 text-sm font-medium text-white"
                      >
                        Dispense — send to pay
                      </button>
                      {isHead && order.chargeable !== false && !order.paidAt && (
                        <RemoveBillButton onClick={() => onRemove(visit.id, order.id)} />
                      )}
                      {extras.length > 0 && (
                        <select
                          className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                          defaultValue=""
                          onChange={(e) => {
                            if (e.target.value) {
                              onAdd(visit.id, [e.target.value]);
                              e.target.value = '';
                            }
                          }}
                        >
                          <option value="">Add medicine…</option>
                          {extras.map((service) => (
                            <option key={service.id} value={service.id}>
                              {service.name} · {formatGhs(service.priceGhs)}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </section>
  );
}

function BillsTable({
  rows,
  patients,
  onRemove,
}: {
  rows: Array<{ visit: VisitRecord; order: ServiceOrder }>;
  patients: PatientRecord[];
  onRemove: (visitId: string, orderId: string) => void;
}) {
  return (
    <section className="overflow-x-auto rounded-xl border border-red-100 bg-white">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className={th} colSpan={4}>
              Remove unpaid pharmacy bills
            </th>
          </tr>
          <tr>
            <th className={th}>Patient</th>
            <th className={th}>Medicine</th>
            <th className={th}>Amount</th>
            <th className={th}>Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className={`${td} text-slate-500`} colSpan={4}>
                No unpaid pharmacy bills.
              </td>
            </tr>
          ) : (
            rows.map(({ visit, order }) => (
              <tr key={order.id}>
                <td className={td}>
                  <PatientIdentity patient={patients.find((item) => item.id === visit.patientId)} />
                </td>
                <td className={td}>{order.name}</td>
                <td className={td}>{formatGhs(order.priceGhs)}</td>
                <td className={td}>
                  <RemoveBillButton onClick={() => onRemove(visit.id, order.id)} />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}

function StockTable({ stock, onDispense }: { stock: DrugStockRecord[]; onDispense: (item: DrugStockRecord) => void }) {
  return (
    <section className="overflow-x-auto rounded-xl border bg-white">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className={th}>Medicine</th>
            <th className={th}>Class</th>
            <th className={th}>On shelf</th>
            <th className={th}>Reorder at</th>
            <th className={th}>Status</th>
            <th className={th}>Expires</th>
            <th className={th}>Action</th>
          </tr>
        </thead>
        <tbody>
          {stock.length === 0 ? (
            <tr>
              <td className={`${td} text-slate-500`} colSpan={7}>
                No medicines on the pharmacy shelf.
              </td>
            </tr>
          ) : (
            stock.map((item) => (
              <tr key={item.id} className={isOutOfStock(item) ? 'bg-red-50' : isLowStock(item) ? 'bg-amber-50' : ''}>
                <td className={td}>
                  {item.name}
                  {item.controlled ? <span className="ml-2 text-xs text-red-700">Controlled</span> : null}
                </td>
                <td className={`${td} capitalize`}>{item.drugClass}</td>
                <td className={td}>{item.quantity}</td>
                <td className={td}>{item.reorderAt}</td>
                <td className={td}>{stockStatus(item)}</td>
                <td className={td}>{item.expiresOn}</td>
                <td className={td}>
                  <button
                    type="button"
                    disabled={isOutOfStock(item)}
                    className="text-clinic-700 hover:underline disabled:cursor-not-allowed disabled:text-slate-400"
                    onClick={() => onDispense(item)}
                  >
                    Dispense 1
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}

function ControlledTable({
  rows,
  stock,
  patients,
  visits,
}: {
  rows: ControlledLogRecord[];
  stock: DrugStockRecord[];
  patients: PatientRecord[];
  visits: VisitRecord[];
}) {
  return (
    <section className="overflow-x-auto rounded-xl border bg-white">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className={th}>Controlled log</th>
            <th className={th}>Patient</th>
            <th className={th}>Qty</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const visit = visits.find((item) => item.id === row.visitId);
            const patient = patients.find((item) => item.id === visit?.patientId);
            return (
              <tr key={row.id}>
                <td className={td}>{stock.find((item) => item.id === row.stockId)?.name ?? row.stockId}</td>
                <td className={td}>
                  <PatientIdentity patient={patient} />
                </td>
                <td className={td}>{row.quantity}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

function ServicesTable({
  services,
  onToggle,
  onPrice,
}: {
  services: HospitalService[];
  onToggle: (serviceId: string, enabled: boolean) => void;
  onPrice: (serviceId: string, priceGhs: number) => void;
}) {
  if (services.length === 0) return null;
  return (
    <section className="overflow-x-auto rounded-xl border bg-white">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className={th}>Pharmacy service</th>
            <th className={th}>Price</th>
            <th className={th}>Available</th>
          </tr>
        </thead>
        <tbody>
          {services.map((service) => (
            <tr key={service.id}>
              <td className={td}>{service.name}</td>
              <td className={td}>
                <label className="flex items-center gap-1">
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
              </td>
              <td className={td}>
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
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export { LabPage };

export function XrayPage() {
  return <DepartmentQueuePage department="RADIOLOGY" title="X-ray / imaging" />;
}

export function PhysioPage() {
  return <DepartmentQueuePage department="PHYSIO" title="Physiotherapy" />;
}

export function EyePage() {
  return <DepartmentQueuePage department="EYE" title="Eye clinic" />;
}

export function EntPage() {
  return <DepartmentQueuePage department="ENT" title="ENT clinic" />;
}

export function DentalPage() {
  return <DepartmentQueuePage department="DENTAL" title="Dental clinic" />;
}

export function MaternityPage() {
  return <DepartmentQueuePage department="MATERNITY" title="Maternity / ANC" />;
}
