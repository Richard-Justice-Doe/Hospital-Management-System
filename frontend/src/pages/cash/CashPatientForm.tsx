import { useMemo, useState } from 'react';
import SearchableSelect from '../../components/SearchableSelect';
import { btnDanger, btnPrimary, inputClass } from '../admin/adminUi';
import {
  DISTRICTS,
  EDUCATION_LEVELS,
  MARITAL_STATUS,
  NHIS_SCHEMES,
  PATIENT_TITLES,
  RELIGIONS,
  SPONSORS,
  SPONSOR_TYPES,
  ageFromDob,
  daysUntil,
  isMinor,
  sponsorFromCover,
} from '../../workflow/patientAdmin';
import type { Gender, MaritalStatus, PatientRecord, PatientSponsor } from '../../workflow/types';
import type { PatientAdminInput } from '../../workflow/store';

const field = `${inputClass} mt-1`;

export type HisFolderForm = {
  folderDate: string;
  hospitalNo: string;
  honorific: string;
  lastName: string;
  otherName: string;
  dateOfBirth: string;
  maritalStatus: MaritalStatus | '';
  occupation: string;
  religion: string;
  educationLevel: string;
  gender: Gender | '';
  address: string;
  phone: string;
  email: string;
  kinName: string;
  kinPhone: string;
  district: string;
  subDistrict: string;
  scheme: string;
  sponsor: PatientSponsor | '';
  sponsorType: string;
  insuranceNumber: string;
  insuranceSerial: string;
  nhisExpires: string;
  consentTreatment: boolean;
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function emptyHisFolderForm(folderDate = todayIso()): HisFolderForm {
  return {
    folderDate,
    hospitalNo: '',
    honorific: '',
    lastName: '',
    otherName: '',
    dateOfBirth: '',
    maritalStatus: '',
    occupation: '',
    religion: '',
    educationLevel: '',
    gender: '',
    address: '',
    phone: '',
    email: '',
    kinName: '',
    kinPhone: '',
    district: '',
    subDistrict: '',
    scheme: 'NHIS',
    sponsor: '',
    sponsorType: '',
    insuranceNumber: '',
    insuranceSerial: '',
    nhisExpires: '',
    consentTreatment: true,
  };
}

export function formFromPatient(patient: PatientRecord): HisFolderForm {
  const sponsor = patient.sponsor ?? sponsorFromCover(patient.insuranceType, patient.preferredPayment);
  return {
    folderDate: (patient.folderCreatedAt || patient.createdAt).slice(0, 10),
    hospitalNo: patient.hospitalNo,
    honorific: patient.honorific ?? '',
    lastName: patient.lastName,
    otherName: [patient.firstName, patient.otherNames].filter(Boolean).join(' '),
    dateOfBirth: patient.dateOfBirth ?? '',
    maritalStatus: patient.maritalStatus ?? '',
    occupation: patient.occupation ?? '',
    religion: patient.religion ?? '',
    educationLevel: patient.educationLevel ?? '',
    gender: patient.gender,
    address: patient.address ?? '',
    phone: patient.phone,
    email: patient.email ?? '',
    kinName: patient.nextOfKin?.name ?? '',
    kinPhone: patient.nextOfKin?.phone ?? '',
    district: patient.district ?? '',
    subDistrict: patient.subDistrict ?? patient.town ?? '',
    scheme: patient.insuranceType === 'GOVERNMENT' ? patient.insuranceProvider || 'NHIS' : patient.insuranceProvider || '',
    sponsor,
    sponsorType: patient.insuranceProvider ?? '',
    insuranceNumber: patient.insuranceNumber ?? '',
    insuranceSerial: patient.insuranceSerial ?? '',
    nhisExpires: patient.nhisExpires ?? '',
    consentTreatment: patient.consentTreatment !== false,
  };
}

export function inputFromHisForm(form: HisFolderForm, staffId: string): PatientAdminInput | string {
  if (!form.lastName.trim()) return 'Enter the surname.';
  if (!form.otherName.trim()) return 'Enter the other name.';
  if (!form.dateOfBirth) return 'Enter the date of birth.';
  if (!form.gender) return 'Select gender.';
  if (!form.phone.trim()) return 'Enter the telephone number.';
  if (!form.sponsor) return 'Select the sponsor.';
  if (!form.sponsorType) return 'Select the sponsor type.';
  const cover = SPONSORS.find((row) => row.id === form.sponsor);
  if (!cover) return 'Select the sponsor.';
  if (cover.insuranceType === 'GOVERNMENT' && !form.insuranceNumber.trim()) return 'Enter the NHIS member ID.';
  if (cover.insuranceType === 'PRIVATE' && !form.insuranceNumber.trim()) return 'Enter the insurance number.';
  const names = form.otherName.trim().split(/\s+/);
  const age = ageFromDob(form.dateOfBirth);
  if (isMinor(age) && !form.kinName.trim()) return 'Enter the nearest relative for a patient under 18.';
  return {
    staffId,
    lastName: form.lastName.trim(),
    firstName: names[0] ?? '',
    otherNames: names.slice(1).join(' ') || undefined,
    honorific: form.honorific || undefined,
    dateOfBirth: form.dateOfBirth,
    gender: form.gender,
    phone: form.phone.trim(),
    email: form.email || undefined,
    address: form.address || undefined,
    town: form.subDistrict || undefined,
    maritalStatus: form.maritalStatus || undefined,
    occupation: form.occupation || undefined,
    religion: form.religion || undefined,
    educationLevel: form.educationLevel || undefined,
    district: form.district || undefined,
    subDistrict: form.subDistrict || undefined,
    nextOfKinName: form.kinName || undefined,
    nextOfKinPhone: form.kinPhone || undefined,
    sponsor: form.sponsor,
    insuranceType: cover.insuranceType,
    preferredPayment: cover.payment,
    insuranceProvider: form.sponsorType || form.scheme || undefined,
    insuranceNumber: form.insuranceNumber || undefined,
    insuranceSerial: form.insuranceSerial || undefined,
    nhisExpires: form.nhisExpires || undefined,
    hospitalNo: form.hospitalNo || undefined,
    folderDate: form.folderDate,
    consentTreatment: form.consentTreatment,
  };
}

export default function CashPatientForm({
  initial,
  error,
  lockIdentifiers,
  onSave,
  onClose,
}: {
  initial: HisFolderForm;
  error?: string | null;
  lockIdentifiers?: boolean;
  onSave: (form: HisFolderForm) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState(initial);
  const age = form.dateOfBirth ? String(ageFromDob(form.dateOfBirth)) : '';
  const left = daysUntil(form.nhisExpires);
  const cover = SPONSORS.find((row) => row.id === form.sponsor);
  const typeOptions = useMemo(() => {
    if (cover?.id === 'GOVERNMENT') return NHIS_SCHEMES.map((label) => ({ id: label, label }));
    if (cover?.id === 'PRIVATE') return [{ id: 'Private', label: 'Private' }];
    return SPONSOR_TYPES.filter((label) => label !== 'NHIS').map((label) => ({ id: label, label }));
  }, [cover?.id]);

  function patch<K extends keyof HisFolderForm>(key: K, value: HisFolderForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <form
      className="desk-panel p-5"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(form);
      }}
    >
      <h2 className="text-xl font-semibold text-slate-600">{lockIdentifiers ? 'Edit folder' : 'Patient Information'}</h2>
      {error && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{error}</p>}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium">
          Registration Date<span className="text-red-600">*</span>
          <input type="date" required readOnly={lockIdentifiers} value={form.folderDate} onChange={(e) => patch('folderDate', e.target.value)} className={field} />
        </label>
        <label className="text-sm font-medium">
          Folder Number<span className="text-red-600">*</span>
          <input readOnly={lockIdentifiers} value={form.hospitalNo} onChange={(e) => patch('hospitalNo', e.target.value)} placeholder="folder number" className={field} />
        </label>
      </div>
      <hr className="my-5" />
      <div className="grid gap-3 md:grid-cols-3">
        <div className="space-y-3">
          <label className="text-sm font-medium">
            Title
            <select value={form.honorific} onChange={(e) => patch('honorific', e.target.value)} className={field}>
              <option value="">Select Title</option>
              {PATIENT_TITLES.map((row) => (
                <option key={row} value={row}>
                  {row}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium">
            Sur Name<span className="text-red-600">*</span>
            <input required value={form.lastName} onChange={(e) => patch('lastName', e.target.value)} placeholder="surname" className={field} />
          </label>
          <label className="text-sm font-medium">
            Other Name
            <input value={form.otherName} onChange={(e) => patch('otherName', e.target.value)} placeholder="other name" className={field} />
          </label>
          <label className="text-sm font-medium">
            Date Of Birth<span className="text-red-600">*</span>
            <input type="date" required value={form.dateOfBirth} onChange={(e) => patch('dateOfBirth', e.target.value)} className={field} />
          </label>
          <label className="text-sm font-medium">
            Age
            <input readOnly value={age} placeholder="age" className={`${field} bg-slate-100`} />
          </label>
        </div>
        <div className="space-y-3">
          <label className="text-sm font-medium">
            Marital Status
            <select value={form.maritalStatus} onChange={(e) => patch('maritalStatus', e.target.value as MaritalStatus | '')} className={field}>
              <option value="">Select Marital status</option>
              {MARITAL_STATUS.map((row) => (
                <option key={row} value={row}>
                  {row}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium">
            Occupation
            <input value={form.occupation} onChange={(e) => patch('occupation', e.target.value)} placeholder="Occupation" className={field} />
          </label>
          <label className="text-sm font-medium">
            Religion
            <select value={form.religion} onChange={(e) => patch('religion', e.target.value)} className={field}>
              <option value="">Select Religion</option>
              {RELIGIONS.map((row) => (
                <option key={row} value={row}>
                  {row}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium">
            Educ. level
            <select value={form.educationLevel} onChange={(e) => patch('educationLevel', e.target.value)} className={field}>
              <option value="">Select Education</option>
              {EDUCATION_LEVELS.map((row) => (
                <option key={row} value={row}>
                  {row}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium">
            Gender<span className="text-red-600">*</span>
            <select required value={form.gender} onChange={(e) => patch('gender', e.target.value as Gender | '')} className={field}>
              <option value="">Select Gender</option>
              <option value="Female">Female</option>
              <option value="Male">Male</option>
              <option value="Other">Other</option>
            </select>
          </label>
        </div>
        <div className="space-y-3">
          <label className="text-sm font-medium">
            Home Address
            <input value={form.address} onChange={(e) => patch('address', e.target.value)} placeholder="home address" className={field} />
          </label>
          <label className="text-sm font-medium">
            Tel No.<span className="text-red-600">*</span>
            <input required value={form.phone} onChange={(e) => patch('phone', e.target.value)} placeholder="telephone number" className={field} />
          </label>
          <label className="text-sm font-medium">
            Email Address
            <input value={form.email} onChange={(e) => patch('email', e.target.value)} placeholder="email address" className={field} />
          </label>
          <label className="text-sm font-medium">
            Name Of N.R
            <input value={form.kinName} onChange={(e) => patch('kinName', e.target.value)} placeholder="name of nearest relative" className={field} />
          </label>
          <label className="text-sm font-medium">
            Contact Of N.R
            <input value={form.kinPhone} onChange={(e) => patch('kinPhone', e.target.value)} placeholder="contact of nearest relative" className={field} />
          </label>
        </div>
      </div>
      <div className="my-5 h-1 rounded bg-emerald-600" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SearchableSelect
          label="District"
          value={form.district}
          onChange={(value) => patch('district', value)}
          placeholder="Select District"
          options={DISTRICTS.map((label) => ({ id: label, label }))}
        />
        <label className="text-sm font-medium">
          Sub District
          <input value={form.subDistrict} onChange={(e) => patch('subDistrict', e.target.value)} placeholder="Select Sub District" className={field} />
        </label>
        <SearchableSelect
          label="Insurance Scheme"
          value={form.scheme}
          onChange={(value) => patch('scheme', value)}
          placeholder="Select NHIS Scheme"
          options={NHIS_SCHEMES.map((label) => ({ id: label, label }))}
        />
        <SearchableSelect
          label="Sponsor"
          required
          value={form.sponsor}
          onChange={(value) => {
            patch('sponsor', value as PatientSponsor);
            patch('sponsorType', '');
          }}
          placeholder="Select Sponsor"
          options={SPONSORS.map((row) => ({ id: row.id, label: row.label }))}
        />
        <SearchableSelect
          label="Sponsor Type"
          required
          value={form.sponsorType}
          onChange={(value) => patch('sponsorType', value)}
          placeholder="Select Insurance"
          options={typeOptions}
        />
        <label className="text-sm font-medium">
          Insurance Number
          <input value={form.insuranceNumber} onChange={(e) => patch('insuranceNumber', e.target.value)} placeholder="Member ID" className={field} />
        </label>
        <label className="text-sm font-medium">
          Serial Number
          <input value={form.insuranceSerial} onChange={(e) => patch('insuranceSerial', e.target.value)} placeholder="serial number" className={field} />
        </label>
        <label className="text-sm font-medium">
          Expiring Date
          <div className="mt-1 grid grid-cols-[1fr_5rem] gap-2">
            <input type="date" value={form.nhisExpires} onChange={(e) => patch('nhisExpires', e.target.value)} className={inputClass} />
            <input readOnly value={left} placeholder="no. days left" className={`${inputClass} bg-slate-100`} />
          </div>
        </label>
      </div>
      <label className="mt-4 flex items-start gap-2 text-sm">
        <input type="checkbox" checked={form.consentTreatment} onChange={(e) => patch('consentTreatment', e.target.checked)} className="mt-0.5" />
        Treatment consent is given
      </label>
      <div className="mt-6 flex justify-end gap-2">
        <button type="submit" className={`${btnPrimary} bg-sky-600 hover:bg-sky-700`}>
          Save Patient Record
        </button>
        <button type="button" className={`${btnDanger} bg-red-500 px-4 py-2 text-white hover:bg-red-600`} onClick={onClose}>
          Close
        </button>
      </div>
    </form>
  );
}
