import { printFolderCover } from '../workflow/printReceipt';
import type { PatientRecord } from '../workflow/types';

export default function PrintFolderButton({ patient }: { patient: PatientRecord }) {
  return (
    <button
      type="button"
      onClick={() => printFolderCover(patient)}
      className="text-sm font-medium text-clinic-700 hover:underline"
    >
      Print folder cover
    </button>
  );
}
