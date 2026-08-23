export type Gender = 'Female' | 'Male' | 'Other';

export type InsuranceType = 'GOVERNMENT' | 'PRIVATE' | 'CASH';

export type CopayerRelationship =
  | 'Self'
  | 'Parent'
  | 'Spouse'
  | 'Child'
  | 'Sibling'
  | 'Guardian'
  | 'Employer'
  | 'Other';

export type VisitStage =
  | 'CHECKED_IN'
  | 'VITALS_DONE'
  | 'WITH_DOCTOR'
  | 'AWAITING_SERVICES'
  | 'READY_TO_BILL'
  | 'COMPLETED';

export type VisitDisposition = 'DISCHARGED' | 'REFERRED' | 'ADMITTED';

export type PageKey =
  | 'dashboard'
  | 'chart'
  | 'appointments'
  | 'assistant'
  | 'reception'
  | 'nursing'
  | 'triage'
  | 'ward'
  | 'theatre'
  | 'doctor'
  | 'lab'
  | 'xray'
  | 'physio'
  | 'pharmacy'
  | 'eye'
  | 'ent'
  | 'dental'
  | 'maternity'
  | 'billing'
  | 'collections'
  | 'claims'
  | 'stores'
  | 'procurement'
  | 'it'
  | 'messages'
  | 'shifts'
  | 'clinical'
  | 'admin';

export type StaffRole =
  | 'ADMIN'
  | 'RECEPTIONIST'
  | 'NURSE'
  | 'DOCTOR'
  | 'PHARMACIST'
  | 'LAB'
  | 'RADIOLOGY'
  | 'PHYSIO'
  | 'CASHIER'
  | 'ACCOUNTANT'
  | 'EYE_DOCTOR'
  | 'EYE_NURSE'
  | 'ENT_DOCTOR'
  | 'ENT_NURSE'
  | 'DENTIST'
  | 'MIDWIFE'
  | 'MATRON'
  | 'CLAIMS'
  | 'STOREKEEPER'
  | 'PROCUREMENT'
  | 'IT';

export type ClinicId =
  | 'GENERAL'
  | 'REVIEW'
  | 'EMERGENCY'
  | 'SPECIALIST'
  | 'EYE'
  | 'ENT'
  | 'DENTAL'
  | 'PHYSIO'
  | 'MATERNITY';

export type Department =
  | 'RECORDS'
  | 'CONSULTATION'
  | 'NURSING'
  | 'LAB'
  | 'PHARMACY'
  | 'RADIOLOGY'
  | 'PHYSIO'
  | 'DENTAL'
  | 'EYE'
  | 'ENT'
  | 'MATERNITY'
  | 'THEATRE'
  | 'WARD'
  | 'CLAIMS'
  | 'STORES'
  | 'PROCUREMENT'
  | 'IT';

export type OrderStatus = 'ORDERED' | 'DONE';

export interface StaffAccount {
  id: string;
  email: string;
  /** Short sign-in name, e.g. admin. Email still works. */
  username?: string;
  firstName: string;
  lastName: string;
  role: StaffRole;
  password: string;
  isActive: boolean;
  createdAt: string;
  /** Home department this person belongs to. */
  department?: Department;
  /** When set, this person is in-charge of that department only. Admin still owns hospital setup. */
  inChargeOf?: Department;
  /** Extra pages Admin granted, and default pages Admin hid, for this person. */
  permissions?: { extra?: PageKey[]; hidden?: PageKey[] };
  licenseNo?: string;
  licenseExpires?: string;
  credentials?: string;
  lastAccessReviewAt?: string;
  /** Mobile number for shift SMS. Ghana format e.g. 024 111 0101. */
  phone?: string;
  /** Monthly pay in Ghana cedis. Accountant sets and pays this. */
  salaryGhs?: number;
}

export interface PatientRecord {
  id: string;
  hospitalNo: string;
  firstName: string;
  lastName: string;
  age: number;
  dateOfBirth?: string;
  gender: Gender;
  phone: string;
  email?: string;
  address?: string;
  town?: string;
  insuranceType?: InsuranceType;
  insuranceProvider?: string;
  insuranceNumber?: string;
  ghanaCardNo?: string;
  hinNumber?: string;
  photoUrl?: string;
  createdAt: string;
  folderCreatedAt?: string;
  folderCreatedBy?: string;
  relatedStaffId?: string;
  staffRelation?: CopayerRelationship | 'Self';
  portalPin?: string;
  nationalId?: string;
  mergedIntoId?: string;
  preferredLanguage?: string;
}

export interface CopayerRecord {
  id: string;
  patientId: string;
  firstName: string;
  lastName: string;
  relationship: CopayerRelationship;
  phone: string;
  address?: string;
  isPrimary: boolean;
  createdAt: string;
}

export interface VitalsRecord {
  systolicBp: number;
  diastolicBp: number;
  temperatureC: number;
  pulseBpm: number;
  weightKg: number;
  heightCm: number;
  spo2: number;
  abnormalFlags: string[];
  recordedAt: string;
  recordedBy: string;
}

export interface HospitalService {
  id: string;
  name: string;
  department: Department;
  priceGhs: number;
  enabled: boolean;
}

export interface ServiceOrder {
  id: string;
  serviceId: string;
  name: string;
  department: Department;
  priceGhs: number;
  status: OrderStatus;
  result?: string;
  completedAt?: string;
  paidAt?: string;
  paidBy?: string;
  chargeable?: boolean;
  needsDoctorReview?: boolean;
  labLines?: LabLine[];
  accessionNo?: string;
  idempotencyKey?: string;
}

export type LabFlag = '' | 'H' | 'L';

export interface LabLine {
  id: string;
  name: string;
  value: string;
  unit: string;
  flag: LabFlag;
}

export type PayMethod = 'CASH' | 'MOMO' | 'NHIS' | 'CARD' | 'BANK';

export type FinanceReasonCode = 'STAFF' | 'HARDSHIP' | 'ERROR' | 'BAD_DEBT' | 'DUPLICATE' | 'OTHER';
export type FinanceAdjustKind = 'DISCOUNT' | 'WRITE_OFF' | 'VOID' | 'REFUND';
export type FinanceAdjustStatus = 'PENDING' | 'APPROVED' | 'DENIED';
export type ExpenseCategory = 'PHARMACY' | 'EQUIPMENT' | 'UTILITIES' | 'PAYROLL' | 'OTHER';
export type VendorInvoiceStatus = 'DRAFT' | 'MATCHED' | 'APPROVED' | 'PAID';
export type AgingBucket = '0-30' | '31-60' | '61-90' | '90+';

export interface FinanceAdjustmentRecord {
  id: string;
  visitId: string;
  kind: FinanceAdjustKind;
  amountGhs: number;
  reasonCode: FinanceReasonCode;
  reason: string;
  status: FinanceAdjustStatus;
  requestedBy: string;
  requestedAt: string;
  approvedBy?: string;
  approvedAt?: string;
}

export interface PaymentPlanRecord {
  id: string;
  visitId: string;
  instalments: number;
  note: string;
  createdBy: string;
  createdAt: string;
}

export interface VendorInvoiceRecord {
  id: string;
  invoiceNo: string;
  vendorId: string;
  poId?: string;
  amountGhs: number;
  category: ExpenseCategory;
  status: VendorInvoiceStatus;
  at: string;
  receivedAt?: string;
  approvedBy?: string;
  paidAt?: string;
  paidBy?: string;
  note?: string;
}

export interface BankTxnRecord {
  id: string;
  at: string;
  amountGhs: number;
  direction: 'IN' | 'OUT';
  reference: string;
  matchedId?: string;
  matchedKind?: 'RECEIPT' | 'CLAIM' | 'VENDOR' | 'PAYROLL';
}

export interface PeriodLockRecord {
  id: string;
  period: string;
  lockedBy: string;
  lockedAt: string;
}

export interface PreAuthRecord {
  id: string;
  visitId: string;
  payer: string;
  ref: string;
  status: 'PENDING' | 'APPROVED' | 'DENIED';
  at: string;
}

export interface EobRecord {
  id: string;
  claimId: string;
  amountGhs: number;
  paidGhs: number;
  ref: string;
  at: string;
}

export interface VisitRecord {
  id: string;
  patientId: string;
  clinic: ClinicId;
  reason: string;
  stage: VisitStage;
  checkedInAt: string;
  checkedInBy: string;
  vitalsDoneAt?: string;
  withDoctorAt?: string;
  completedAt?: string;
  vitals?: VitalsRecord;
  diagnosis?: string;
  prescription?: string;
  notes?: string;
  disposition?: VisitDisposition;
  referredTo?: string;
  history?: string;
  orders: ServiceOrder[];
  paidAt?: string;
  paidBy?: string;
  receiptNo?: string;
  copayerId?: string;
  billable?: boolean;
  waivedReason?: string;
  billingDecidedAt?: string;
  billingDecidedBy?: string;
  esiScore?: 1 | 2 | 3 | 4 | 5;
  bedId?: string;
  taxPercent?: number;
  soapSubjective?: string;
  soapObjective?: string;
  soapAssessment?: string;
  soapPlan?: string;
  paymentMethod?: PayMethod;
  payLaterReason?: string;
  nhisCcCode?: string;
  witnessId?: string;
  /** Daily walk-in ticket number, reset each day. */
  queueNo?: number;
}

export interface BudgetRecord {
  id: string;
  period: string;
  allocatedGhs: number;
  note?: string;
  setBy: string;
  at: string;
}

export interface PayrollRecord {
  id: string;
  staffId: string;
  period: string;
  amountGhs: number;
  paidAt: string;
  paidBy: string;
  note?: string;
}

export interface CashCloseRecord {
  id: string;
  date: string;
  staffId: string;
  counted: number;
  systemTotal: number;
  note?: string;
  at: string;
}

export interface HandoverRecord {
  id: string;
  department: Department;
  note: string;
  staffId: string;
  at: string;
}

export type NoteSensitivity = 'GENERAL' | 'PSYCH' | 'SUBSTANCE';
export type AppointmentStatus = 'BOOKED' | 'CONFIRMED' | 'CHECKED_IN' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
export type ClaimStatus = 'DRAFT' | 'ELIGIBLE' | 'SUBMITTED' | 'PAID' | 'DENIED';
export type ClaimScheme = 'NHIS' | 'PRIVATE';
export type PurchaseStatus = 'REQUESTED' | 'ORDERED' | 'RECEIVED' | 'CANCELLED';
export type BedStatus = 'FREE' | 'OCCUPIED' | 'CLEANING';
export type AdtType = 'ADMIT' | 'TRANSFER' | 'DISCHARGE';
export type MarStatus = 'DUE' | 'GIVEN' | 'HELD' | 'REFUSED';
export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface AllergyRecord {
  id: string;
  patientId: string;
  substance: string;
  reaction: string;
  severity: 'mild' | 'moderate' | 'severe';
  recordedAt: string;
  recordedBy: string;
}

export interface ProblemRecord {
  id: string;
  patientId: string;
  name: string;
  icdHint?: string;
  status: 'active' | 'resolved';
  recordedAt: string;
  recordedBy: string;
}

export interface MedicationRecord {
  id: string;
  patientId: string;
  visitId?: string;
  name: string;
  sig: string;
  drugClass: string;
  controlled: boolean;
  status: 'active' | 'stopped';
  recordedAt: string;
  recordedBy: string;
}

export interface ImmunizationRecord {
  id: string;
  patientId: string;
  vaccine: string;
  dose: string;
  givenAt: string;
  recordedBy: string;
}

export interface CarePlanRecord {
  id: string;
  patientId: string;
  visitId: string;
  goal: string;
  steps: string;
  createdAt: string;
  createdBy: string;
}

export interface ClinicalNoteRecord {
  id: string;
  patientId: string;
  visitId?: string;
  sensitivity: NoteSensitivity;
  title: string;
  body: string;
  createdAt: string;
  createdBy: string;
}

export interface FamilyLinkRecord {
  id: string;
  patientId: string;
  relatedPatientId: string;
  relationship: CopayerRelationship;
}

export interface AppointmentRecord {
  id: string;
  patientId: string;
  providerId: string;
  clinic: ClinicId;
  startsAt: string;
  durationMin: number;
  reason: string;
  status: AppointmentStatus;
  resource: string;
  recurring?: 'weekly' | 'monthly';
  reminderAt?: string;
  reminderSent?: boolean;
  createdBy: string;
}

export interface WaitlistRecord {
  id: string;
  patientId: string;
  clinic: ClinicId;
  reason: string;
  createdAt: string;
}

export interface OrderSetRecord {
  id: string;
  name: string;
  serviceIds: string[];
}

export interface SampleRecord {
  id: string;
  visitId: string;
  orderId: string;
  accessionNo: string;
  collectedAt: string;
  collectedBy: string;
}

export interface ImagingStudyRecord {
  id: string;
  visitId: string;
  orderId: string;
  modality: string;
  report: string;
  dicomUid: string;
  createdAt: string;
}

export interface DrugStockRecord {
  id: string;
  serviceId: string;
  name: string;
  quantity: number;
  reorderAt: number;
  expiresOn: string;
  controlled: boolean;
  drugClass: string;
}

export interface ControlledLogRecord {
  id: string;
  stockId: string;
  visitId: string;
  quantity: number;
  witness: string;
  staffId: string;
  at: string;
}

export interface BedRecord {
  id: string;
  label: string;
  ward: 'WARD' | 'ED' | 'OT';
  status: BedStatus;
  patientId?: string;
  visitId?: string;
}

export interface AdtEventRecord {
  id: string;
  visitId: string;
  patientId: string;
  type: AdtType;
  bedId?: string;
  at: string;
  staffId: string;
  note?: string;
}

export interface MarEntryRecord {
  id: string;
  visitId: string;
  patientId: string;
  medicationId: string;
  dueAt: string;
  status: MarStatus;
  givenAt?: string;
  givenBy?: string;
}

export interface IoEntryRecord {
  id: string;
  visitId: string;
  patientId: string;
  kind: 'IN' | 'OUT';
  amountMl: number;
  note: string;
  at: string;
  staffId: string;
}

export interface OtCaseRecord {
  id: string;
  visitId: string;
  patientId: string;
  procedure: string;
  startsAt: string;
  otBedId: string;
  preopDone: boolean;
  surgicalNotes: string;
  anesthesia: string;
  status: 'SCHEDULED' | 'IN_THEATRE' | 'RECOVERY' | 'DONE';
}

export interface TriageRecord {
  id: string;
  visitId: string;
  patientId: string;
  esi: 1 | 2 | 3 | 4 | 5;
  complaint: string;
  at: string;
  staffId: string;
}

export interface ClaimRecord {
  id: string;
  visitId: string;
  patientId: string;
  claimNo: string;
  status: ClaimStatus;
  amountGhs: number;
  scheme?: ClaimScheme;
  denialReason?: string;
  updatedAt: string;
  submittedAt?: string;
  submissionRef?: string;
  eligibilityDetail?: string;
  accountsReceivedAt?: string;
  accountsReceivedBy?: string;
}

export interface StoreIssueRecord {
  id: string;
  supplyId: string;
  quantity: number;
  toDepartment: Department;
  issuedBy: string;
  at: string;
  note?: string;
}

export interface PurchaseOrderRecord {
  id: string;
  poNo: string;
  itemName: string;
  quantity: number;
  vendorId: string;
  department: Department;
  status: PurchaseStatus;
  requestedBy: string;
  requestedAt: string;
  orderedAt?: string;
  receivedAt?: string;
  receivedBy?: string;
  note?: string;
  stockId?: string;
  amountGhs?: number;
  accountsReceivedAt?: string;
  accountsReceivedBy?: string;
}

export interface NotificationRecord {
  id: string;
  audience: 'staff' | 'patient';
  patientId?: string;
  staffId?: string;
  title: string;
  body: string;
  kind: 'reminder' | 'lab' | 'billing' | 'critical' | 'system' | 'shift' | 'stock';
  at: string;
  read?: boolean;
  deliveredAt?: string;
}

export interface StaffMessageRecord {
  id: string;
  fromId: string;
  toRole?: StaffRole;
  toId?: string;
  body: string;
  at: string;
}

export interface AuditEvent {
  id: string;
  at: string;
  staffId: string;
  action: string;
  patientId?: string;
  entity: string;
  reason?: string;
  prevHash: string;
  hash: string;
}

export interface BreakGlassRecord {
  id: string;
  patientId: string;
  staffId: string;
  reason: string;
  at: string;
  expiresAt: string;
}

export interface SupplyItemRecord {
  id: string;
  name: string;
  quantity: number;
  reorderAt: number;
  vendorId: string;
}

export interface VendorRecord {
  id: string;
  name: string;
  phone: string;
}

export type ItTicketStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING' | 'RESOLVED';
export type ItTicketPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
export type ItTicketCategory = 'LOGIN' | 'PRINTER' | 'NETWORK' | 'HIS' | 'HARDWARE' | 'OTHER';
export type ItAssetKind = 'PC' | 'PRINTER' | 'PHONE' | 'LICENSE' | 'OTHER';
export type ItAssetStatus = 'IN_USE' | 'SPARE' | 'REPAIR' | 'RETIRED';

export interface ItTicketRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  openedByStaffId: string;
  assignedToStaffId?: string;
  category: ItTicketCategory;
  priority: ItTicketPriority;
  status: ItTicketStatus;
  title: string;
  detail: string;
  location?: string;
  resolution?: string;
}

export interface FailedLoginRecord {
  id: string;
  at: string;
  login: string;
  reason: string;
}

export interface AssetRecord {
  id: string;
  name: string;
  location: string;
  nextMaintenance?: string;
  kind?: ItAssetKind;
  assignedStaffId?: string;
  serial?: string;
  licenseKey?: string;
  status?: ItAssetStatus;
}

export interface ShiftRecord {
  id: string;
  staffId: string;
  department: Department;
  day: string;
  startHour: number;
  endHour: number;
  note?: string;
  createdBy: string;
  createdAt: string;
  notifiedAt?: string;
  emailSent?: boolean;
  smsSent?: boolean;
}

export interface HisCollections {
  allergies: AllergyRecord[];
  problems: ProblemRecord[];
  medications: MedicationRecord[];
  immunizations: ImmunizationRecord[];
  carePlans: CarePlanRecord[];
  clinicalNotes: ClinicalNoteRecord[];
  familyLinks: FamilyLinkRecord[];
  appointments: AppointmentRecord[];
  waitlist: WaitlistRecord[];
  orderSets: OrderSetRecord[];
  samples: SampleRecord[];
  imagingStudies: ImagingStudyRecord[];
  drugStock: DrugStockRecord[];
  controlledLog: ControlledLogRecord[];
  beds: BedRecord[];
  adtEvents: AdtEventRecord[];
  marEntries: MarEntryRecord[];
  ioEntries: IoEntryRecord[];
  otCases: OtCaseRecord[];
  triageRecords: TriageRecord[];
  claims: ClaimRecord[];
  notifications: NotificationRecord[];
  messages: StaffMessageRecord[];
  auditLog: AuditEvent[];
  breakGlass: BreakGlassRecord[];
  supplies: SupplyItemRecord[];
  storeIssues: StoreIssueRecord[];
  purchaseOrders: PurchaseOrderRecord[];
  vendors: VendorRecord[];
  assets: AssetRecord[];
  itTickets: ItTicketRecord[];
  failedLogins: FailedLoginRecord[];
  lastSavedAt?: string;
  shifts: ShiftRecord[];
  cashCloses: CashCloseRecord[];
  budgets: BudgetRecord[];
  payroll: PayrollRecord[];
  financeAdjustments: FinanceAdjustmentRecord[];
  paymentPlans: PaymentPlanRecord[];
  vendorInvoices: VendorInvoiceRecord[];
  bankTxns: BankTxnRecord[];
  periodLocks: PeriodLockRecord[];
  preAuths: PreAuthRecord[];
  eobRecords: EobRecord[];
  handovers: HandoverRecord[];
  nextAccessionSeq: number;
  nextClaimSeq: number;
  nextPoSeq: number;
  rolePageGrants?: Partial<Record<StaffRole, PageKey[]>>;
}

export interface CareState extends HisCollections {
  patients: PatientRecord[];
  visits: VisitRecord[];
  staff: StaffAccount[];
  services: HospitalService[];
  copayers: CopayerRecord[];
  nextHospitalSeq: number;
  nextReceiptSeq: number;
}

export const STAGE_LABELS: Record<VisitStage, string> = {
  CHECKED_IN: 'Checked in',
  VITALS_DONE: 'Vitals done',
  WITH_DOCTOR: 'With doctor',
  AWAITING_SERVICES: 'Lab / X-ray / others',
  READY_TO_BILL: 'Ready to bill',
  COMPLETED: 'Completed',
};

export const STAGE_ORDER: VisitStage[] = [
  'CHECKED_IN',
  'VITALS_DONE',
  'WITH_DOCTOR',
  'AWAITING_SERVICES',
  'READY_TO_BILL',
  'COMPLETED',
];

export const ROLE_LABELS: Record<StaffRole, string> = {
  ADMIN: 'Admin',
  RECEPTIONIST: 'Receptionist',
  NURSE: 'Nurse',
  DOCTOR: 'Doctor',
  PHARMACIST: 'Pharmacist',
  LAB: 'Laboratory',
  RADIOLOGY: 'X-ray / imaging',
  PHYSIO: 'Physiotherapy',
  CASHIER: 'Cashier',
  ACCOUNTANT: 'Accountant',
  EYE_DOCTOR: 'Eye doctor',
  EYE_NURSE: 'Eye nurse',
  ENT_DOCTOR: 'ENT doctor',
  ENT_NURSE: 'ENT nurse',
  DENTIST: 'Dentist',
  MIDWIFE: 'Midwife',
  MATRON: 'Matron',
  CLAIMS: 'Claims officer',
  STOREKEEPER: 'Storekeeper',
  PROCUREMENT: 'Procurement officer',
  IT: 'IT support',
};

export const ROLE_DEPARTMENT: Partial<Record<StaffRole, Department>> = {
  LAB: 'LAB',
  PHARMACIST: 'PHARMACY',
  RADIOLOGY: 'RADIOLOGY',
  PHYSIO: 'PHYSIO',
  NURSE: 'NURSING',
  EYE_DOCTOR: 'EYE',
  EYE_NURSE: 'EYE',
  ENT_DOCTOR: 'ENT',
  ENT_NURSE: 'ENT',
  DENTIST: 'DENTAL',
  MIDWIFE: 'MATERNITY',
  MATRON: 'NURSING',
  CLAIMS: 'CLAIMS',
  STOREKEEPER: 'STORES',
  PROCUREMENT: 'PROCUREMENT',
  IT: 'IT',
};

/** Who can collect cash for which hospital department. Reception and accounts take any remaining bill. */
export const ROLE_BILLABLE_DEPARTMENTS: Record<StaffRole, Department[] | 'ALL'> = {
  ADMIN: [],
  CASHIER: 'ALL',
  ACCOUNTANT: [],
  RECEPTIONIST: [],
  NURSE: ['NURSING'],
  DOCTOR: ['CONSULTATION'],
  PHARMACIST: ['PHARMACY'],
  LAB: ['LAB'],
  RADIOLOGY: ['RADIOLOGY'],
  PHYSIO: ['PHYSIO'],
  EYE_DOCTOR: ['EYE'],
  EYE_NURSE: ['EYE'],
  ENT_DOCTOR: ['ENT'],
  ENT_NURSE: ['ENT'],
  DENTIST: ['DENTAL'],
  MIDWIFE: ['MATERNITY'],
  MATRON: ['NURSING', 'WARD', 'MATERNITY'],
  CLAIMS: [],
  STOREKEEPER: [],
  PROCUREMENT: [],
  IT: [],
};

export const ROLE_INCHARGE_DEPARTMENT: Partial<Record<StaffRole, Department>> = {
  RECEPTIONIST: 'RECORDS',
  DOCTOR: 'CONSULTATION',
  NURSE: 'NURSING',
  LAB: 'LAB',
  PHARMACIST: 'PHARMACY',
  RADIOLOGY: 'RADIOLOGY',
  PHYSIO: 'PHYSIO',
  DENTIST: 'DENTAL',
  EYE_DOCTOR: 'EYE',
  ENT_DOCTOR: 'ENT',
  MIDWIFE: 'MATERNITY',
  MATRON: 'NURSING',
  CLAIMS: 'CLAIMS',
  STOREKEEPER: 'STORES',
  PROCUREMENT: 'PROCUREMENT',
  IT: 'IT',
};

export function isDoctorRole(role?: StaffRole | null): boolean {
  return role === 'DOCTOR' || role === 'EYE_DOCTOR' || role === 'ENT_DOCTOR';
}

export function matronDepartments(): Department[] {
  return ['NURSING', 'WARD', 'MATERNITY'];
}

export function isInCharge(user: { role: StaffRole; inChargeOf?: Department } | null | undefined): boolean {
  if (!user) return false;
  return user.role === 'ADMIN' || user.role === 'MATRON' || Boolean(user.inChargeOf);
}

export function canControlDepartment(
  user: { role: StaffRole; inChargeOf?: Department } | null | undefined,
  department: Department,
): boolean {
  if (!user) return false;
  if (user.role === 'ADMIN') return true;
  if (user.role === 'MATRON') return matronDepartments().includes(department);
  return user.inChargeOf === department;
}

