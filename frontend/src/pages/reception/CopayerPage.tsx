import { useMemo, useState, type FormEvent } from 'react';
import { useCare } from '../../context/CareContext';
import PatientIdentity from '../../components/PatientIdentity';
import RecordSavedModal from '../../components/RecordSavedModal';
import { searchPatients } from '../../workflow/store';
import { COPAYER_RELATIONSHIPS } from '../../workflow/patientAdmin';
import type { CopayerRelationship } from '../../workflow/types';

const emptyForm = {
  firstName: '',
  lastName: '',
  relationship: 'Parent' as CopayerRelationship,
  phone: '',
  address: '',
  isPrimary: true,
};

export default function CopayerPage() {
  const { state, saveCopayer, removeCopayer, patientCopayers } = useCare();
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(state.patients[0]?.id ?? null);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const matches = useMemo(() => searchPatients(state.patients, query), [state.patients, query]);
  const selected = state.patients.find((p) => p.id === selectedId);
  const copayers = selected ? patientCopayers(selected.id) : [];

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selected) {
      setMessage('Select a patient first.');
      return;
    }
    saveCopayer({ ...form, patientId: selected.id, address: form.address || undefined });
    setForm(emptyForm);
    setSaved(`Co-payer saved for ${selected.firstName} ${selected.lastName}.`);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {saved && <RecordSavedModal kind="saved" detail={saved} onClose={() => setSaved(null)} />}
      <section className="rounded-xl border bg-white p-5">
        <h3 className="font-medium">Co-payer</h3>
        {message && <p className="mt-3 rounded-lg bg-clinic-50 px-3 py-2 text-sm text-clinic-700">{message}</p>}
        <input
          placeholder="Find patient by hospital number, name, or phone"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="mt-3 w-full rounded-lg border px-3 py-2 font-mono text-sm"
        />
        <ul className="mt-3 max-h-56 space-y-1 overflow-auto">
          {matches.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setSelectedId(p.id)}
                className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${selected?.id === p.id ? 'border-clinic-500 bg-clinic-50' : 'border-slate-100 hover:bg-slate-50'}`}
              >
                <PatientIdentity patient={p} extra={` · ${p.age}y`} />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border bg-white p-5">
        {selected ? (
          <>
            <h3 className="font-medium">
              Co-payers for <PatientIdentity patient={selected} />
            </h3>
            <ul className="mt-3 space-y-2">
              {copayers.length === 0 && <li className="text-sm text-slate-500">None yet. Add the person who pays.</li>}
              {copayers.map((c) => (
                <li key={c.id} className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium">
                      {c.firstName} {c.lastName}
                      {c.isPrimary ? <span className="ml-2 text-xs font-normal text-clinic-700">Primary</span> : null}
                    </p>
                    <p className="text-xs text-slate-500">
                      {c.relationship} · {c.phone}
                      {c.address ? ` · ${c.address}` : ''}
                    </p>
                  </div>
                  <button type="button" onClick={() => removeCopayer(c.id)} className="text-xs text-red-600 hover:underline">
                    Remove
                  </button>
                </li>
              ))}
            </ul>
            <form onSubmit={handleSubmit} className="mt-4 grid gap-3 sm:grid-cols-2">
              <input required placeholder="First name" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="rounded-lg border px-3 py-2 text-sm" />
              <input required placeholder="Last name" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="rounded-lg border px-3 py-2 text-sm" />
              <select value={form.relationship} onChange={(e) => setForm({ ...form, relationship: e.target.value as CopayerRelationship })} className="rounded-lg border px-3 py-2 text-sm">
                {COPAYER_RELATIONSHIPS.map((rel) => (
                  <option key={rel}>{rel}</option>
                ))}
              </select>
              <input required placeholder="Phone number" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="rounded-lg border px-3 py-2 text-sm" />
              <input placeholder="Address (optional)" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="rounded-lg border px-3 py-2 text-sm sm:col-span-2" />
              <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
                <input type="checkbox" checked={form.isPrimary} onChange={(e) => setForm({ ...form, isPrimary: e.target.checked })} />
                Primary co-payer for this patient
              </label>
              <button type="submit" className="rounded-lg bg-clinic-600 py-2 text-sm font-medium text-white hover:bg-clinic-700 sm:col-span-2">
                Save co-payer
              </button>
            </form>
          </>
        ) : (
          <p className="text-sm text-slate-500">Select a patient to add a co-payer.</p>
        )}
      </section>
    </div>
  );
}
