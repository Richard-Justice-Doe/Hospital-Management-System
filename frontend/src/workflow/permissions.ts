import type { Department, PageKey, StaffRole } from './types';

export type { PageKey };

export const PAGE_LABELS: Record<PageKey, string> = {
  dashboard: 'Dashboard',
  chart: 'Patient chart',
  appointments: 'Appointments',
  assistant: 'AI assistant',
  reception: 'Reception',
  nursing: 'Nursing',
  triage: 'ED triage',
  ward: 'Ward / ADT',
  theatre: 'Theatre',
  doctor: 'Doctor',
  lab: 'Laboratory',
  xray: 'X-ray / imaging',
  physio: 'Physiotherapy',
  pharmacy: 'Pharmacy',
  eye: 'Eye clinic',
  ent: 'ENT clinic',
  dental: 'Dental clinic',
  maternity: 'Maternity / ANC',
  billing: 'Cash unit',
  collections: 'Collections',
  claims: 'Claims',
  stores: 'Stores',
  procurement: 'Procurement',
  it: 'IT support',
  messages: 'Messages',
  shifts: 'Shifts',
  clinical: 'Clinical chart',
  admin: 'Admin',
};

export const PAGE_PATH: Record<PageKey, string> = {
  dashboard: '/care/dashboard',
  chart: '/care/chart',
  appointments: '/care/appointments',
  assistant: '/care/assistant',
  reception: '/care/reception',
  nursing: '/care/nursing',
  triage: '/care/triage',
  ward: '/care/ward',
  theatre: '/care/theatre',
  doctor: '/care/doctor',
  lab: '/care/lab',
  xray: '/care/xray',
  physio: '/care/physio',
  pharmacy: '/care/pharmacy',
  eye: '/care/eye',
  ent: '/care/ent',
  dental: '/care/dental',
  maternity: '/care/maternity',
  billing: '/care/billing',
  collections: '/care/billing',
  claims: '/care/claims',
  stores: '/care/stores',
  procurement: '/care/procurement',
  it: '/care/it',
  messages: '/care/messages',
  shifts: '/care/shifts',
  clinical: '/care/chart',
  admin: '/care/admin',
};

export type GrantablePage = Exclude<PageKey, 'admin'>;

export const GRANTABLE_PAGES: GrantablePage[] = (Object.keys(PAGE_LABELS) as PageKey[]).filter(
  (page): page is GrantablePage => page !== 'admin',
);

const DESK_TOOLS: PageKey[] = ['chart', 'messages', 'shifts', 'assistant'];

export const REQUIRED_PAGES: PageKey[] = ['dashboard'];

export const ROLE_HOME_PAGE: Record<StaffRole, PageKey> = {
  ADMIN: 'admin',
  RECEPTIONIST: 'reception',
  NURSE: 'nursing',
  DOCTOR: 'doctor',
  PHARMACIST: 'pharmacy',
  LAB: 'lab',
  RADIOLOGY: 'xray',
  PHYSIO: 'physio',
  CASHIER: 'billing',
  ACCOUNTANT: 'collections',
  EYE_DOCTOR: 'eye',
  EYE_NURSE: 'eye',
  ENT_DOCTOR: 'ent',
  ENT_NURSE: 'ent',
  DENTIST: 'dental',
  MIDWIFE: 'maternity',
  MATRON: 'nursing',
  CLAIMS: 'claims',
  STOREKEEPER: 'stores',
  PROCUREMENT: 'procurement',
  IT: 'it',
};

export function homeDashboardPage(access: { role: StaffRole; department?: Department }): PageKey {
  if (access.role === 'ADMIN') return 'admin';
  if (access.department) return DEPARTMENT_PAGE[access.department];
  return ROLE_HOME_PAGE[access.role];
}

export function roleWorkPages(role: StaffRole, department?: Department, granted?: PageKey[]): PageKey[] {
  if (role === 'ADMIN') return Object.keys(PAGE_LABELS) as PageKey[];
  if (granted && granted.length > 0) {
    const pages = new Set<PageKey>(['dashboard', ...granted.filter((page) => page !== 'admin')]);
    return GRANTABLE_PAGES.filter((page) => pages.has(page));
  }
  const home = department ? DEPARTMENT_PAGE[department] : ROLE_HOME_PAGE[role];
  const pages = new Set<PageKey>(['dashboard', home, ...DESK_TOOLS]);
  if (role === 'RECEPTIONIST' || home === 'reception') {
    pages.add('reception');
    pages.add('appointments');
  }
  if (role === 'DOCTOR' || role === 'EYE_DOCTOR' || role === 'ENT_DOCTOR' || home === 'doctor') {
    pages.add('doctor');
    pages.add('appointments');
    pages.add('clinical');
  }
  if (role === 'MATRON') {
    pages.add('nursing');
    pages.add('ward');
    pages.add('maternity');
    pages.add('triage');
    pages.add('chart');
  }
  if (role === 'CASHIER') pages.add('billing');
  if (role === 'ACCOUNTANT') {
    pages.add('collections');
    pages.delete('chart');
    pages.delete('clinical');
  }
  if (role === 'PROCUREMENT' || home === 'procurement') {
    pages.add('procurement');
    pages.add('stores');
  }
  if (role === 'STOREKEEPER' || home === 'stores') pages.add('stores');
  return GRANTABLE_PAGES.filter((page) => pages.has(page));
}

export const ROLE_PAGES: Record<StaffRole, PageKey[]> = {
  ADMIN: Object.keys(PAGE_LABELS) as PageKey[],
  RECEPTIONIST: roleWorkPages('RECEPTIONIST'),
  NURSE: roleWorkPages('NURSE'),
  DOCTOR: roleWorkPages('DOCTOR'),
  PHARMACIST: roleWorkPages('PHARMACIST'),
  LAB: roleWorkPages('LAB'),
  RADIOLOGY: roleWorkPages('RADIOLOGY'),
  PHYSIO: roleWorkPages('PHYSIO'),
  CASHIER: roleWorkPages('CASHIER'),
  ACCOUNTANT: roleWorkPages('ACCOUNTANT'),
  EYE_DOCTOR: roleWorkPages('EYE_DOCTOR'),
  EYE_NURSE: roleWorkPages('EYE_NURSE'),
  ENT_DOCTOR: roleWorkPages('ENT_DOCTOR'),
  ENT_NURSE: roleWorkPages('ENT_NURSE'),
  DENTIST: roleWorkPages('DENTIST'),
  MIDWIFE: roleWorkPages('MIDWIFE'),
  MATRON: roleWorkPages('MATRON'),
  CLAIMS: roleWorkPages('CLAIMS'),
  STOREKEEPER: roleWorkPages('STOREKEEPER'),
  PROCUREMENT: roleWorkPages('PROCUREMENT'),
  IT: roleWorkPages('IT'),
};

export interface StaffAccess {
  role: StaffRole;
  department?: Department;
  extra?: PageKey[];
  hidden?: PageKey[];
  rolePages?: PageKey[];
}

export function roleDefaultPages(role: StaffRole, department?: Department, granted?: PageKey[]): PageKey[] {
  return roleWorkPages(role, department, granted);
}

export function effectivePages(access: StaffAccess): PageKey[] {
  const defaults = new Set(roleWorkPages(access.role, access.department, access.rolePages));
  for (const page of access.hidden ?? []) {
    if (page !== 'admin') defaults.delete(page);
  }
  for (const page of access.extra ?? []) {
    if (page !== 'admin') defaults.add(page);
  }
  for (const page of REQUIRED_PAGES) defaults.add(page);
  if (access.role !== 'ADMIN') defaults.delete('admin');
  else defaults.add('admin');
  const pages: PageKey[] = GRANTABLE_PAGES.filter((page) => defaults.has(page));
  if (access.role === 'ADMIN') pages.push('admin');
  return pages;
}

export function canAccessPage(access: StaffAccess | null | undefined, page: PageKey): boolean {
  if (!access) return false;
  return effectivePages(access).includes(page);
}

export function canAccessAny(access: StaffAccess | null | undefined, pages: PageKey[]): boolean {
  return pages.some((page) => canAccessPage(access, page));
}

export function pagesFromChecks(
  role: StaffRole,
  checked: PageKey[],
  department?: Department,
  granted?: PageKey[],
): { extra: PageKey[]; hidden: PageKey[] } {
  const defaults = new Set(roleDefaultPages(role, department, granted).filter((page) => page !== 'admin'));
  const on = new Set(checked.filter((page) => page !== 'admin'));
  return {
    extra: GRANTABLE_PAGES.filter((page) => on.has(page) && !defaults.has(page)),
    hidden: GRANTABLE_PAGES.filter((page) => defaults.has(page) && !on.has(page) && !REQUIRED_PAGES.includes(page)),
  };
}

export type PageGrant = 'required' | 'default' | 'extra' | 'hidden' | 'off' | 'admin';

export function pageGrant(page: PageKey, access: StaffAccess): PageGrant {
  if (page === 'admin') return access.role === 'ADMIN' ? 'admin' : 'off';
  if (REQUIRED_PAGES.includes(page)) return 'required';
  const allowed = effectivePages(access);
  const defaults = new Set(roleWorkPages(access.role, access.department, access.rolePages));
  if (allowed.includes(page) && !defaults.has(page)) return 'extra';
  if (!allowed.includes(page) && defaults.has(page)) return 'hidden';
  if (allowed.includes(page)) return 'default';
  return 'off';
}

export const PAGE_GROUPS: Array<{ label: string; pages: PageKey[] }> = [
  { label: 'Always on', pages: ['dashboard'] },
  { label: 'Desk tools', pages: ['chart', 'clinical', 'appointments', 'messages', 'shifts', 'assistant'] },
  { label: 'Department work', pages: ['reception', 'nursing', 'doctor', 'lab', 'pharmacy', 'xray', 'physio', 'eye', 'ent', 'dental', 'maternity', 'triage', 'ward', 'theatre'] },
  { label: 'Accounts', pages: ['billing', 'collections'] },
  { label: 'Hospital support', pages: ['claims', 'stores', 'procurement', 'it'] },
];

export const ROLE_BLURBS: Record<StaffRole, string> = {
  ADMIN: 'Hospital setup, user management, and remove bills. Does not receive cash.',
  RECEPTIONIST: 'Patient administration: folders, copayer, check-in, and appointments.',
  NURSE: 'Nursing queue, vitals, and this person’s department desk.',
  DOCTOR: 'Consults, orders, and appointments.',
  PHARMACIST: 'Pharmacy dispense queue and stock.',
  LAB: 'Laboratory work queue.',
  RADIOLOGY: 'X-ray and imaging queue.',
  PHYSIO: 'Physiotherapy sessions.',
  CASHIER: 'Cash unit: generate bills, deposits, and receipts. Cannot remove a bill.',
  ACCOUNTANT: 'Hospital money books — no clinical notes.',
  EYE_DOCTOR: 'Eye clinic consults.',
  EYE_NURSE: 'Eye clinic nursing work.',
  ENT_DOCTOR: 'ENT clinic consults.',
  ENT_NURSE: 'ENT clinic nursing work.',
  DENTIST: 'Dental clinic work.',
  MIDWIFE: 'Maternity and ANC.',
  MATRON: 'Hospital matron: nursing, ward, maternity, and staff on those desks.',
  CLAIMS: 'NHIS, Ghana Card, and private insurance claims.',
  STOREKEEPER: 'Central stores, issues to departments, and goods received.',
  PROCUREMENT: 'Purchase requests, orders, and supplier receipts.',
  IT: 'Tickets, assets, lockouts, passwords, system health, and audit.',
};

export function generateStaffPassword(): string {
  return `Staff${1000 + Math.floor(Math.random() * 9000)}!`;
}

export const PATH_PAGES: Array<{ match: (path: string) => boolean; pages: PageKey[] }> = [
  { match: (path) => path.startsWith('/care/admin'), pages: ['admin'] },
  { match: (path) => path.startsWith('/care/reception'), pages: ['reception'] },
  { match: (path) => path.startsWith('/care/billing'), pages: ['billing', 'collections'] },
  { match: (path) => path.startsWith('/care/claims'), pages: ['claims'] },
  { match: (path) => path.startsWith('/care/stores'), pages: ['stores'] },
  { match: (path) => path.startsWith('/care/procurement'), pages: ['procurement'] },
  { match: (path) => path.startsWith('/care/it'), pages: ['it'] },
  { match: (path) => path.startsWith('/care/appointments'), pages: ['appointments'] },
  { match: (path) => path.startsWith('/care/assistant'), pages: ['assistant'] },
  { match: (path) => path.startsWith('/care/chart'), pages: ['chart', 'clinical'] },
  { match: (path) => path.startsWith('/care/nursing'), pages: ['nursing'] },
  { match: (path) => path.startsWith('/care/triage'), pages: ['triage'] },
  { match: (path) => path.startsWith('/care/ward'), pages: ['ward'] },
  { match: (path) => path.startsWith('/care/theatre'), pages: ['theatre'] },
  { match: (path) => path.startsWith('/care/doctor'), pages: ['doctor'] },
  { match: (path) => path.startsWith('/care/lab'), pages: ['lab'] },
  { match: (path) => path.startsWith('/care/xray'), pages: ['xray'] },
  { match: (path) => path.startsWith('/care/physio'), pages: ['physio'] },
  { match: (path) => path.startsWith('/care/pharmacy'), pages: ['pharmacy'] },
  { match: (path) => path.startsWith('/care/eye'), pages: ['eye'] },
  { match: (path) => path.startsWith('/care/ent'), pages: ['ent'] },
  { match: (path) => path.startsWith('/care/dental'), pages: ['dental'] },
  { match: (path) => path.startsWith('/care/maternity'), pages: ['maternity'] },
  { match: (path) => path.startsWith('/care/messages'), pages: ['messages'] },
  { match: (path) => path.startsWith('/care/shifts'), pages: ['shifts'] },
  { match: (path) => path.startsWith('/care/dashboard') || path === '/' || path === '', pages: ['dashboard'] },
];

export function pagesForPath(pathname: string): PageKey[] {
  return PATH_PAGES.find((row) => row.match(pathname))?.pages ?? ['dashboard'];
}

export const DEPARTMENT_PAGE: Record<Department, PageKey> = {
  RECORDS: 'reception',
  CONSULTATION: 'doctor',
  NURSING: 'nursing',
  LAB: 'lab',
  PHARMACY: 'pharmacy',
  RADIOLOGY: 'xray',
  PHYSIO: 'physio',
  DENTAL: 'dental',
  EYE: 'eye',
  ENT: 'ent',
  MATERNITY: 'maternity',
  THEATRE: 'theatre',
  WARD: 'ward',
  CLAIMS: 'claims',
  STORES: 'stores',
  PROCUREMENT: 'procurement',
  IT: 'it',
};
