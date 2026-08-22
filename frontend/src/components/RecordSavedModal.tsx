export default function RecordSavedModal({
  title = 'Record saved',
  detail,
  onClose,
  secondaryLabel,
  onSecondary,
}: {
  title?: string;
  detail?: string;
  onClose: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-labelledby="record-saved-title"
        className="w-full max-w-sm rounded-xl bg-white p-6 text-center shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm font-medium uppercase tracking-wide text-clinic-600">Saved</p>
        <h2 id="record-saved-title" className="mt-1 text-xl font-semibold text-clinic-900">
          {title}
        </h2>
        {detail && <p className="mt-2 text-sm text-slate-600">{detail}</p>}
        <div className="mt-5 flex flex-col gap-2">
          <button type="button" onClick={onClose} className="rounded-lg bg-clinic-600 py-2 text-sm font-medium text-white hover:bg-clinic-700">
            OK
          </button>
          {secondaryLabel && onSecondary && (
            <button type="button" onClick={onSecondary} className="rounded-lg border py-2 text-sm font-medium text-clinic-700">
              {secondaryLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
