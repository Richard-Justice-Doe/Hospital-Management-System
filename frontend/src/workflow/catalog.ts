import type { ClinicId, Department, HospitalService } from './types';

export const DEPARTMENT_LABELS: Record<Department, string> = {
  RECORDS: 'Records / registration',
  CONSULTATION: 'OPD consultation',
  NURSING: 'Nursing procedures',
  LAB: 'Laboratory',
  PHARMACY: 'Pharmacy',
  RADIOLOGY: 'X-ray / imaging',
  PHYSIO: 'Physiotherapy',
  DENTAL: 'Dental',
  EYE: 'Eye clinic',
  ENT: 'ENT',
  MATERNITY: 'Maternity / ANC',
  THEATRE: 'Theatre / minor ops',
  WARD: 'Ward / admission',
  CLAIMS: 'Claims / NHIS',
  STORES: 'Central stores',
  PROCUREMENT: 'Procurement',
  IT: 'IT support',
};

function item(id: string, name: string, department: Department, priceGhs: number, enabled = true): HospitalService {
  return { id, name, department, priceGhs, enabled };
}

/** Illustrative Ghana OPD tariffs in GH₵ for the demo (not official NHIS rates). */
export const DEFAULT_SERVICES: HospitalService[] = [
  item('reg-folder', 'Patient folder / registration', 'RECORDS', 20),
  item('reg-review', 'Review / old folder retrieval', 'RECORDS', 10),
  item('reg-nhis', 'NHIS claims processing', 'RECORDS', 15, false),

  item('opd-general', 'General OPD consultation', 'CONSULTATION', 50),
  item('opd-review', 'Review / follow-up consultation', 'CONSULTATION', 30),
  item('opd-specialist', 'Specialist consultation', 'CONSULTATION', 120),
  item('opd-emergency', 'Emergency consultation', 'CONSULTATION', 80),

  item('nurs-injection', 'Injection (IM / IV)', 'NURSING', 15),
  item('nurs-dress-min', 'Wound dressing (minor)', 'NURSING', 25),
  item('nurs-dress-maj', 'Wound dressing (major)', 'NURSING', 50),
  item('nurs-suture-out', 'Suture removal', 'NURSING', 20),
  item('nurs-nebulise', 'Nebulization', 'NURSING', 30),
  item('nurs-cannula', 'IV cannula + fluid administration', 'NURSING', 40),

  item('lab-rdt', 'Malaria RDT', 'LAB', 25),
  item('lab-mp', 'Blood film for malaria parasites', 'LAB', 30),
  item('lab-fbc', 'Full blood count (FBC)', 'LAB', 60),
  item('lab-sickling', 'Sickling test', 'LAB', 25),
  item('lab-group', 'Blood grouping / rhesus', 'LAB', 20),
  item('lab-rbs', 'Random / fasting blood sugar', 'LAB', 25),
  item('lab-urine', 'Urine RE', 'LAB', 20),
  item('lab-stool', 'Stool RE', 'LAB', 20),
  item('lab-widal', 'Widal test', 'LAB', 30),
  item('lab-hpylori', 'H. pylori test', 'LAB', 40),
  item('lab-preg', 'Pregnancy test', 'LAB', 20),
  item('lab-hiv', 'HIV screening', 'LAB', 30),
  item('lab-hepb', 'Hepatitis B screening', 'LAB', 40),
  item('lab-lft', 'Liver function test (LFT)', 'LAB', 90),
  item('lab-rft', 'Renal function (urea & creatinine)', 'LAB', 80),
  item('lab-lipid', 'Lipid profile', 'LAB', 100),

  item('rx-dispense', 'Pharmacy dispensing fee', 'PHARMACY', 10),
  item('rx-pcm', 'Paracetamol 500mg (blister)', 'PHARMACY', 8),
  item('rx-amox', 'Amoxicillin 500mg (pack)', 'PHARMACY', 25),
  item('rx-ors', 'ORS sachet', 'PHARMACY', 5),
  item('rx-act', 'ACT antimalarial (adult)', 'PHARMACY', 35),
  item('rx-prenatal', 'Prenatal vitamins', 'PHARMACY', 20),
  item('rx-ibuprofen', 'Ibuprofen 400mg (blister)', 'PHARMACY', 12),
  item('rx-metro', 'Metronidazole 400mg (pack)', 'PHARMACY', 15),
  item('rx-cipro', 'Ciprofloxacin 500mg (pack)', 'PHARMACY', 20),
  item('rx-coamox', 'Co-amoxiclav 625mg (pack)', 'PHARMACY', 35),
  item('rx-fluclo', 'Flucloxacillin 500mg (pack)', 'PHARMACY', 22),
  item('rx-cefuro', 'Cefuroxime 500mg (pack)', 'PHARMACY', 40),
  item('rx-zinc', 'Zinc sulphate 20mg', 'PHARMACY', 8),
  item('rx-alben', 'Albendazole 400mg', 'PHARMACY', 6),
  item('rx-folic', 'Folic acid 5mg', 'PHARMACY', 5),
  item('rx-multi', 'Multivitamin (pack)', 'PHARMACY', 12),
  item('rx-omep', 'Omeprazole 20mg (pack)', 'PHARMACY', 18),
  item('rx-metf', 'Metformin 500mg (pack)', 'PHARMACY', 15),
  item('rx-amlo', 'Amlodipine 10mg (pack)', 'PHARMACY', 12),
  item('rx-diclo', 'Diclofenac 50mg (blister)', 'PHARMACY', 10),
  item('rx-salb', 'Salbutamol inhaler', 'PHARMACY', 45),
  item('rx-insulin', 'Soluble insulin vial', 'PHARMACY', 80),
  item('rx-cough', 'Cough syrup 100ml', 'PHARMACY', 18),
  item('rx-hydro', 'Hydrocortisone cream', 'PHARMACY', 15),

  item('rad-chest', 'Chest X-ray', 'RADIOLOGY', 80),
  item('rad-limb', 'Limb X-ray', 'RADIOLOGY', 70),
  item('rad-abd', 'Abdominal X-ray', 'RADIOLOGY', 90),
  item('rad-uss-obs', 'Obstetric ultrasound', 'RADIOLOGY', 150),
  item('rad-uss-abd', 'Abdominal ultrasound', 'RADIOLOGY', 180),
  item('rad-ecg', 'ECG', 'RADIOLOGY', 60),

  item('pt-assess', 'Physiotherapy assessment', 'PHYSIO', 50),
  item('pt-session', 'Physiotherapy treatment session', 'PHYSIO', 40),
  item('pt-traction', 'Traction', 'PHYSIO', 45),

  item('den-consult', 'Dental consultation', 'DENTAL', 40),
  item('den-extract', 'Simple tooth extraction', 'DENTAL', 80),
  item('den-scale', 'Scaling and polishing', 'DENTAL', 100),

  item('eye-consult', 'Eye consultation', 'EYE', 40),
  item('eye-va', 'Visual acuity test', 'EYE', 15),

  item('ent-consult', 'ENT consultation', 'ENT', 50),

  item('mat-anc', 'Antenatal visit', 'MATERNITY', 40),
  item('mat-delivery', 'Normal delivery package', 'MATERNITY', 400, false),
  item('mat-cs', 'Caesarean section package', 'MATERNITY', 1500, false),

  item('th-minor', 'Minor theatre procedure', 'THEATRE', 200),
  item('th-circ', 'Circumcision', 'THEATRE', 250, false),

  item('ward-obs', 'Observation (up to 4 hours)', 'WARD', 50),
  item('ward-bed', 'Ward bed (per day)', 'WARD', 80),
];

export function formatGhs(amount: number): string {
  return `GH₵ ${amount.toFixed(2)}`;
}

export function billTotal(orders: { priceGhs: number }[]): number {
  return orders.reduce((sum, o) => sum + o.priceGhs, 0);
}

export const CLINICS: Array<{
  id: ClinicId;
  label: string;
  department: Department;
  serviceId: string;
  flow: 'opd' | 'clinic';
}> = [
  { id: 'GENERAL', label: 'General OPD', department: 'CONSULTATION', serviceId: 'opd-general', flow: 'opd' },
  { id: 'REVIEW', label: 'Review / follow-up', department: 'CONSULTATION', serviceId: 'opd-review', flow: 'opd' },
  { id: 'EMERGENCY', label: 'Emergency', department: 'CONSULTATION', serviceId: 'opd-emergency', flow: 'opd' },
  { id: 'SPECIALIST', label: 'Specialist clinic', department: 'CONSULTATION', serviceId: 'opd-specialist', flow: 'opd' },
  { id: 'EYE', label: 'Eye clinic', department: 'EYE', serviceId: 'eye-consult', flow: 'clinic' },
  { id: 'ENT', label: 'ENT clinic', department: 'ENT', serviceId: 'ent-consult', flow: 'clinic' },
  { id: 'DENTAL', label: 'Dental clinic', department: 'DENTAL', serviceId: 'den-consult', flow: 'clinic' },
  { id: 'PHYSIO', label: 'Physiotherapy', department: 'PHYSIO', serviceId: 'pt-assess', flow: 'clinic' },
  { id: 'MATERNITY', label: 'Maternity / ANC', department: 'MATERNITY', serviceId: 'mat-anc', flow: 'clinic' },
];

export const CLINIC_LABELS: Record<ClinicId, string> = {
  GENERAL: 'General OPD',
  REVIEW: 'Review / follow-up',
  EMERGENCY: 'Emergency',
  SPECIALIST: 'Specialist clinic',
  EYE: 'Eye clinic',
  ENT: 'ENT clinic',
  DENTAL: 'Dental clinic',
  PHYSIO: 'Physiotherapy',
  MATERNITY: 'Maternity / ANC',
};

export const OPD_CLINICS: ClinicId[] = ['GENERAL', 'REVIEW', 'EMERGENCY', 'SPECIALIST'];

export function getClinic(id: ClinicId | undefined) {
  return CLINICS.find((c) => c.id === (id ?? 'GENERAL')) ?? CLINICS[0];
}

export function formatReceiptNo(seq: number): string {
  return `RCP-${String(seq).padStart(5, '0')}`;
}
