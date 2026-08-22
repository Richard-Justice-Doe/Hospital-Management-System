import DepartmentQueuePage from './DepartmentQueuePage';
import LabPage from './LabPage';
import { InventoryPage } from './HisOpsPages';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCare } from '../context/CareContext';
import { DepartmentBillsPanel } from '../components/DepartmentControls';
import { canControlDepartment } from '../workflow/types';

export default function PharmacyPage() {
  const { user } = useAuth();
  const { state, removeFromBill } = useCare();
  const [tab, setTab] = useState<'queue' | 'stock'>('queue');
  const isHead = canControlDepartment(user, 'PHARMACY');
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
      {tab === 'queue' ? (
        <DepartmentQueuePage department="PHARMACY" title="Pharmacy" />
      ) : (
        <>
          {isHead && (
            <div className="p-6 pb-0">
              <DepartmentBillsPanel department="ALL" visits={state.visits} patients={state.patients} onRemove={removeFromBill} />
            </div>
          )}
          <InventoryPage />
        </>
      )}
    </div>
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
