import { useAuth } from '../context/AuthContext';
import type { PatientRecord, StaffAccount, VisitRecord } from '../workflow/types';

export default function PrintReceiptButton({
  visit,
  patient,
  compact = false,
  onView,
}: {
  visit: VisitRecord;
  patient?: PatientRecord;
  staff: StaffAccount[];
  compact?: boolean;
  onView: () => void;
}) {
  const { user } = useAuth();
  const paid = visit.orders.some((order) => order.paidAt);
  if (!user || !['CASHIER', 'ACCOUNTANT', 'ADMIN'].includes(user.role) || !paid || !patient) return null;

  return (
    <button
      type="button"
      onClick={onView}
      className={`rounded-lg border border-clinic-600 text-clinic-700 hover:bg-clinic-50 ${
        compact ? 'mt-2 px-3 py-1 text-xs' : 'mt-2 w-full py-2 text-sm'
      }`}
    >
      View / print PDF{visit.receiptNo ? ` ${visit.receiptNo}` : ''}
    </button>
  );
}
