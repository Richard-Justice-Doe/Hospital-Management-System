import { CLINIC_LABELS } from './catalog';
import { searchPatients } from './store';
import type { CareState, Department, PayMethod, PatientRecord, VisitRecord, VisitStage } from './types';
import { STAGE_LABELS } from './types';

export type DeskLang = 'en' | 'tw' | 'gaa';

export const PAY_METHODS: Array<{ id: PayMethod; label: string; icon: string }> = [
  { id: 'CASH', label: 'Cash', icon: '💵' },
  { id: 'MOMO', label: 'MoMo', icon: '📱' },
  { id: 'NHIS', label: 'NHIS', icon: '🪪' },
  { id: 'CARD', label: 'Card', icon: '💳' },
  { id: 'BANK', label: 'Bank', icon: '🏦' },
];

export const STAGE_PICTURE: Record<VisitStage, { icon: string; color: string }> = {
  CHECKED_IN: { icon: '🚪', color: 'bg-sky-100 text-sky-800' },
  VITALS_DONE: { icon: '❤️', color: 'bg-rose-100 text-rose-800' },
  WITH_DOCTOR: { icon: '👨‍⚕️', color: 'bg-clinic-50 text-clinic-800' },
  AWAITING_SERVICES: { icon: '🧪', color: 'bg-violet-100 text-violet-800' },
  READY_TO_BILL: { icon: '🧾', color: 'bg-amber-100 text-amber-800' },
  COMPLETED: { icon: '✅', color: 'bg-emerald-100 text-emerald-800' },
};

export const DEPT_PICTURE: Record<Department, { icon: string; label: string }> = {
  RECORDS: { icon: '📁', label: 'Records' },
  CONSULTATION: { icon: '👨‍⚕️', label: 'Doctor' },
  NURSING: { icon: '🩺', label: 'Nursing' },
  LAB: { icon: '🧪', label: 'Lab' },
  PHARMACY: { icon: '💊', label: 'Pharmacy' },
  RADIOLOGY: { icon: '📷', label: 'X-ray' },
  PHYSIO: { icon: '💪', label: 'Physio' },
  DENTAL: { icon: '🦷', label: 'Dental' },
  EYE: { icon: '👁️', label: 'Eye' },
  ENT: { icon: '👂', label: 'ENT' },
  MATERNITY: { icon: '🤰', label: 'Maternity' },
  THEATRE: { icon: '🔪', label: 'Theatre' },
  WARD: { icon: '🛏️', label: 'Ward' },
  CLAIMS: { icon: '🪪', label: 'Claims' },
  STORES: { icon: '📦', label: 'Stores' },
  PROCUREMENT: { icon: '🛒', label: 'Procurement' },
  IT: { icon: '💻', label: 'IT' },
};

const COPY: Record<DeskLang, Record<string, string>> = {
  en: {
    date: 'Date',
    find: 'Type a name or folder number',
    recent: 'Waiting at this desk',
    callNext: 'Call next',
    huge: 'Big letters',
    voice: 'Voice',
    train: 'Training',
    undo: 'Undo last',
    offline: 'Offline — saved on this desk',
    pay: 'Pay',
  },
  tw: {
    date: 'Da',
    find: 'Onii no wɔ he?',
    recent: 'Ayaresafoɔ a ɛtwa mu',
    callNext: 'Frɛ nea ɛdi hɔ',
    huge: 'Nkyerɛw kɛse',
    voice: 'Nne',
    train: 'Adesua',
    undo: 'San yɛ',
    offline: 'Nɛtwɛek nni hɔ',
    pay: 'Tua ka',
  },
  gaa: {
    date: 'Gbi',
    find: 'Mɛni ji mɔ̃ lɛ?',
    recent: 'Hekoomɔi ni eba daŋ',
    callNext: 'Tsɛ mɔ ni baa',
    huge: 'Nmaa agbo',
    voice: 'Gbɛi',
    train: 'Kaseɛmɔ',
    undo: 'Tsake',
    offline: 'Internet mli be',
    pay: 'Ha shika',
  },
};

export function deskText(lang: DeskLang, key: string) {
  return COPY[lang][key] ?? COPY.en[key] ?? key;
}

export function patientPlace(visit?: VisitRecord) {
  if (!visit) return 'No open visit';
  if (visit.payLaterReason && visit.stage !== 'COMPLETED') return `To pay later · ${STAGE_LABELS[visit.stage]}`;
  return `${STAGE_LABELS[visit.stage]} · ${CLINIC_LABELS[visit.clinic ?? 'GENERAL']}`;
}

export function locatePatients(state: CareState, query: string) {
  return searchPatients(state.patients, query).slice(0, 8).map((patient) => {
    const visit = state.visits.find((item) => item.patientId === patient.id && item.stage !== 'COMPLETED');
    return { patient, visit, place: patientPlace(visit) };
  });
}

export function recentFromVisits(state: CareState, limit = 10): PatientRecord[] {
  const seen = new Set<string>();
  const list: PatientRecord[] = [];
  for (const visit of [...state.visits].sort((a, b) => b.checkedInAt.localeCompare(a.checkedInAt))) {
    if (seen.has(visit.patientId)) continue;
    const patient = state.patients.find((item) => item.id === visit.patientId);
    if (!patient) continue;
    seen.add(patient.id);
    list.push(patient);
    if (list.length >= limit) break;
  }
  return list;
}

export function todaysOpenVisits(state: CareState) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return state.visits.filter((visit) => new Date(visit.checkedInAt) >= start && visit.stage !== 'COMPLETED');
}

export function speakDesk(text: string) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.9;
  utterance.lang = 'en-GB';
  window.speechSynthesis.speak(utterance);
}
