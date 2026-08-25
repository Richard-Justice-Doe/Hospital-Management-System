import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCare } from '../../context/CareContext';
import RecordSavedModal from '../../components/RecordSavedModal';
import { btnPrimary, inputClass } from '../admin/adminUi';
import { HISTORY_TABS, historyReportHtml, patientHistoryRows, type HistoryTab } from '../../workflow/medicalHistory';
import {
  folderDisplayName,
  patientAgeLabel,
  serviceTypeShort,
} from '../../workflow/patientAdmin';
import { printIdCard } from '../../workflow/printReceipt';
import { searchPatients } from '../../workflow/store';
import CashPatientForm, { emptyHisFolderForm, formFromPatient, inputFromHisForm, type HisFolderForm } from './CashPatientForm';

const PAGE_SIZE = 10;

function printHtml(title: string, html: string) {
  const win = window.open('', '_blank', 'noopener,noreferrer,width=720,height=900');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
}

export default function CashPatientRecordsPage() {
  const { user } = useAuth();
  const { state, createFolder, updateFolder } = useCare();
  const [params] = useSearchParams();
  const staffId = user?.id ?? 'staff-cashier';
  const [advance, setAdvance] = useState('');
  const [quick, setQuick] = useState('');
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<'list' | 'form' | 'history'>('list');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<HisFolderForm>(emptyHisFolderForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [historyTab, setHistoryTab] = useState<HistoryTab>('opd');
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  const filtered = useMemo(() => {
    const needle = (advance || quick).trim();
    const list = needle ? searchPatients(state.patients.filter((p) => !p.mergedIntoId), needle) : state.patients.filter((p) => !p.mergedIntoId);
    return [...list].sort((a, b) => folderDisplayName(a).localeCompare(folderDisplayName(b)));
  }, [advance, quick, state.patients]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pages - 1);
  const visible = filtered.slice(safePage * pageSize, safePage * pageSize + pageSize);
  const selected = state.patients.find((item) => item.id === selectedId);
  const historyRows = selected ? patientHistoryRows(state, selected.id, historyTab) : [];
  const tabLabel = HISTORY_TABS.find((tab) => tab.id === historyTab)?.label ?? 'OPD History';

  function openNew() {
    setEditingId(null);
    setForm(emptyHisFolderForm());
    setFormError(null);
    setMode('form');
  }

  function openEdit(patientId: string) {
    const patient = state.patients.find((item) => item.id === patientId);
    if (!patient) return;
    setEditingId(patient.id);
    setForm(formFromPatient(patient));
    setFormError(null);
    setMode('form');
  }

  function saveForm(next: HisFolderForm) {
    const input = inputFromHisForm(next, staffId);
    if (typeof input === 'string') {
      setFormError(input);
      return;
    }
    if (editingId) {
      const result = updateFolder(editingId, input);
      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      setSaved(result.patient?.hospitalNo ?? next.lastName);
    } else {
      const result = createFolder(input);
      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      setSaved(result.hospitalNo);
    }
    setMode('list');
  }

  useEffect(() => {
    const editId = params.get('edit');
    if (editId) {
      openEdit(editId);
      return;
    }
    if (params.get('new')) openNew();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open once from the URL
  }, [params]);

  if (mode === 'form') {
    return (
      <div>
        {saved && <RecordSavedModal kind="folder" patientName={saved} onClose={() => setSaved(null)} />}
        <CashPatientForm
          initial={form}
          error={formError}
          lockIdentifiers={Boolean(editingId)}
          onSave={saveForm}
          onClose={() => setMode('list')}
        />
      </div>
    );
  }

  if (mode === 'history') {
    return (
      <section className="desk-panel p-5">
        <h2 className="text-center text-lg font-semibold uppercase tracking-wide text-slate-700">Patient medical history</h2>
        <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(16rem,20rem)_1fr]">
          <div>
            <div className="flex gap-2">
              <input value={quick} onChange={(e) => setQuick(e.target.value)} placeholder="Search" className={inputClass} />
              <button type="button" className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white">
                Search
              </button>
            </div>
            <div className="mt-3 overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left">
                    <th className="px-2 py-2">Folder No.</th>
                    <th className="px-2 py-2">Patient Name</th>
                    <th className="w-8 px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 12).map((person) => (
                    <tr key={person.id} className={person.id === selectedId ? 'bg-sky-50' : ''}>
                      <td className="border-t px-2 py-2 font-mono text-xs">{person.hospitalNo}</td>
                      <td className="border-t px-2 py-2">{folderDisplayName(person)}</td>
                      <td className="border-t px-2 py-2">
                        <input type="checkbox" checked={person.id === selectedId} onChange={() => setSelectedId(person.id)} aria-label={`Select ${person.firstName} ${person.lastName}`} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div>
            <div className="flex flex-wrap gap-2 border-b pb-2">
              {HISTORY_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setHistoryTab(tab.id)}
                  className={`px-2 py-1 text-xs font-semibold uppercase ${historyTab === tab.id ? 'border-b-2 border-emerald-600 text-emerald-700' : 'text-slate-500'}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="mt-3 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
              disabled={!selected}
              onClick={() => selected && printHtml('Patient medical history', historyReportHtml(selected, tabLabel, historyRows))}
            >
              Print Report
            </button>
            {selected ? (
              <div className="mt-4 text-sm">
                <p><span className="font-semibold">Patient Name:</span> {folderDisplayName(selected)}</p>
                <p><span className="font-semibold">Record No:</span> {selected.hospitalNo}</p>
                <p><span className="font-semibold">Gender:</span> {selected.gender}</p>
                <p><span className="font-semibold">Age:</span> {patientAgeLabel(selected)}</p>
                <p><span className="font-semibold">Service Type:</span> {serviceTypeShort(selected)}</p>
                <p><span className="font-semibold">Location:</span> {selected.town || selected.district || selected.address || '—'}</p>
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">Select a folder to view history.</p>
            )}
            <table className="mt-4 w-full border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 text-left">
                  <th className="border px-2 py-2">Date</th>
                  <th className="border px-2 py-2">Description</th>
                  <th className="border px-2 py-2">Details</th>
                </tr>
              </thead>
              <tbody>
                {historyRows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="border px-3 py-6 text-center text-slate-500">
                      No records on this tab.
                    </td>
                  </tr>
                ) : (
                  historyRows.map((row) => (
                    <tr key={row.id}>
                      <td className="border px-2 py-2">{row.date}</td>
                      <td className="border px-2 py-2 font-medium">{row.description}</td>
                      <td className="border px-2 py-2">{row.details}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <button type="button" className="mt-4 text-sm font-medium text-clinic-700" onClick={() => setMode('list')}>
              Back to patient records
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="desk-panel p-5">
      {saved && <RecordSavedModal kind="folder" patientName={saved} onClose={() => setSaved(null)} />}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold uppercase tracking-wide text-slate-700">Patient records</h2>
        <p className="text-xs text-slate-500">Patient Administration › Form › Patient Records</p>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" className={btnPrimary} onClick={openNew}>
          + Add New Patient
        </button>
        <div className="flex min-w-[16rem] flex-1 gap-2">
          <input value={advance} onChange={(e) => { setAdvance(e.target.value); setPage(0); }} placeholder="advance search" className={inputClass} />
          <button type="button" className={btnPrimary}>
            Search
          </button>
        </div>
        <button
          type="button"
          className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-300"
          disabled={!selected}
          onClick={() => selected && printIdCard(selected)}
        >
          Print Patient Card
        </button>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
        <label>
          Show{' '}
          <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }} className="rounded border px-2 py-1">
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>{' '}
          entries
        </label>
        <label>
          Search:{' '}
          <input value={quick} onChange={(e) => { setQuick(e.target.value); setPage(0); }} className="rounded border px-2 py-1" />
        </label>
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[70rem] border-collapse text-sm">
          <thead>
            <tr className="bg-slate-100 text-left">
              {['Patient Name', 'Record No.', 'Reg. Date', 'Insurance', 'Insurance No', 'Age', 'Gender', 'Phone Number', 'Entered By', 'Edit', ''].map((label) => (
                <th key={label || 'select'} className="border px-2 py-2 font-semibold">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((person, index) => {
              const worker = state.staff.find((item) => item.id === person.folderCreatedBy);
              return (
                <tr key={person.id} className={index % 2 ? 'bg-slate-50' : ''}>
                  <td className="border px-2 py-2">
                    <button type="button" className="text-left font-medium" onClick={() => { setSelectedId(person.id); setMode('history'); }}>
                      {folderDisplayName(person)}
                    </button>
                  </td>
                  <td className="border px-2 py-2 font-mono text-xs">{person.hospitalNo}</td>
                  <td className="border px-2 py-2">{(person.folderCreatedAt || person.createdAt).slice(0, 10)}</td>
                  <td className="border px-2 py-2">{serviceTypeShort(person)}</td>
                  <td className="border px-2 py-2">{person.insuranceNumber || person.hinNumber || '—'}</td>
                  <td className="border px-2 py-2">{patientAgeLabel(person)}</td>
                  <td className="border px-2 py-2">{person.gender}</td>
                  <td className="border px-2 py-2">{person.phone}</td>
                  <td className="border px-2 py-2">{worker ? `${worker.firstName} ${worker.lastName}`.toUpperCase() : '—'}</td>
                  <td className="border px-2 py-2">
                    <button
                      type="button"
                      className="rounded bg-emerald-600 px-2 py-1 text-xs font-semibold text-white"
                      onClick={() => openEdit(person.id)}
                      aria-label={`Edit folder for ${person.firstName} ${person.lastName}`}
                    >
                      Edit
                    </button>
                  </td>
                  <td className="border px-2 py-2">
                    <input type="checkbox" checked={selectedId === person.id} onChange={() => setSelectedId(person.id)} aria-label={`Select ${person.firstName} ${person.lastName}`} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
        <p>
          Showing {filtered.length === 0 ? 0 : safePage * pageSize + 1} to {Math.min(filtered.length, (safePage + 1) * pageSize)} of {filtered.length} entries
        </p>
        <div className="flex flex-wrap gap-1">
          <button type="button" className="rounded border px-2 py-1 disabled:opacity-50" disabled={safePage === 0} onClick={() => setPage((n) => Math.max(0, n - 1))}>
            Previous
          </button>
          {Array.from({ length: pages }, (_, i) => i).slice(0, 5).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setPage(n)}
              className={`rounded px-2 py-1 ${n === safePage ? 'bg-emerald-600 text-white' : 'border'}`}
            >
              {n + 1}
            </button>
          ))}
          <button type="button" className="rounded border px-2 py-1 disabled:opacity-50" disabled={safePage >= pages - 1} onClick={() => setPage((n) => n + 1)}>
            Next
          </button>
        </div>
      </div>
    </section>
  );
}
