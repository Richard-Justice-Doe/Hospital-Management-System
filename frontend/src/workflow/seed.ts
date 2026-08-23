import { ROLE_SALARY_GHS } from './accounts';
import { DEFAULT_SERVICES } from './catalog';
import { seedHis } from './his';
import type { CareState, Department, StaffAccount, StaffRole } from './types';

const now = () => Date.now();

function minutesAgo(mins: number): string {
  return new Date(now() - mins * 60_000).toISOString();
}

function daysAgo(days: number): string {
  return new Date(now() - days * 24 * 3600_000).toISOString();
}

function staffPhone(id: string): string {
  const n = [...id].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const mid = String(100 + (n % 900)).padStart(3, '0');
  const last = String(1000 + (n % 9000)).padStart(4, '0');
  return `024 ${mid} ${last}`;
}

function person(
  id: string,
  email: string,
  password: string,
  firstName: string,
  lastName: string,
  role: StaffRole,
  department?: Department,
  inChargeOf?: Department,
): StaffAccount {
  return {
    id,
    email,
    username: email.split('@')[0],
    firstName,
    lastName,
    role,
    password,
    isActive: true,
    createdAt: minutesAgo(24 * 60),
    department,
    inChargeOf,
    phone: staffPhone(id),
    salaryGhs: ROLE_SALARY_GHS[role],
  };
}

function staff(
  id: string,
  email: string,
  password: string,
  firstName: string,
  lastName: string,
  role: StaffRole,
  department: Department,
): StaffAccount {
  return person(id, email, password, firstName, lastName, role, department);
}

function head(
  id: string,
  email: string,
  firstName: string,
  lastName: string,
  role: StaffRole,
  department: Department,
): StaffAccount {
  return person(id, email, 'HeadPass1!', firstName, lastName, role, department, department);
}

export const DEFAULT_STAFF: CareState['staff'] = [
  person('staff-admin', 'admin@clinic.local', 'Admin123!', 'System', 'Admin', 'ADMIN'),
  person('staff-matron', 'matron@clinic.local', 'Matron1!', 'Akosua', 'Matron', 'MATRON', 'NURSING', 'NURSING'),
  person('staff-cashier', 'cashier@clinic.local', 'Cashier1!', 'Efua', 'Cashier', 'CASHIER'),
  person('staff-accountant', 'accountant@clinic.local', 'Accountant1!', 'Ama', 'Books', 'ACCOUNTANT'),

  head('staff-records-head', 'records-head@clinic.local', 'Aba', 'Records Head', 'RECEPTIONIST', 'RECORDS'),
  head('staff-consult-head', 'consult-head@clinic.local', 'Kofi', 'Consult Head', 'DOCTOR', 'CONSULTATION'),
  head('staff-nursing-head', 'nursing-head@clinic.local', 'Afia', 'Nursing Head', 'NURSE', 'NURSING'),
  head('staff-lab-head', 'lab-head@clinic.local', 'Yaw', 'Lab Head', 'LAB', 'LAB'),
  head('staff-pharmacy-head', 'pharmacy-head@clinic.local', 'Ama', 'Pharmacy Head', 'PHARMACIST', 'PHARMACY'),
  head('staff-xray-head', 'xray-head@clinic.local', 'Akosua', 'X-ray Head', 'RADIOLOGY', 'RADIOLOGY'),
  head('staff-physio-head', 'physio-head@clinic.local', 'Kwesi', 'Physio Head', 'PHYSIO', 'PHYSIO'),
  head('staff-dental-head', 'dental-head@clinic.local', 'Adwoa', 'Dental Head', 'DENTIST', 'DENTAL'),
  head('staff-eye-head', 'eye-head@clinic.local', 'Esi', 'Eye Head', 'EYE_DOCTOR', 'EYE'),
  head('staff-ent-head', 'ent-head@clinic.local', 'Kwame', 'ENT Head', 'ENT_DOCTOR', 'ENT'),
  head('staff-maternity-head', 'maternity-head@clinic.local', 'Akua', 'Maternity Head', 'MIDWIFE', 'MATERNITY'),
  person('staff-ward-head', 'wardhead@clinic.local', 'WardHead1!', 'Akua', 'Ward Head', 'NURSE', 'WARD', 'WARD'),
  person('staff-theatre-head', 'theatrehead@clinic.local', 'Theatre1!', 'Yaw', 'Theatre Head', 'DOCTOR', 'THEATRE', 'THEATRE'),

  staff('staff-reception', 'reception@clinic.local', 'Reception1!', 'Sam', 'Desk', 'RECEPTIONIST', 'RECORDS'),
  staff('staff-doctor', 'doctor@clinic.local', 'DoctorPass1!', 'Jane', 'Doctor', 'DOCTOR', 'CONSULTATION'),
  staff('staff-nurse', 'nurse@clinic.local', 'NursePass1!', 'Mary', 'Nurse', 'NURSE', 'NURSING'),
  staff('staff-lab', 'lab@clinic.local', 'LabPass1!', 'Kojo', 'Lab', 'LAB', 'LAB'),
  staff('staff-pharmacy', 'pharmacy@clinic.local', 'PharmaPass1!', 'Alex', 'Pharmacist', 'PHARMACIST', 'PHARMACY'),
  staff('staff-xray', 'xray@clinic.local', 'XrayPass1!', 'Ama', 'Imaging', 'RADIOLOGY', 'RADIOLOGY'),
  staff('staff-physio', 'physio@clinic.local', 'PhysioPass1!', 'Yaw', 'Physio', 'PHYSIO', 'PHYSIO'),
  staff('staff-dentist', 'dental@clinic.local', 'Dentist1!', 'Kwesi', 'Dentist', 'DENTIST', 'DENTAL'),
  staff('staff-eye-doctor', 'eye@clinic.local', 'EyeDoc1!', 'Akosua', 'Eye', 'EYE_DOCTOR', 'EYE'),
  staff('staff-eye-nurse', 'eyenurse@clinic.local', 'EyeNurse1!', 'Abena', 'Eye Nurse', 'EYE_NURSE', 'EYE'),
  staff('staff-ent-doctor', 'ent@clinic.local', 'EntDoc1!', 'Kofi', 'ENT', 'ENT_DOCTOR', 'ENT'),
  staff('staff-ent-nurse', 'entnurse@clinic.local', 'EntNurse1!', 'Adwoa', 'ENT Nurse', 'ENT_NURSE', 'ENT'),
  staff('staff-midwife', 'midwife@clinic.local', 'Midwife1!', 'Esi', 'Midwife', 'MIDWIFE', 'MATERNITY'),
  staff('staff-ward', 'ward@clinic.local', 'WardPass1!', 'Serwaa', 'Ward Nurse', 'NURSE', 'WARD'),
  staff('staff-theatre', 'theatre@clinic.local', 'Theatre1!', 'Mensah', 'Theatre Nurse', 'NURSE', 'THEATRE'),
  staff('staff-claims', 'claims@clinic.local', 'Claims1!', 'Akosua', 'Claims', 'CLAIMS', 'CLAIMS'),
  staff('staff-stores', 'stores@clinic.local', 'Stores1!', 'Kwabena', 'Stores', 'STOREKEEPER', 'STORES'),
  staff('staff-procurement', 'procurement@clinic.local', 'Procure1!', 'Abena', 'Procurement', 'PROCUREMENT', 'PROCUREMENT'),
  staff('staff-it', 'it@clinic.local', 'ItDesk1!', 'Nana', 'Systems', 'IT', 'IT'),
];

export function ensureDemoStaff(staffList: StaffAccount[]): StaffAccount[] {
  const emails = new Set(staffList.map((item) => item.email));
  const ids = new Set(staffList.map((item) => item.id));
  const extra = DEFAULT_STAFF.filter((seed) => !emails.has(seed.email) && !ids.has(seed.id));
  return [...staffList, ...extra].map((item) => {
    const seed = DEFAULT_STAFF.find((row) => row.id === item.id || row.email === item.email);
    if (!seed) return item;
    return {
      ...item,
      username: item.username || seed.username || seed.email.split('@')[0],
      department: item.department ?? seed.department,
      inChargeOf: seed.inChargeOf,
      salaryGhs: item.salaryGhs ?? seed.salaryGhs,
      lastName: seed.id === 'staff-cashier' && item.lastName === 'Accounts' ? 'Cashier' : item.lastName,
    };
  });
}

export const STAFF_LOGINS = DEFAULT_STAFF.map((staff) => ({
  role: staff.role,
  email: staff.email,
  username: staff.username ?? staff.email.split('@')[0],
  password: staff.password,
  name: `${staff.firstName} ${staff.lastName}`,
  department: staff.department,
  inChargeOf: staff.inChargeOf,
}));


export function createSeedState(): CareState {
  return seedHis({
    nextHospitalSeq: 6,
    nextReceiptSeq: 3,
    services: DEFAULT_SERVICES,
    staff: DEFAULT_STAFF,
    patients: [
      {
        id: 'pat-amara',
        hospitalNo: 'A1/2026',
        firstName: 'Amara',
        lastName: 'Owusu',
        age: 34,
        dateOfBirth: '1992-03-12',
        gender: 'Female',
        phone: '024 111 0101',
        address: 'House 12, Boundary Road',
        town: 'East Legon, Accra',
        email: 'amara.owusu@example.com',
        insuranceType: 'GOVERNMENT',
        insuranceProvider: 'NHIS',
        insuranceNumber: 'NHIS-2049183',
        ghanaCardNo: 'GHA-123456789-1',
        hinNumber: 'HIN-2049183',
        portalPin: '582041',
        createdAt: minutesAgo(180),
        folderCreatedAt: minutesAgo(180),
        folderCreatedBy: 'staff-reception',
      },
      {
        id: 'pat-kwame',
        hospitalNo: 'A2/2026',
        firstName: 'Kwame',
        lastName: 'Mensah',
        age: 58,
        dateOfBirth: '1968-01-20',
        gender: 'Male',
        phone: '020 555 0102',
        address: 'Plot 8, Asafo Market Road',
        town: 'Kumasi',
        email: 'kwame.mensah@example.com',
        insuranceType: 'GOVERNMENT',
        insuranceProvider: 'NHIS',
        insuranceNumber: 'NHIS-1182044',
        ghanaCardNo: 'GHA-223456789-2',
        hinNumber: 'HIN-1182044',
        portalPin: '619573',
        createdAt: minutesAgo(150),
        folderCreatedAt: minutesAgo(150),
        folderCreatedBy: 'staff-reception',
      },
      {
        id: 'pat-lisa',
        hospitalNo: 'A3/2026',
        firstName: 'Lisa',
        lastName: 'Chen',
        age: 7,
        dateOfBirth: '2019-05-08',
        gender: 'Female',
        phone: '027 555 0103',
        address: 'Cantonments Cluster 4',
        town: 'Accra',
        insuranceType: 'PRIVATE',
        insuranceProvider: 'Acacia Health',
        insuranceNumber: 'AH-441920',
        portalPin: '274860',
        createdAt: minutesAgo(90),
        folderCreatedAt: minutesAgo(90),
        folderCreatedBy: 'staff-reception',
      },
      {
        id: 'pat-omar',
        hospitalNo: 'A4/2026',
        firstName: 'Omar',
        lastName: 'Hassan',
        age: 41,
        dateOfBirth: '1985-06-15',
        gender: 'Male',
        phone: '026 555 0104',
        email: 'omar.hassan@example.com',
        address: 'Community 8, House 22',
        town: 'Tema',
        insuranceType: 'PRIVATE',
        insuranceProvider: 'Metropolitan',
        insuranceNumber: 'MET-88210',
        portalPin: '931046',
        createdAt: minutesAgo(70),
        folderCreatedAt: minutesAgo(70),
        folderCreatedBy: 'staff-reception',
      },
      {
        id: 'pat-nina',
        hospitalNo: 'A5/2026',
        firstName: 'Nina',
        lastName: 'Patel',
        age: 29,
        dateOfBirth: '1997-09-02',
        gender: 'Female',
        phone: '054 555 0105',
        address: 'Oxford Street, near Danquah Circle',
        town: 'Osu, Accra',
        insuranceType: 'GOVERNMENT',
        insuranceProvider: 'NHIS',
        insuranceNumber: 'NHIS-330184',
        ghanaCardNo: 'GHA-323456789-3',
        hinNumber: 'HIN-330184',
        portalPin: '408217',
        createdAt: minutesAgo(40),
        folderCreatedAt: minutesAgo(40),
        folderCreatedBy: 'staff-reception',
      },
    ],
    copayers: [
      {
        id: 'pay-amara-spouse',
        patientId: 'pat-amara',
        firstName: 'Kwabena',
        lastName: 'Owusu',
        relationship: 'Spouse',
        phone: '024 111 0199',
        address: 'House 12, Boundary Road, East Legon',
        isPrimary: true,
        createdAt: minutesAgo(180),
      },
      {
        id: 'pay-lisa-parent',
        patientId: 'pat-lisa',
        firstName: 'Mei',
        lastName: 'Chen',
        relationship: 'Parent',
        phone: '027 555 0103',
        address: 'Cantonments Cluster 4, Accra',
        isPrimary: true,
        createdAt: minutesAgo(90),
      },
      {
        id: 'pay-nina-self',
        patientId: 'pat-nina',
        firstName: 'Nina',
        lastName: 'Patel',
        relationship: 'Self',
        phone: '054 555 0105',
        isPrimary: true,
        createdAt: minutesAgo(40),
      },
    ],
    visits: [
      {
        id: 'vis-nina',
        patientId: 'pat-nina',
        clinic: 'GENERAL',
        reason: 'Sore throat and mild cough',
        stage: 'CHECKED_IN',
        checkedInAt: minutesAgo(18),
        checkedInBy: 'staff-reception',
        nhisCcCode: 'CC-NINA-330184',
        orders: [{ id: 'ord-nina-reg', serviceId: 'reg-folder', name: 'Patient folder / registration', department: 'RECORDS', priceGhs: 20, status: 'DONE' }],
      },
      {
        id: 'vis-lisa',
        patientId: 'pat-lisa',
        clinic: 'GENERAL',
        reason: 'Fever and reduced appetite',
        stage: 'VITALS_DONE',
        checkedInAt: minutesAgo(55),
        checkedInBy: 'staff-reception',
        vitalsDoneAt: minutesAgo(22),
        vitals: {
          systolicBp: 98,
          diastolicBp: 62,
          temperatureC: 38.6,
          pulseBpm: 112,
          weightKg: 22,
          heightCm: 122,
          spo2: 97,
          abnormalFlags: ['Fever', 'Tachycardia'],
          recordedAt: minutesAgo(22),
          recordedBy: 'staff-nurse',
        },
        history: 'No known chronic conditions. Vaccinations up to date.',
        orders: [
          { id: 'ord-lisa-reg', serviceId: 'reg-folder', name: 'Patient folder / registration', department: 'RECORDS', priceGhs: 20, status: 'DONE' },
          { id: 'ord-lisa-opd', serviceId: 'opd-general', name: 'General OPD consultation', department: 'CONSULTATION', priceGhs: 50, status: 'DONE' },
        ],
      },
      {
        id: 'vis-kwame',
        patientId: 'pat-kwame',
        clinic: 'GENERAL',
        reason: 'Chest tightness and dizziness',
        stage: 'WITH_DOCTOR',
        checkedInAt: minutesAgo(95),
        checkedInBy: 'staff-reception',
        nhisCcCode: 'CC-KWAME-1182044',
        vitalsDoneAt: minutesAgo(70),
        withDoctorAt: minutesAgo(25),
        vitals: {
          systolicBp: 162,
          diastolicBp: 98,
          temperatureC: 36.8,
          pulseBpm: 88,
          weightKg: 92,
          heightCm: 176,
          spo2: 94,
          abnormalFlags: ['High blood pressure', 'Low SpO2', 'High BMI'],
          recordedAt: minutesAgo(70),
          recordedBy: 'staff-nurse',
        },
        history: 'Hypertension. Last visit 4 months ago for BP review.',
        orders: [
          { id: 'ord-kwame-reg', serviceId: 'reg-folder', name: 'Patient folder / registration', department: 'RECORDS', priceGhs: 20, status: 'DONE' },
          { id: 'ord-kwame-opd', serviceId: 'opd-general', name: 'General OPD consultation', department: 'CONSULTATION', priceGhs: 50, status: 'DONE' },
        ],
      },
      {
        id: 'vis-amara',
        patientId: 'pat-amara',
        clinic: 'MATERNITY',
        reason: 'Routine antenatal follow-up',
        stage: 'COMPLETED',
        checkedInAt: daysAgo(40),
        checkedInBy: 'staff-reception',
        nhisCcCode: 'CC-AMARA-2049183',
        vitalsDoneAt: daysAgo(40),
        withDoctorAt: daysAgo(40),
        completedAt: daysAgo(40),
        vitals: {
          systolicBp: 118,
          diastolicBp: 74,
          temperatureC: 36.7,
          pulseBpm: 78,
          weightKg: 68,
          heightCm: 164,
          spo2: 99,
          abnormalFlags: [],
          recordedAt: daysAgo(40),
          recordedBy: 'staff-nurse',
        },
        diagnosis: 'Uncomplicated pregnancy — routine visit',
        prescription: 'Prenatal vitamins 1 tab daily',
        notes: 'Fetal movement normal. Next visit in 4 weeks.',
        disposition: 'DISCHARGED',
        history: 'G2P1. No allergies.',
        paidAt: daysAgo(40),
        paidBy: 'staff-cashier',
        receiptNo: 'RCP-00001',
        orders: [
          { id: 'ord-amara-reg', serviceId: 'reg-folder', name: 'Patient folder / registration', department: 'RECORDS', priceGhs: 20, status: 'DONE', paidAt: daysAgo(40), paidBy: 'staff-reception' },
          { id: 'ord-amara-opd', serviceId: 'opd-general', name: 'General OPD consultation', department: 'CONSULTATION', priceGhs: 50, status: 'DONE', paidAt: daysAgo(40), paidBy: 'staff-reception' },
          { id: 'ord-amara-anc', serviceId: 'mat-anc', name: 'Antenatal visit', department: 'MATERNITY', priceGhs: 40, status: 'DONE', paidAt: daysAgo(40), paidBy: 'staff-cashier' },
          { id: 'ord-amara-rx', serviceId: 'rx-prenatal', name: 'Prenatal vitamins', department: 'PHARMACY', priceGhs: 20, status: 'DONE', paidAt: daysAgo(40), paidBy: 'staff-pharmacy' },
        ],
      },
      {
        id: 'vis-omar',
        patientId: 'pat-omar',
        clinic: 'REVIEW',
        reason: 'Wound review after laceration repair',
        stage: 'COMPLETED',
        checkedInAt: minutesAgo(65),
        checkedInBy: 'staff-reception',
        vitalsDoneAt: minutesAgo(50),
        withDoctorAt: minutesAgo(40),
        completedAt: minutesAgo(12),
        vitals: {
          systolicBp: 128,
          diastolicBp: 82,
          temperatureC: 37.1,
          pulseBpm: 72,
          weightKg: 81,
          heightCm: 180,
          spo2: 98,
          abnormalFlags: [],
          recordedAt: minutesAgo(50),
          recordedBy: 'staff-nurse',
        },
        diagnosis: 'Healing laceration, no infection',
        prescription: 'Continue wound care; paracetamol 500mg PRN',
        notes: 'Sutures intact. Remove in 5 days.',
        disposition: 'DISCHARGED',
        history: 'Tetanus booster given at injury visit.',
        paidAt: minutesAgo(10),
        paidBy: 'staff-cashier',
        receiptNo: 'RCP-00002',
        orders: [
          { id: 'ord-omar-reg', serviceId: 'reg-folder', name: 'Patient folder / registration', department: 'RECORDS', priceGhs: 20, status: 'DONE', paidAt: minutesAgo(62), paidBy: 'staff-reception' },
          { id: 'ord-omar-opd', serviceId: 'opd-review', name: 'Review / follow-up consultation', department: 'CONSULTATION', priceGhs: 30, status: 'DONE', paidAt: minutesAgo(62), paidBy: 'staff-reception' },
          { id: 'ord-omar-dress', serviceId: 'nurs-dress-min', name: 'Wound dressing (minor)', department: 'NURSING', priceGhs: 25, status: 'DONE', paidAt: minutesAgo(14), paidBy: 'staff-nurse' },
          { id: 'ord-omar-pcm', serviceId: 'rx-pcm', name: 'Paracetamol 500mg (blister)', department: 'PHARMACY', priceGhs: 8, status: 'DONE', paidAt: minutesAgo(12), paidBy: 'staff-pharmacy' },
        ],
      },
    ],
  });
}
