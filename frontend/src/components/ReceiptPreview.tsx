import { useRef } from 'react';
import { downloadReceiptsPdf } from '../workflow/receiptsPdf';
import { receiptsDocumentHtml, type ReceiptCopy } from '../workflow/printReceipt';

export default function ReceiptPreview({
  copies,
  title,
  onClose,
}: {
  copies: ReceiptCopy[];
  title: string;
  onClose: () => void;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const html = receiptsDocumentHtml(copies);

  function printCopies() {
    const frame = frameRef.current?.contentWindow;
    if (frame) {
      frame.focus();
      frame.print();
      return;
    }
    const win = window.open('', '_blank', 'noopener,noreferrer,width=520,height=760');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col rounded-2xl bg-white">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-clinic-900">{title}</h2>
            <p className="mt-1 text-sm text-slate-600">
              {copies.length} receipt{copies.length === 1 ? '' : 's'}. View below, print, or download the PDF.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={printCopies} className="rounded-lg bg-clinic-600 px-3 py-1.5 text-sm font-medium text-white">
              Print
            </button>
            <button
              type="button"
              onClick={() => downloadReceiptsPdf(copies)}
              className="rounded-lg border border-clinic-600 px-3 py-1.5 text-sm font-medium text-clinic-700 hover:bg-clinic-50"
            >
              Download PDF
            </button>
            <button type="button" onClick={onClose} className="rounded-lg border px-3 py-1.5 text-sm hover:bg-slate-50">
              Close
            </button>
          </div>
        </div>
        <iframe ref={frameRef} title={title} srcDoc={html} className="min-h-[28rem] w-full flex-1 rounded-b-2xl bg-slate-100" />
      </div>
    </div>
  );
}
