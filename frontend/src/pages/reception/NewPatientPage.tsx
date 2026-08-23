import { useMemo, useState, type FormEvent } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCare } from '../../context/CareContext';
import PatientIdentity from '../../components/PatientIdentity';
import PrintFolderButton from '../../components/PrintFolderButton';
import RecordSavedModal from '../../components/RecordSavedModal';
import { printFolderCover, printIdCard } from '../../workflow/printReceipt';
import { ageFromDob, COPAYER_RELATIONSHIPS, INSURANCE_OPTIONS, insuranceLabel, stayLabel, staffRelationLabel } from '../../workflow/patientAdmin';
import { folderYear, nextFolderNoForDate } from '../../workflow/patientDb';
import type { CopayerRelationship, Gender, InsuranceType } from '../../workflow/types';

const emptyForm = {
  firstName: '',
  lastName: '',
  dateOfBirth: '',
  gender: 'Female' as Gender,
  phone: '',
  email: '',
  address: '',
  town: '',
  insuranceType: 'GOVERNMENT' as InsuranceType,
  insuranceProvider: 'NHIS',
  insuranceNumber: '',
  ghanaCardNo: '',
  hinNumber: '',
  photoUrl: '',
  folderDate: '',
  hospitalNo: '',
  relatedStaffId: '',
  staffRelation: 'Child' as CopayerRelationship | 'Self',
};

export default function NewPatientPage() {
  const { user } = useAuth();
  const { state, createFolder } = useCare();
  const staffId = user?.id ?? 'staff-reception';
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ hospitalNo: string; name: string; pin?: string } | null>(null);

  const age = form.dateOfBirth ? ageFromDob(form.dateOfBirth) : 0;
  const suggestedFolder = useMemo(
    () => (form.folderDate ? nextFolderNoForDate(state.patients, form.folderDate) : ''),
    [form.folderDate, state.patients],
  );

  function handleFolderDate(folderDate: string) {
    setForm({
      ...form,
      folderDate,
      hospitalNo: folderDate ? nextFolderNoForDate(state.patients, folderDate) : '',
    });
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.folderDate) {
      setError('Select the folder date first, then enter the folder number.');
      return;
    }
    if (!form.hospitalNo.trim()) {
      setError('Enter the folder number from the records book.');
      return;
    }
    const result = createFolder({
      ...form,
      email: form.email || undefined,
      relatedStaffId: form.relatedStaffId || undefined,
      staffRelation: form.relatedStaffId ? form.staffRelation : undefined,
      staffId,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const name = `${form.firstName} ${form.lastName}`.trim();
    setForm(emptyForm);
    setSaved({ hospitalNo: result.hospitalNo, name, pin: result.portalPin });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {saved && (
        <RecordSavedModal
          kind="folder"
          patientName={saved.name}
          detail={`Folder ${saved.hospitalNo}${saved.pin ? ` · portal PIN ${saved.pin}` : ''}. Print the ID card for the patient and the folder cover for Records.`}
          nextLabel="Print ID card"
          onNext={() => {
            const created = state.patients.find((item) => item.hospitalNo === saved.hospitalNo);
            if (created) printIdCard(created);
          }}
          secondaryLabel="Print folder cover"
          onSecondary={() => {
            const created = state.patients.find((item) => item.hospitalNo === saved.hospitalNo);
            if (created) printFolderCover(created);
          }}
          onClose={() => setSaved(null)}
        />
      )}
      <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border bg-white p-5">
        <h3 className="font-medium">New patient</h3>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="font-medium text-slate-700">Folder date</span>
            <input required type="date" value={form.folderDate} onChange={(e) => handleFolderDate(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
          </label>
          <label className="text-sm">
            <span className="font-medium text-slate-700">Folder number</span>
            <input
              required
              disabled={!form.folderDate}
              placeholder={form.folderDate ? suggestedFolder || 'e.g. A1/2026' : 'Select the date first'}
              value={form.hospitalNo}
              onChange={(e) => setForm({ ...form, hospitalNo: e.target.value })}
              className="mt-1 w-full rounded-lg border px-3 py-2 font-mono text-sm disabled:bg-slate-50"
            />
          </label>
          <p className="text-xs text-slate-500 sm:col-span-2">
            {form.folderDate
              ? `Type A1/${folderYear(form.folderDate)} to A10000/${folderYear(form.folderDate)} from the folder register. Suggested next number: ${suggestedFolder}. You may change it.`
              : 'Choose the date the physical folder is opened. Numbers restart at A1 each new year.'}
          </p>
          <label className="text-sm">
            <span className="font-medium text-slate-700">First name</span>
            <input required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
          </label>
          <label className="text-sm">
            <span className="font-medium text-slate-700">Last name</span>
            <input required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
          </label>
          <label className="text-sm">
            <span className="font-medium text-slate-700">Date of birth</span>
            <input required type="date" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
          </label>
          <label className="text-sm">
            <span className="font-medium text-slate-700">Age</span>
            <input readOnly value={form.dateOfBirth ? `${age} years` : 'From date of birth'} className="mt-1 w-full rounded-lg border bg-slate-50 px-3 py-2 text-sm" />
          </label>
          <label className="text-sm">
            <span className="font-medium text-slate-700">Sex</span>
            <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value as Gender })} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm">
              <option>Female</option>
              <option>Male</option>
              <option>Other</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="font-medium text-slate-700">Phone number</span>
            <input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="font-medium text-slate-700">Where the patient stays</span>
            <input required placeholder="House / street" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="font-medium text-slate-700">Town / area</span>
            <input required placeholder="e.g. East Legon, Accra" value={form.town} onChange={(e) => setForm({ ...form, town: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="font-medium text-slate-700">Email (optional)</span>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
          </label>
          <fieldset className="sm:col-span-2">
            <legend className="text-sm font-medium text-slate-700">How will this patient be treated?</legend>
            <div className="mt-2 grid gap-2">
              {INSURANCE_OPTIONS.map((option) => (
                <label
                  key={option.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 ${
                    form.insuranceType === option.id ? 'border-clinic-500 bg-clinic-50' : 'border-slate-200'
                  }`}
                >
                  <input
                    type="radio"
                    name="insuranceType"
                    className="mt-1"
                    checked={form.insuranceType === option.id}
                    onChange={() =>
                      setForm({
                        ...form,
                        insuranceType: option.id,
                        insuranceProvider: option.id === 'GOVERNMENT' ? 'NHIS' : '',
                        insuranceNumber: '',
                      })
                    }
                  />
                  <span>
                    <span className="block text-sm font-medium text-slate-800">{option.title}</span>
                    <span className="block text-xs text-slate-500">{option.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          {form.insuranceType === 'CASH' && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 sm:col-span-2">
              Private patient: no NHIS card and no private insurance. The full bill is payable in cash at Accounts.
            </p>
          )}
          {form.insuranceType === 'PRIVATE' && (
            <label className="text-sm">
              <span className="font-medium text-slate-700">Private insurer</span>
              <input required value={form.insuranceProvider} onChange={(e) => setForm({ ...form, insuranceProvider: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
            </label>
          )}
          {form.insuranceType !== 'CASH' && (
            <label className="text-sm">
              <span className="font-medium text-slate-700">{form.insuranceType === 'GOVERNMENT' ? 'NHIS number' : 'Policy number'}</span>
              <input required value={form.insuranceNumber} onChange={(e) => setForm({ ...form, insuranceNumber: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
            </label>
          )}
          {form.insuranceType === 'GOVERNMENT' && (
            <>
              <label className="text-sm">
                <span className="font-medium text-slate-700">Ghana Card number</span>
                <input value={form.ghanaCardNo} onChange={(e) => setForm({ ...form, ghanaCardNo: e.target.value })} placeholder="GHA-XXXXXXXXX-X" className="mt-1 w-full rounded-lg border px-3 py-2 font-mono text-sm" />
              </label>
              <label className="text-sm">
                <span className="font-medium text-slate-700">HIN number</span>
                <input value={form.hinNumber} onChange={(e) => setForm({ ...form, hinNumber: e.target.value })} placeholder="Health insurance HIN" className="mt-1 w-full rounded-lg border px-3 py-2 font-mono text-sm" />
              </label>
            </>
          )}
          <label className="text-sm sm:col-span-2">
            <span className="font-medium text-slate-700">Folder photo</span>
            <input
              type="file"
              accept="image/*"
              className="mt-1 block w-full text-sm"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => setForm((cur) => ({ ...cur, photoUrl: String(reader.result ?? '') }));
                reader.readAsDataURL(file);
              }}
            />
            {form.photoUrl && <img src={form.photoUrl} alt="" className="mt-2 h-20 w-20 rounded-full object-cover" />}
          </label>
          <fieldset className="sm:col-span-2">
            <legend className="text-sm font-medium text-slate-700">Related to a hospital worker?</legend>
            <p className="mt-1 text-xs text-slate-500">Staff and relatives can be waived on the visit billing tab.</p>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(form.relatedStaffId)}
                onChange={(e) => setForm({ ...form, relatedStaffId: e.target.checked ? (state.staff.find((s) => s.isActive)?.id ?? '') : '' })}
              />
              Yes — this patient is a worker or a worker’s relative
            </label>
            {form.relatedStaffId && (
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <label className="text-sm">
                  <span className="font-medium text-slate-700">Worker</span>
                  <select value={form.relatedStaffId} onChange={(e) => setForm({ ...form, relatedStaffId: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm">
                    {state.staff.filter((s) => s.isActive).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.firstName} {s.lastName} ({s.role})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  <span className="font-medium text-slate-700">Relationship</span>
                  <select value={form.staffRelation} onChange={(e) => setForm({ ...form, staffRelation: e.target.value as CopayerRelationship | 'Self' })} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm">
                    <option value="Self">The worker themselves</option>
                    {COPAYER_RELATIONSHIPS.filter((rel) => rel !== 'Self').map((rel) => (
                      <option key={rel} value={rel}>
                        {rel}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
          </fieldset>
        </div>
        <button type="submit" className="w-full rounded-lg bg-clinic-600 py-2 text-sm font-medium text-white hover:bg-clinic-700">
          Save new patient & create folder
        </button>
      </form>

      <section className="rounded-xl border bg-white p-5">
        <h3 className="font-medium">Registered patients</h3>
        {state.patients.length === 0 && (
          <p className="mt-4 rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
            No folders yet. Save a new patient on the left.
          </p>
        )}
        <ul className="mt-3 max-h-[36rem] space-y-2 overflow-auto">
          {state.patients.map((p) => (
            <li key={p.id} className="rounded-lg border border-slate-100 px-3 py-2">
              <PatientIdentity patient={p} extra={` · ${p.age}y ${p.gender}`} />
              <p className="mt-1 text-xs text-slate-500">{p.phone} · {stayLabel(p)}</p>
              <p className="text-xs text-slate-500">{insuranceLabel(p)}</p>
              {staffRelationLabel(p, state.staff) && (
                <p className="text-xs font-medium text-amber-800">{staffRelationLabel(p, state.staff)}</p>
              )}
              {p.folderCreatedAt && (
                <div className="mt-1">
                  <PrintFolderButton patient={p} />
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
