import { CLINIC_LABELS, formatGhs } from './catalog';
import { unpaidOrders } from './billing';
import { buildDashboardSnapshot, type DashboardPeriod } from './dashboard';
import { findByHospitalNo } from './patientDb';
import { insuranceLabel } from './patientAdmin';
import { averageWaitMinutes, visitsToday } from './store';
import { ROLE_LABELS, STAGE_LABELS, STAGE_ORDER, type CareState, type PatientRecord, type VisitRecord } from './types';

export interface AgentMemory {
  departmentId?: string;
  period?: DashboardPeriod;
}

export interface AgentReply {
  text: string;
  memory: AgentMemory;
  suggestions: string[];
  handled: boolean;
}

const DEFAULT_SUGGESTIONS = [
  'How many visits today?',
  'NHIS vs private',
  'Who has an open visit?',
  'Find patient Amara',
  'Any unpaid bills?',
];

const DEPARTMENT_ALIASES: Array<{ id: string; aliases: string[] }> = [
  { id: 'RECORDS', aliases: ['records', 'registration', 'register', 'folder'] },
  { id: 'GENERAL', aliases: ['general opd', 'general', 'opd'] },
  { id: 'REVIEW', aliases: ['review', 'follow-up', 'follow up'] },
  { id: 'EMERGENCY', aliases: ['emergency', 'casualty', 'a&e'] },
  { id: 'SPECIALIST', aliases: ['specialist'] },
  { id: 'EYE', aliases: ['eye clinic', 'eye', 'ophthalmology'] },
  { id: 'ENT', aliases: ['ent clinic', 'ent'] },
  { id: 'DENTAL', aliases: ['dental clinic', 'dental', 'dentist'] },
  { id: 'PHYSIO', aliases: ['physiotherapy', 'physio'] },
  { id: 'MATERNITY', aliases: ['maternity', 'anc', 'antenatal'] },
  { id: 'NURSING', aliases: ['nursing', 'nurse', 'vitals'] },
  { id: 'LAB', aliases: ['laboratory', 'lab'] },
  { id: 'PHARMACY', aliases: ['pharmacy', 'dispensary'] },
  { id: 'RADIOLOGY', aliases: ['x-ray', 'xray', 'imaging', 'radiology', 'ultrasound'] },
];

function normalize(text: string): string {
  return text.toLowerCase().replace(/[?!.]/g, ' ').replace(/\s+/g, ' ').trim();
}

function hasAny(text: string, words: string[]): boolean {
  return words.some((word) => text.includes(word));
}

function findDepartmentId(text: string): string | undefined {
  const ranked = [...DEPARTMENT_ALIASES].sort((a, b) => b.aliases[0].length - a.aliases[0].length);
  for (const row of ranked) {
    if (row.aliases.some((alias) => text.includes(alias))) return row.id;
  }
  return undefined;
}

function detectPeriod(text: string, memory: AgentMemory): DashboardPeriod {
  if (hasAny(text, ['all time', 'all-time', 'ever', 'overall', 'so far', 'total ever'])) return 'all';
  if (hasAny(text, ['today', 'this morning', "today's"])) return 'today';
  return memory.period ?? 'today';
}

function findPatients(state: CareState, text: string): PatientRecord[] {
  const folder = text.match(/\b(?:A\d{1,5}(?:[/-]\d{4})?|ch[-\s]?\d+|20\d{2}[/-]A?\d+)\b/i);
  if (folder) {
    const found = findByHospitalNo(state.patients, folder[0]);
    if (found) return [found];
    const needle = folder[0].replace(/\s+/g, '').toUpperCase();
    return state.patients.filter((patient) => patient.hospitalNo.replace(/\s+/g, '').toUpperCase().includes(needle));
  }
  const phone = text.match(/\b0\d{2}[\s-]?\d{3}[\s-]?\d{4}\b/);
  if (phone) {
    const digits = phone[0].replace(/\D/g, '');
    return state.patients.filter((patient) => patient.phone.replace(/\D/g, '').includes(digits));
  }
  return state.patients.filter((patient) => {
    const first = patient.firstName.toLowerCase();
    const last = patient.lastName.toLowerCase();
    const full = `${first} ${last}`;
    return (
      (first.length > 2 && new RegExp(`\\b${first}\\b`).test(text)) ||
      (last.length > 2 && new RegExp(`\\b${last}\\b`).test(text)) ||
      text.includes(full)
    );
  });
}

function patientLine(state: CareState, patient: PatientRecord): string {
  const visit = [...state.visits].reverse().find((item) => item.patientId === patient.id);
  const clinic = visit ? CLINIC_LABELS[visit.clinic ?? 'GENERAL'] : 'no open clinic';
  const stage = visit ? STAGE_LABELS[visit.stage] : 'no visit';
  return `${patient.firstName} ${patient.lastName} (${patient.hospitalNo}) · ${insuranceLabel(patient)} · ${clinic} · ${stage}`;
}

function periodLabel(period: DashboardPeriod): string {
  return period === 'today' ? 'today' : 'for all recorded time';
}

function snapshotFor(state: CareState, period: DashboardPeriod, departmentId?: string) {
  const snapshot = buildDashboardSnapshot(state, period);
  const department = departmentId ? snapshot.departments.find((row) => row.id === departmentId) : undefined;
  return { snapshot, department };
}

function openVisits(state: CareState): VisitRecord[] {
  return state.visits.filter((visit) => visit.stage !== 'COMPLETED');
}

function reply(text: string, memory: AgentMemory, suggestions: string[] = DEFAULT_SUGGESTIONS): AgentReply {
  return { text, memory, suggestions, handled: true };
}

export function isClinicOpsQuestion(text: string): boolean {
  const question = normalize(text);
  if (hasAny(question, ['what is nhis', 'what is the nhis', 'how does nhis', 'explain nhis', 'tell me about nhis'])) {
    return false;
  }
  return hasAny(question, [
    'how many',
    'how much',
    'visits today',
    'visits all',
    'check-in',
    'check in',
    'checkins',
    'open visit',
    'unpaid',
    'find patient',
    'search patient',
    'folder number',
    'hospital no',
    'dashboard',
    'pipeline',
    'who has an open',
    'who is waiting',
    'average wait',
    'wait time',
    'waiting time',
    'registrations today',
    'nhis vs',
    'nhis versus',
    'private vs',
    'how do i register',
    'how do i bill',
    'how to bill',
    'new visit',
    'this hospital',
    'our clinic',
    'staff accounts',
    'on duty',
    'ready to bill',
    'receive pay',
  ]);
}

export function answerClinicQuestion(state: CareState, rawQuestion: string, memory: AgentMemory = {}): AgentReply {
  const question = normalize(rawQuestion);
  const departmentId = findDepartmentId(question);
  const period = detectPeriod(question, memory);
  const nextMemory: AgentMemory = { departmentId: departmentId ?? memory.departmentId, period };
  const suggestions = DEFAULT_SUGGESTIONS;

  if (!question) {
    return { text: 'Type a question, then press Ask.', memory, suggestions, handled: false };
  }

  const matchedPatients = findPatients(state, question);
  const looksLikeLookup = hasAny(question, ['find patient', 'search patient', 'folder number', 'hospital no', 'record for', 'patient named']);
  if (matchedPatients.length && looksLikeLookup) {
    if (matchedPatients.length === 1) {
      const patient = matchedPatients[0];
      return reply(
        `I found that record.\n\n${patientLine(state, patient)}\nPhone: ${patient.phone || 'not recorded'}\nTown: ${patient.town || 'not recorded'}`,
        nextMemory,
        ['Who has an open visit?', 'Any unpaid bills?', 'How many visits today?'],
      );
    }
    return reply(
      `I found ${matchedPatients.length} matching patients:\n${matchedPatients.map((patient) => `• ${patientLine(state, patient)}`).join('\n')}`,
      nextMemory,
    );
  }

  if (hasAny(question, ['unpaid', 'outstanding', 'owing', 'not paid', 'to collect']) && !hasAny(question, ['what is', 'explain'])) {
    const owing = state.visits
      .map((visit) => {
        const patient = state.patients.find((item) => item.id === visit.patientId);
        const due = unpaidOrders(visit).reduce((sum, order) => sum + order.priceGhs, 0);
        return { visit, patient, due };
      })
      .filter((row) => row.due > 0);
    if (owing.length === 0) {
      return reply('There are no unpaid chargeable bills in the current records.', nextMemory);
    }
    const total = owing.reduce((sum, row) => sum + row.due, 0);
    const lines = owing.map((row) => {
      const name = row.patient ? `${row.patient.firstName} ${row.patient.lastName}` : 'Unknown';
      return `• ${name} — ${formatGhs(row.due)} (${CLINIC_LABELS[row.visit.clinic ?? 'GENERAL']})`;
    });
    return reply(
      `There ${owing.length === 1 ? 'is 1 unpaid bill' : `are ${owing.length} unpaid bills`} totalling ${formatGhs(total)}.\n${lines.join('\n')}`,
      nextMemory,
    );
  }

  if (hasAny(question, ['staff accounts', 'who can sign', 'on duty', 'active staff'])) {
    const active = state.staff.filter((staff) => staff.isActive);
    const lines = active.map((staff) => `• ${staff.firstName} ${staff.lastName} — ${ROLE_LABELS[staff.role]}`);
    return reply(`${active.length} active staff accounts:\n${lines.join('\n')}`, nextMemory);
  }

  if (hasAny(question, ['average wait', 'waiting time', 'wait time'])) {
    const today = visitsToday(state.visits);
    const avg = averageWaitMinutes(state.visits);
    const open = openVisits(state).length;
    const waitText = avg == null ? 'No completed visits today yet, so average wait is not available.' : `Average wait today is ${avg} minutes.`;
    return reply(`${waitText} ${today.length} check-ins today, ${open} visit${open === 1 ? '' : 's'} still open.`, nextMemory);
  }

  if (hasAny(question, ['open visit', 'who is waiting', 'who has an open', 'pipeline', 'ready to bill'])) {
    const list = openVisits(state);
    if (list.length === 0) {
      return reply('There are no open visits. Everyone currently recorded has completed care.', nextMemory);
    }
    const lines = list.map((visit) => {
      const patient = state.patients.find((item) => item.id === visit.patientId);
      const name = patient ? `${patient.firstName} ${patient.lastName}` : 'Unknown patient';
      return `• ${name} — ${CLINIC_LABELS[visit.clinic ?? 'GENERAL']} — ${STAGE_LABELS[visit.stage]}`;
    });
    const byStage = STAGE_ORDER.filter((stage) => stage !== 'COMPLETED')
      .map((stage) => `${STAGE_LABELS[stage]}: ${state.visits.filter((visit) => visit.stage === stage).length}`)
      .join(', ');
    return reply(`${list.length} open visit${list.length === 1 ? '' : 's'}.\n${lines.join('\n')}\n\nPipeline — ${byStage}`, nextMemory);
  }

  if (hasAny(question, ['how do i register', 'open a folder', 'create folder'])) {
    return reply(
      'Go to Reception → New patients. Enter the folder date, folder number, and the person’s details, then save. That only opens a records folder. Start a visit from New visit & billing.',
      nextMemory,
      ['How many registrations today?', 'Find patient Amara'],
    );
  }

  if (hasAny(question, ['how do i bill', 'how to bill', 'receive pay'])) {
    return reply(
      'Reception decides whether to bill or waive on New visit & billing. The cashier collects cash for the day. The accountant reviews day, month, and year totals. Department in-charge can remove unpaid bills in their department. Admin controls the whole hospital.',
      nextMemory,
      ['Any unpaid bills?'],
    );
  }

  const { snapshot, department } = snapshotFor(state, period, departmentId);
  const stats = department ?? snapshot.hospital;
  const scope = department ? department.label : 'the hospital';
  const when = periodLabel(period);

  const wantsNhis = hasAny(question, ['nhis', 'government insurance']);
  const wantsPrivate = hasAny(question, ['private', 'cash patient', 'cash-paying']);
  const wantsReg = hasAny(question, ['registration', 'registrations', 'new folder', 'folders opened']);
  const wantsCheck = hasAny(question, ['check-in', 'check in', 'checkins']);
  const wantsVisit = hasAny(question, ['visit', 'visits', 'encounter', 'attendance']);
  const wantsSummary = hasAny(question, ['summary', 'dashboard', 'overview', 'totals', 'how are we']);
  const counting = hasAny(question, ['how many', 'how much', 'count', 'total', 'vs', 'versus']);

  if (counting && wantsNhis && wantsPrivate) {
    return reply(`${scope} ${when}: ${stats.nhis} NHIS and ${stats.private} private (including cash patients).`, nextMemory);
  }
  if (counting && wantsNhis) {
    return reply(`${scope} has ${stats.nhis} NHIS visit${stats.nhis === 1 ? '' : 's'} ${when}.`, nextMemory);
  }
  if (counting && wantsPrivate && !wantsVisit) {
    return reply(`${scope} has ${stats.private} private visit${stats.private === 1 ? '' : 's'} ${when}.`, nextMemory);
  }
  if (counting && wantsReg && !wantsVisit) {
    return reply(`${scope} has ${stats.registration} registration${stats.registration === 1 ? '' : 's'} ${when}.`, nextMemory);
  }
  if (counting && wantsCheck && !wantsVisit) {
    return reply(`${scope} has ${stats.checkIns} check-in${stats.checkIns === 1 ? '' : 's'} ${when}.`, nextMemory);
  }
  if (counting && wantsVisit && department) {
    return reply(
      `${department.label} ${when}: ${stats.visits} visits, ${stats.registration} registrations, ${stats.nhis} NHIS, ${stats.private} private, ${stats.checkIns} check-ins.`,
      nextMemory,
    );
  }
  if (counting && (wantsVisit || wantsSummary)) {
    const top = [...snapshot.departments].sort((a, b) => b.visits - a.visits).filter((row) => row.visits > 0).slice(0, 5);
    const topText = top.length ? `\nBusiest areas: ${top.map((row) => `${row.label} (${row.visits})`).join(', ')}.` : '';
    return reply(
      `${scope} ${when}: ${stats.visits} visits, ${stats.registration} registrations, ${stats.nhis} NHIS, ${stats.private} private, and ${stats.checkIns} check-ins.${topText}`,
      nextMemory,
    );
  }

  if (matchedPatients.length === 1 && hasAny(question, ['find', 'patient', 'folder'])) {
    const patient = matchedPatients[0];
    return reply(
      `I found that record.\n\n${patientLine(state, patient)}\nPhone: ${patient.phone || 'not recorded'}\nTown: ${patient.town || 'not recorded'}`,
      nextMemory,
      ['Who has an open visit?', 'Any unpaid bills?', 'How many visits today?'],
    );
  }

  return { text: '', memory: nextMemory, suggestions, handled: false };
}
