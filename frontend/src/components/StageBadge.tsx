import { STAGE_LABELS, type VisitStage } from '../workflow/types';

const COLORS: Record<VisitStage, string> = {
  CHECKED_IN: 'bg-blue-100 text-blue-800',
  VITALS_DONE: 'bg-amber-100 text-amber-800',
  WITH_DOCTOR: 'bg-violet-100 text-violet-800',
  AWAITING_SERVICES: 'bg-orange-100 text-orange-800',
  READY_TO_BILL: 'bg-teal-100 text-teal-800',
  COMPLETED: 'bg-emerald-100 text-emerald-800',
};

export function StageBadge({ stage }: { stage: VisitStage }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${COLORS[stage]}`}>
      {STAGE_LABELS[stage]}
    </span>
  );
}
