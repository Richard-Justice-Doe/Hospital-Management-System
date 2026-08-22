import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import ClinicChat from './ClinicChat';

export default function ClinicAgentWidget() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const hidden = location.pathname.startsWith('/care/assistant');

  useEffect(() => {
    function onOpen() {
      setOpen(true);
    }
    window.addEventListener('cms-open-agent', onOpen);
    return () => window.removeEventListener('cms-open-agent', onOpen);
  }, []);

  if (hidden) return null;

  return (
    <div className="fixed bottom-5 right-5 z-40">
      {open && (
        <div className="mb-3 w-[min(24rem,calc(100vw-2.5rem))] rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-clinic-900">Clinic AI assistant</p>
              <p className="text-xs text-slate-500">Health, general knowledge, and this hospital’s live records.</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-2 py-1 text-xs text-slate-500 hover:bg-slate-100">
              Close
            </button>
          </div>
          <ClinicChat compact />
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="ml-auto flex h-12 items-center gap-2 rounded-full bg-clinic-600 px-4 text-sm font-medium text-white hover:bg-clinic-700"
      >
        {open ? 'Hide assistant' : 'Ask AI'}
      </button>
    </div>
  );
}
