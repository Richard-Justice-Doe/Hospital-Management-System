import { isInpatientVisit } from './billing';
import { CLINIC_LABELS } from './catalog';
import type { CareState, PatientRecord, VisitRecord } from './types';

export const HISTORY_TABS = [
  { id: 'opd', label: 'OPD History' },
  { id: 'lab', label: 'Lab History' },
  { id: 'radiology', label: 'Radiology History' },
  { id: 'inpatient', label: 'Inpatient History' },
  { id: 'uploads', label: 'Uploads' },
  { id: 'operation', label: 'Operation Note' },
  { id: 'triage', label: 'Triage' },
] as const;

export type HistoryTab = (typeof HISTORY_TABS)[number]['id'];

export type HistoryRow = {
  id: string;
  date: string;
  description: string;
  details: string;
};

function visitDate(iso?: string) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function vitalsLine(visit: VisitRecord): string | null {
  const v = visit.vitals;
  if (!v) return null;
  return [
    `Blood Pressure: ${v.systolicBp}/${v.diastolicBp}`,
    `Temp: ${v.temperatureC}`,
    `Weight: ${v.weightKg}`,
    `Pulse: ${v.pulseBpm}`,
  ].join(', ');
}

export function patientHistoryRows(state: CareState, patientId: string, tab: HistoryTab): HistoryRow[] {
  const visits = state.visits.filter((visit) => visit.patientId === patientId);
  if (tab === 'opd') {
    return visits.flatMap((visit) => {
      const rows: HistoryRow[] = [];
      const vitals = vitalsLine(visit);
      if (vitals) {
        rows.push({
          id: `${visit.id}-vitals`,
          date: visitDate(visit.vitalsDoneAt ?? visit.checkedInAt),
          description: 'Vital Signs',
          details: vitals,
        });
      }
      const complaint = visit.diagnosis || visit.reason;
      if (complaint) {
        rows.push({
          id: `${visit.id}-complaint`,
          date: visitDate(visit.withDoctorAt ?? visit.checkedInAt),
          description: 'Complaints',
          details: `PC: ${complaint}`,
        });
      }
      if (rows.length === 0) {
        rows.push({
          id: visit.id,
          date: visitDate(visit.checkedInAt),
          description: CLINIC_LABELS[visit.clinic ?? 'GENERAL'],
          details: 'Seen in OPD.',
        });
      }
      return rows;
    });
  }
  if (tab === 'lab') {
    return visits.flatMap((visit) =>
      visit.orders
        .filter((order) => order.department === 'LAB')
        .map((order) => ({
          id: order.id,
          date: visitDate(order.completedAt ?? visit.checkedInAt),
          description: order.name,
          details: order.result || (order.paidAt ? 'Billed' : order.status === 'DONE' ? 'Result on file' : 'Pending'),
        })),
    );
  }
  if (tab === 'radiology') {
    const fromOrders = visits.flatMap((visit) =>
      visit.orders
        .filter((order) => order.department === 'RADIOLOGY')
        .map((order) => ({
          id: order.id,
          date: visitDate(order.completedAt ?? visit.checkedInAt),
          description: order.name,
          details: order.result || 'Imaging request',
        })),
    );
    const fromStudies = state.imagingStudies
      .filter((study) => visits.some((visit) => visit.id === study.visitId))
      .map((study) => ({
        id: study.id,
        date: visitDate(study.createdAt),
        description: study.modality,
        details: study.report || 'Report on file',
      }));
    return [...fromOrders, ...fromStudies];
  }
  if (tab === 'inpatient') {
    return visits
      .filter(isInpatientVisit)
      .map((visit) => ({
        id: visit.id,
        date: visitDate(visit.checkedInAt),
        description: 'Admission',
        details: [visit.diagnosis, visit.bedId && `Bed ${visit.bedId}`, visit.disposition].filter(Boolean).join(' · ') || 'On the ward',
      }));
  }
  if (tab === 'uploads') {
    return state.clinicalNotes
      .filter((note) => note.patientId === patientId)
      .map((note) => ({
        id: note.id,
        date: visitDate(note.createdAt),
        description: note.title,
        details: note.body,
      }));
  }
  if (tab === 'operation') {
    return state.otCases
      .filter((row) => row.patientId === patientId)
      .map((row) => ({
        id: row.id,
        date: visitDate(row.startsAt),
        description: row.procedure,
        details: row.surgicalNotes || row.findings || row.status,
      }));
  }
  return state.triageRecords
    .filter((row) => row.patientId === patientId)
    .map((row) => ({
      id: row.id,
      date: visitDate(row.at),
      description: `ESI ${row.esi}`,
      details: row.complaint,
    }));
}

export function historyReportHtml(patient: PatientRecord, tabLabel: string, rows: HistoryRow[]): string {
  const body = rows
    .map(
      (row) =>
        `<tr><td>${esc(row.date)}</td><td>${esc(row.description)}</td><td>${esc(row.details)}</td></tr>`,
    )
    .join('');
  return `<!doctype html><html><head><title>Patient medical history</title>
    <style>body{font-family:Segoe UI,sans-serif;padding:24px;color:#111}
    table{width:100%;border-collapse:collapse;margin-top:12px;font-size:13px}
    th,td{border:1px solid #ccc;padding:6px 8px;text-align:left;vertical-align:top}
    h1{font-size:18px;margin:0}</style></head><body>
    <h1>Patient medical history</h1>
    <p>${esc(patient.lastName)} ${esc(patient.firstName)} · ${esc(patient.hospitalNo)} · ${esc(tabLabel)}</p>
    <table><thead><tr><th>Date</th><th>Description</th><th>Details</th></tr></thead>
    <tbody>${body || '<tr><td colspan="3">No records.</td></tr>'}</tbody></table>
    </body></html>`;
}

function esc(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
