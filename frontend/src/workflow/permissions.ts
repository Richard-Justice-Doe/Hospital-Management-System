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
  billing: 'Receive payment',
  collections: 'Collections',
  messages: 'Messages',
  shifts: 'Shifts',
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
  messages: '/care/messages',
  shifts: '/care/shifts',
  admin: '/care/admin',
};

export type GrantablePage = Exclude<PageKey, 'admin'>;

export const GRANTABLE_PAGES: GrantablePage[] = (Object.keys(PAGE_LABELS) as PageKey[]).filter(
  (page): page is GrantablePage => page !== 'admin',
);

const SHARED: PageKey[] = ['dashboard', 'chart', 'assistant', 'messages', 'shifts'];

export const ROLE_PAGES: Record<StaffRole, PageKey[]> = {
  ADMIN: Object.keys(PAGE_LABELS) as PageKey[],
  RECEPTIONIST: [...SHARED, 'appointments', 'reception', 'triage'],
  NURSE: [...SHARED, 'nursing', 'triage', 'ward', 'theatre'],
  DOCTOR: [...SHARED, 'appointments', 'doctor', 'triage', 'ward', 'theatre'],
  PHARMACIST: [...SHARED, 'pharmacy'],
  LAB: [...SHARED, 'lab'],
  RADIOLOGY: [...SHARED, 'xray'],
  PHYSIO: [...SHARED, 'physio'],
  CASHIER: [...SHARED, 'billing'],
  ACCOUNTANT: [...SHARED, 'collections'],
  EYE_DOCTOR: [...SHARED, 'eye'],
  EYE_NURSE: [...SHARED, 'eye'],
  ENT_DOCTOR: [...SHARED, 'ent'],
  ENT_NURSE: [...SHARED, 'ent'],
  DENTIST: [...SHARED, 'dental'],
  MIDWIFE: [...SHARED, 'maternity'],
};

export interface StaffAccess {
  role: StaffRole;
  extra?: PageKey[];
  hidden?: PageKey[];
}

export function roleDefaultPages(role: StaffRole): PageKey[] {
  return ROLE_PAGES[role];
}

export function effectivePages(access: StaffAccess): PageKey[] {
  const defaults = new Set(roleDefaultPages(access.role));
  for (const page of access.hidden ?? []) {
    if (page !== 'admin') defaults.delete(page);
  }
  for (const page of access.extra ?? []) {
    if (page !== 'admin') defaults.add(page);
  }
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

export function pagesFromChecks(role: StaffRole, checked: PageKey[]): { extra: PageKey[]; hidden: PageKey[] } {
  const defaults = new Set(roleDefaultPages(role).filter((page) => page !== 'admin'));
  const on = new Set(checked.filter((page) => page !== 'admin'));
  return {
    extra: GRANTABLE_PAGES.filter((page) => on.has(page) && !defaults.has(page)),
    hidden: GRANTABLE_PAGES.filter((page) => defaults.has(page) && !on.has(page)),
  };
}

export const PATH_PAGES: Array<{ match: (path: string) => boolean; pages: PageKey[] }> = [
  { match: (path) => path.startsWith('/care/admin'), pages: ['admin'] },
  { match: (path) => path.startsWith('/care/reception'), pages: ['reception'] },
  { match: (path) => path.startsWith('/care/billing'), pages: ['billing', 'collections'] },
  { match: (path) => path.startsWith('/care/appointments'), pages: ['appointments'] },
  { match: (path) => path.startsWith('/care/assistant'), pages: ['assistant'] },
  { match: (path) => path.startsWith('/care/chart'), pages: ['chart'] },
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
};
