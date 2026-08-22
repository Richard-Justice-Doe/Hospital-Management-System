import { useEffect, useState } from 'react';
import { useCare } from '../../context/CareContext';
import { btnPrimary, btnSecondary } from './adminUi';
import {
  createBackupRequest,
  downloadBackupRequest,
  listBackupsRequest,
  restoreBackupRequest,
} from '../../lib/server';
import { downloadText } from '../../workflow/his';

export default function AdminBackupsPage() {
  const { applyServerState } = useCare();
  const [rows, setRows] = useState<Array<{ id: string; created_at: string; reason: string }>>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    void listBackupsRequest()
      .then((res) => setRows(res.backups))
      .catch((err: Error) => setError(err.message));
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <section className="rounded-xl border bg-white p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-medium text-slate-900">Backups</h2>
          <p className="mt-1 text-sm text-slate-600">Shared hospital file copies. Automatic every 6 hours and every 25 saves.</p>
        </div>
        <button
          type="button"
          className={btnPrimary}
          onClick={() => {
            setError(null);
            void createBackupRequest('manual')
              .then((res) => {
                setRows(res.backups);
                setMessage('Backup saved.');
              })
              .catch((err: Error) => setError(err.message));
          }}
        >
          Save backup now
        </button>
      </div>
      {message && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>}
      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <ul className="mt-4 divide-y rounded-lg border">
        {rows.length === 0 && <li className="px-3 py-4 text-sm text-slate-500">No backups yet.</li>}
        {rows.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
            <span>
              {new Date(row.created_at).toLocaleString()} · {row.reason}
            </span>
            <span className="flex gap-2">
              <button
                type="button"
                className={btnSecondary}
                onClick={() => {
                  void downloadBackupRequest(row.id).then((res) =>
                    downloadText(`${row.id}.json`, JSON.stringify(res.state, null, 2), 'application/json'),
                  );
                }}
              >
                Download
              </button>
              <button
                type="button"
                className={btnSecondary}
                onClick={() => {
                  if (!window.confirm('Restore this backup to every signed-in desk?')) return;
                  void restoreBackupRequest(row.id).then((res) => {
                    applyServerState(res.state, res.version);
                    setMessage('Backup restored.');
                    refresh();
                  });
                }}
              >
                Restore
              </button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
