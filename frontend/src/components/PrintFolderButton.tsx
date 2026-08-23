import { printFolderCover, printIdCard } from '../workflow/printReceipt';
import type { PatientRecord } from '../workflow/types';

export default function PrintFolderButton({ patient }: { patient: PatientRecord }) {
  return (
    <span className="flex flex-wrap gap-3">
      <button
        type="button"
        onClick={() => printIdCard(patient)}
        className="text-sm font-medium text-clinic-700 hover:underline"
      >
        Print ID card
      </button>
      <button
        type="button"
        onClick={() => printFolderCover(patient)}
        className="text-sm font-medium text-clinic-700 hover:underline"
      >
        Print folder cover
      </button>
    </span>
  );
}
