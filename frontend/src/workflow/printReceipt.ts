import { CLINIC_LABELS, formatGhs } from './catalog';
import { inCollectionPeriod, type CollectionPeriod } from './billing';
import { insuranceLabel } from './patientAdmin';
import type { CareState, PatientRecord, StaffAccount, VisitRecord } from './types';

export interface ReceiptCopy {
  visitId: string;
  receiptNo: string;
  hospitalNo: string;
  patientName: string;
  insurance: string;
  clinic: string;
  paidAt: string;
  receivedBy: string;
  items: { name: string; amount: number }[];
  paidTotal: number;
  balance: number;
}

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function cashierName(staff: StaffAccount[], staffId?: string): string {
  const person = staff.find((s) => s.id === staffId);
  return person ? `${person.firstName} ${person.lastName}` : 'Cashier';
}

export function receiptFromVisit(
  visit: VisitRecord,
  patient: PatientRecord | undefined,
  staff: StaffAccount[],
): ReceiptCopy | null {
  const paid = visit.orders.filter((order) => order.paidAt && order.chargeable !== false);
  if (!patient || paid.length === 0) return null;
  const unpaid = visit.orders.filter((order) => !order.paidAt && order.chargeable !== false);
  const paidTotal = paid.reduce((sum, order) => sum + order.priceGhs, 0);
  const balance = unpaid.reduce((sum, order) => sum + order.priceGhs, 0);
  const paidAt = visit.paidAt ?? paid[0]?.paidAt ?? visit.checkedInAt;
  return {
    visitId: visit.id,
    receiptNo: visit.receiptNo ?? '—',
    hospitalNo: patient.hospitalNo,
    patientName: `${patient.firstName} ${patient.lastName}`,
    insurance: insuranceLabel(patient),
    clinic: CLINIC_LABELS[visit.clinic ?? 'GENERAL'],
    paidAt,
    receivedBy: cashierName(staff, visit.paidBy ?? paid.find((order) => order.paidBy)?.paidBy),
    items: paid.map((order) => ({ name: order.name, amount: order.priceGhs })),
    paidTotal,
    balance,
  };
}

export function paidReceipts(state: CareState, period: CollectionPeriod = 'day'): ReceiptCopy[] {
  const now = new Date();
  return state.visits
    .map((visit) => {
      const patient = state.patients.find((item) => item.id === visit.patientId);
      return receiptFromVisit(visit, patient, state.staff);
    })
    .filter((copy): copy is ReceiptCopy => {
      if (!copy) return false;
      return inCollectionPeriod(copy.paidAt, period, now);
    })
    .sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime());
}

export function receiptsDocumentHtml(copies: ReceiptCopy[]): string {
  const pages = copies
    .map(
      (copy) => `
    <section class="page">
      <h1>Clinic receipt</h1>
      <p class="muted">Ghana cedis (GH₵) · Official payment copy</p>
      <div class="box">
        <p><strong>Receipt:</strong> ${esc(copy.receiptNo)}</p>
        <p><strong>Hospital no:</strong> ${esc(copy.hospitalNo)}</p>
        <p><strong>Patient:</strong> ${esc(copy.patientName)}</p>
        <p><strong>Insurance:</strong> ${esc(copy.insurance)}</p>
        <p><strong>Clinic:</strong> ${esc(copy.clinic)}</p>
        <p><strong>Date:</strong> ${esc(new Date(copy.paidAt).toLocaleString())}</p>
        <table>
          ${copy.items
            .map((item) => `<tr><td>${esc(item.name)}</td><td class="amt">${formatGhs(item.amount)}</td></tr>`)
            .join('')}
          <tr class="total"><td>Amount paid</td><td class="amt">${formatGhs(copy.paidTotal)}</td></tr>
          ${copy.balance > 0 ? `<tr><td>Balance unpaid</td><td class="amt">${formatGhs(copy.balance)}</td></tr>` : ''}
        </table>
        <p class="stamp">${copy.balance > 0 ? 'PART PAID' : 'PAID'}</p>
        <p><strong>Received by:</strong> ${esc(copy.receivedBy)}</p>
        <p class="muted">Keep this receipt. Quote hospital number ${esc(copy.hospitalNo)} on your next visit.</p>
      </div>
    </section>`,
    )
    .join('');

  const title = copies.length === 1 ? `Receipt ${copies[0].receiptNo}` : `Receipts (${copies.length})`;
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${esc(title)}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #111; margin: 0; background: #f8fafc; }
    .page { background: #fff; margin: 16px auto; padding: 24px; max-width: 420px; border: 1px solid #d6d3d1; }
    h1 { font-size: 18px; margin: 0; text-align: center; }
    p { margin: 4px 0; font-size: 13px; }
    .muted { color: #555; text-align: center; }
    .box { border: 1px solid #ccc; padding: 12px; margin-top: 16px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 13px; }
    td { padding: 4px 0; vertical-align: top; }
    td.amt { text-align: right; white-space: nowrap; }
    .total { font-weight: bold; border-top: 1px solid #111; }
    .stamp { margin-top: 16px; text-align: center; font-weight: bold; letter-spacing: 2px; }
    @media print {
      body { background: #fff; }
      .page { margin: 0 auto; border: none; page-break-after: always; }
      .page:last-child { page-break-after: auto; }
    }
  </style>
</head>
<body>${pages || '<p style="padding:24px">No paid receipts.</p>'}</body>
</html>`;
}

export function printVisitReceipt(input: {
  patient: PatientRecord;
  visit: VisitRecord;
  receivedBy: string;
}) {
  const copy = receiptFromVisit(input.visit, input.patient, []);
  if (!copy) return;
  copy.receivedBy = input.receivedBy;
  const win = window.open('', '_blank', 'noopener,noreferrer,width=520,height=760');
  if (!win) return;
  win.document.write(receiptsDocumentHtml([copy]));
  win.document.close();
}

export function printFolderCover(patient: PatientRecord) {
  const opened = patient.folderCreatedAt ? new Date(patient.folderCreatedAt).toLocaleDateString() : new Date().toLocaleDateString();
  const win = window.open('', '_blank', 'noopener,noreferrer,width=520,height=700');
  if (!win) return;
  win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Folder ${patient.hospitalNo}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; color: #111; }
    .cover { border: 3px solid #0f766e; padding: 24px; min-height: 360px; }
    h1 { text-align: center; margin: 0 0 8px; font-size: 22px; }
    .muted { text-align: center; color: #555; margin-bottom: 20px; }
    .no { text-align: center; font-size: 28px; font-family: Consolas, monospace; font-weight: bold; letter-spacing: 2px; margin: 16px 0; }
    p { font-size: 15px; margin: 8px 0; }
    .footer { margin-top: 28px; font-size: 12px; color: #555; text-align: center; }
  </style>
</head>
<body>
  <div class="cover">
    <h1>Patient folder</h1>
    <p class="muted">Records / OPD</p>
    <p class="no">${patient.hospitalNo}</p>
    <p><strong>Name:</strong> ${patient.firstName} ${patient.lastName}</p>
    <p><strong>Sex / age:</strong> ${patient.gender} · ${patient.age} years${patient.dateOfBirth ? ` · DOB ${new Date(patient.dateOfBirth).toLocaleDateString()}` : ''}</p>
    <p><strong>Phone:</strong> ${patient.phone}</p>
    ${patient.address || patient.town ? `<p><strong>Stays:</strong> ${[patient.address, patient.town].filter(Boolean).join(', ')}</p>` : ''}
    ${patient.insuranceType ? `<p><strong>Insurance:</strong> ${insuranceLabel(patient)}</p>` : ''}
    ${patient.email ? `<p><strong>Email:</strong> ${patient.email}</p>` : ''}
    <p><strong>Folder opened:</strong> ${opened}</p>
    <p class="footer">Bring this folder number on every visit. Do not write on the cover except in Records.</p>
  </div>
  <script>window.onload = function () { window.print(); };</script>
</body>
</html>`);
  win.document.close();
}

function openPrintHtml(title: string, html: string, width = 520, height = 700) {
  const win = window.open('', '_blank', `noopener,noreferrer,width=${width},height=${height}`);
  if (!win) return;
  win.document.write(html);
  win.document.close();
}

export function idCardHtml(patient: PatientRecord): string {
  const photo = patient.photoUrl
    ? `<img class="photo" src="${esc(patient.photoUrl)}" alt="" />`
    : `<div class="photo empty">${esc((patient.firstName[0] ?? '') + (patient.lastName[0] ?? ''))}</div>`;
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>ID card ${esc(patient.hospitalNo)}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 16px; color: #0f172a; }
    .card { width: 86mm; min-height: 54mm; border: 2px solid #0369a1; border-radius: 8px; padding: 8px 10px; display: flex; gap: 10px; }
    .photo { width: 22mm; height: 28mm; object-fit: cover; border-radius: 4px; background: #e0f2fe; display: flex; align-items: center; justify-content: center; font-weight: bold; color: #0369a1; }
    h1 { font-size: 11px; margin: 0 0 4px; letter-spacing: 1px; text-transform: uppercase; color: #0369a1; }
    .no { font-family: Consolas, monospace; font-size: 18px; font-weight: bold; margin: 2px 0 6px; }
    p { margin: 2px 0; font-size: 12px; }
    .muted { color: #64748b; font-size: 10px; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  <div class="card">
    ${photo}
    <div>
      <h1>Patient ID card</h1>
      <p class="no">${esc(patient.hospitalNo)}</p>
      <p><strong>${esc(patient.firstName)} ${esc(patient.lastName)}</strong></p>
      <p>${esc(patient.gender)} · ${patient.age}y${patient.dateOfBirth ? ` · ${esc(new Date(patient.dateOfBirth).toLocaleDateString())}` : ''}</p>
      <p>${esc(patient.phone)}</p>
      ${patient.insuranceType ? `<p>${esc(insuranceLabel(patient))}</p>` : ''}
      <p class="muted">Bring this card to every visit.</p>
    </div>
  </div>
  <script>window.onload = function () { window.print(); };</script>
</body>
</html>`;
}

export function printIdCard(patient: PatientRecord) {
  openPrintHtml(`ID card ${patient.hospitalNo}`, idCardHtml(patient), 480, 360);
}

export function queueTicketHtml(patient: PatientRecord, visit: VisitRecord): string {
  const ticket = visit.queueNo ? String(visit.queueNo) : patient.hospitalNo;
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Queue ticket ${esc(ticket)}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 16px; color: #111; text-align: center; }
    .slip { width: 80mm; margin: 0 auto; border: 2px dashed #0369a1; padding: 16px 12px; }
    h1 { font-size: 14px; margin: 0; letter-spacing: 1px; text-transform: uppercase; color: #0369a1; }
    .no { font-size: 52px; font-weight: 900; line-height: 1; margin: 10px 0 6px; }
    .folder { font-family: Consolas, monospace; font-size: 18px; font-weight: bold; }
    p { margin: 4px 0; font-size: 13px; }
    .muted { color: #555; font-size: 11px; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  <div class="slip">
    <h1>Queue ticket</h1>
    <p class="no">${esc(ticket)}</p>
    <p class="folder">${esc(patient.hospitalNo)}</p>
    <p><strong>${esc(patient.firstName)} ${esc(patient.lastName)}</strong></p>
    <p>${esc(CLINIC_LABELS[visit.clinic ?? 'GENERAL'])} · ${esc(visit.reason)}</p>
    <p>${esc(new Date(visit.checkedInAt).toLocaleString())}</p>
    ${visit.nhisCcCode ? `<p>CC ${esc(visit.nhisCcCode)}</p>` : ''}
    <p class="muted">Take this ticket to Nursing, then wait to be called.</p>
  </div>
  <script>window.onload = function () { window.print(); };</script>
</body>
</html>`;
}

export function printQueueTicket(patient: PatientRecord, visit: VisitRecord) {
  openPrintHtml(`Queue ticket ${visit.queueNo ?? patient.hospitalNo}`, queueTicketHtml(patient, visit), 420, 560);
}

export function printVisitSlip(patient: PatientRecord, visit: VisitRecord) {
  printQueueTicket(patient, visit);
}

export function labSampleLabelHtml(input: {
  patientName: string;
  hospitalNo: string;
  accessionNo: string;
  testName: string;
  collectedAt: string;
}): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Lab label ${esc(input.accessionNo)}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 12px; color: #111; }
    .label { width: 70mm; min-height: 32mm; border: 1px solid #111; padding: 6px 8px; }
    .acc { font-family: Consolas, monospace; font-size: 16px; font-weight: bold; }
    p { margin: 2px 0; font-size: 12px; }
    .muted { color: #444; font-size: 10px; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  <div class="label">
    <p class="acc">${esc(input.accessionNo)}</p>
    <p><strong>${esc(input.patientName)}</strong> · ${esc(input.hospitalNo)}</p>
    <p>${esc(input.testName)}</p>
    <p class="muted">${esc(new Date(input.collectedAt).toLocaleString())}</p>
  </div>
  <script>window.onload = function () { window.print(); };</script>
</body>
</html>`;
}

export function printLabSampleLabel(input: {
  patientName: string;
  hospitalNo: string;
  accessionNo: string;
  testName: string;
  collectedAt: string;
}) {
  openPrintHtml(`Lab label ${input.accessionNo}`, labSampleLabelHtml(input), 400, 280);
}

export function printLabReport(input: {
  patientName: string;
  hospitalNo: string;
  clinic: string;
  diagnosis?: string;
  lines: { name: string; value: string; unit: string; flag: string; heading?: boolean }[];
}) {
  const rows = input.lines
    .map((line) =>
      line.heading
        ? `<tr><td colspan="4"><strong>${esc(line.name)}</strong></td></tr>`
        : `<tr>
          <td>${esc(line.name)}</td>
          <td class="val">${esc(line.value || '')}</td>
          <td class="flag">${esc(line.flag || '')}</td>
          <td>${esc(line.unit || '')}</td>
        </tr>`,
    )
    .join('');
  const win = window.open('', '_blank', 'noopener,noreferrer,width=640,height=800');
  if (!win) return;
  win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Lab report ${esc(input.hospitalNo)}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; color: #111; }
    h1 { text-align: center; font-size: 18px; margin: 0; }
    .muted { text-align: center; color: #555; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 14px; }
    th, td { border: 1px solid #111; padding: 6px 8px; }
    th { text-align: left; background: #f4f4f4; }
    td.val { text-align: right; }
    td.flag { text-align: center; color: #dc2626; font-weight: bold; width: 36px; }
  </style>
</head>
<body>
  <h1>Laboratory report</h1>
  <p class="muted">${esc(input.patientName)} · ${esc(input.hospitalNo)} · ${esc(input.clinic)}</p>
  ${input.diagnosis ? `<p class="muted">${esc(input.diagnosis)}</p>` : ''}
  <table>
    <thead><tr><th>Test</th><th>Result</th><th></th><th>Unit</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <p class="muted" style="margin-top:12px;text-align:left">H = high · L = low</p>
</body>
</html>`);
  win.document.close();
}
