import ActionPrompt, { type PromptKind } from './ActionPrompt';

export default function RecordSavedModal({
  title: _title,
  kind,
  patientName,
  detail,
  destinations,
  nextLabel,
  onNext,
  onClose,
  secondaryLabel,
  onSecondary,
}: {
  title?: string;
  detail?: string;
  kind?: PromptKind;
  patientName?: string;
  destinations?: PromptKind[];
  nextLabel?: string;
  onNext?: () => void;
  onClose: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  return (
    <ActionPrompt
      kind={kind}
      patientName={patientName}
      detail={detail}
      destinations={destinations}
      nextLabel={nextLabel}
      onNext={onNext}
      secondaryLabel={secondaryLabel}
      onSecondary={onSecondary}
      onClose={onClose}
    />
  );
}
