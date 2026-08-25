import { useMemo, useState, type FormEvent } from 'react';
import { useCare } from '../../context/CareContext';
import PatientIdentity from '../../components/PatientIdentity';
import RecordSavedModal from '../../components/RecordSavedModal';
import { searchPatients } from '../../workflow/store';
import { COPAYER_RELATIONSHIPS, INSURANCE_OPTIONS, copayerCoverLabel, insuranceLabel } from '../../workflow/patientAdmin';
import type { CopayerRelationship, InsuranceType } from '../../workflow/types';

const emptyForm = {
  firstName: '',
  lastName: '',
  relationship: 'Parent' as CopayerRelationship,
  phone: '',
  address: '',
  isPrimary: true,
  insuranceType: 'GOVERNMENT' as InsuranceType,
  insuranceProvider: 'NHIS',
  insuranceNumber: '',
  ghanaCardNo: '',
  hinNumber: '',
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

  function setCover(insuranceType: InsuranceType) {
    setForm({
      ...form,
      insuranceType,
      insuranceProvider: insuranceType === 'GOVERNMENT' ? 'NHIS' : insuranceType === 'PRIVATE' ? '' : '',
      insuranceNumber: '',
      ghanaCardNo: '',
      hinNumber: '',
    });
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selected) {
      setMessage('Select a patient first.');
      return;
    }
    if (form.insuranceType === 'GOVERNMENT' && !form.insuranceNumber.trim() && !form.ghanaCardNo.trim()) {
      setMessage('Enter the NHIS number or Ghana Card for government cover.');
      return;
    }
    if (form.insuranceType === 'PRIVATE' && (!form.insuranceProvider.trim() || !form.insuranceNumber.trim())) {
      setMessage('Enter the private insurer and policy number.');
      return;
    }
    saveCopayer({
      ...form,
      patientId: selected.id,
      address: form.address || undefined,
      insuranceProvider: form.insuranceType === 'CASH' ? undefined : form.insuranceProvider || undefined,
      insuranceNumber: form.insuranceType === 'CASH' ? undefined : form.insuranceNumber || undefined,
      ghanaCardNo: form.insuranceType === 'GOVERNMENT' ? form.ghanaCardNo || undefined : undefined,
      hinNumber: form.insuranceType === 'GOVERNMENT' ? form.hinNumber || undefined : undefined,
    });
    setForm(emptyForm);
    setMessage(null);
    setSaved(`Co-payer saved for ${selected.firstName} ${selected.lastName}.`);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {saved && <RecordSavedModal kind="saved" detail={saved} onClose={() => setSaved(null)} />}
      <section className="desk-panel p-5">
        <h2 className="font-medium text-slate-900">Find patient</h2>
        <p className="mt-1 text-sm text-slate-500">The co-payer is the person or scheme that shares this patient’s bill.</p>
        {message && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{message}</p>}
        <input
          placeholder="Folder number, name, or phone"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="mt-3 w-full rounded-lg border px-3 py-2 font-mono text-sm"
        />
        <ul className="mt-3 max-h-72 divide-y overflow-auto rounded-lg border">
          {matches.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setSelectedId(p.id)}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-50 ${selected?.id === p.id ? 'bg-clinic-50' : ''}`}
              >
                <PatientIdentity patient={p} extra={` · ${p.age}y`} />
                <span className="mt-0.5 block text-xs text-slate-500">
                  {p.phone} · {insuranceLabel(p)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="desk-panel p-5">
        {selected ? (
          <>
            <h2 className="font-medium text-slate-900">
              Co-payers for <PatientIdentity patient={selected} />
            </h2>
            <ul className="mt-3 space-y-2">
              {copayers.length === 0 && <li className="text-sm text-slate-500">None yet. Add the person or scheme that pays.</li>}
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
                    <p className="mt-1 text-xs text-slate-600">{copayerCoverLabel(c)}</p>
                  </div>
                  <button type="button" onClick={() => removeCopayer(c.id)} className="text-xs text-red-600 hover:underline">
                    Remove
                  </button>
                </li>
              ))}
            </ul>
            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <input required placeholder="First name" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="rounded-lg border px-3 py-2 text-sm" />
                <input required placeholder="Last name" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="rounded-lg border px-3 py-2 text-sm" />
                <select value={form.relationship} onChange={(e) => setForm({ ...form, relationship: e.target.value as CopayerRelationship })} className="rounded-lg border px-3 py-2 text-sm">
                  {COPAYER_RELATIONSHIPS.map((rel) => (
                    <option key={rel}>{rel}</option>
                  ))}
                </select>
                <input required placeholder="Phone number" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="rounded-lg border px-3 py-2 text-sm" />
                <input placeholder="Address (optional)" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="rounded-lg border px-3 py-2 text-sm sm:col-span-2" />
              </div>

              <fieldset>
                <legend className="text-sm font-semibold text-slate-800">How does this co-payer cover the bill?</legend>
                <div className="mt-2 grid gap-2">
                  {INSURANCE_OPTIONS.map((option) => (
                    <label
                      key={option.id}
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 ${
                        form.insuranceType === option.id ? 'border-clinic-500 bg-clinic-50' : 'border-slate-200'
                      }`}
                    >
                      <input type="radio" name="copayerCover" className="mt-1" checked={form.insuranceType === option.id} onChange={() => setCover(option.id)} />
                      <span>
                        <span className="block text-sm font-medium text-slate-800">{option.title}</span>
                        <span className="block text-xs text-slate-500">
                          {option.id === 'GOVERNMENT'
                            ? 'NHIS / Ghana Card held by this co-payer.'
                            : option.id === 'PRIVATE'
                              ? 'Company or private scheme held by this co-payer.'
                              : 'This co-payer pays cash. No NHIS or private policy.'}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              {form.insuranceType === 'PRIVATE' && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm">
                    <span className="font-medium text-slate-700">Private insurer</span>
                    <input required value={form.insuranceProvider} onChange={(e) => setForm({ ...form, insuranceProvider: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
                  </label>
                  <label className="text-sm">
                    <span className="font-medium text-slate-700">Policy number</span>
                    <input required value={form.insuranceNumber} onChange={(e) => setForm({ ...form, insuranceNumber: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
                  </label>
                </div>
              )}
              {form.insuranceType === 'GOVERNMENT' && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm">
                    <span className="font-medium text-slate-700">NHIS number</span>
                    <input value={form.insuranceNumber} onChange={(e) => setForm({ ...form, insuranceNumber: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2 font-mono text-sm" />
                  </label>
                  <label className="text-sm">
                    <span className="font-medium text-slate-700">Ghana Card number</span>
                    <input value={form.ghanaCardNo} onChange={(e) => setForm({ ...form, ghanaCardNo: e.target.value })} placeholder="GHA-XXXXXXXXX-X" className="mt-1 w-full rounded-lg border px-3 py-2 font-mono text-sm" />
                  </label>
                  <label className="text-sm sm:col-span-2">
                    <span className="font-medium text-slate-700">HIN number</span>
                    <input value={form.hinNumber} onChange={(e) => setForm({ ...form, hinNumber: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2 font-mono text-sm" />
                  </label>
                </div>
              )}

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={form.isPrimary} onChange={(e) => setForm({ ...form, isPrimary: e.target.checked })} />
                Primary co-payer for this patient
              </label>
              <button type="submit" className="w-full rounded-lg bg-clinic-600 py-2 text-sm font-medium text-white hover:bg-clinic-700">
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
