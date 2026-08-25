import { CLINIC_LABELS, formatGhs } from './catalog';
import { inCollectionPeriod, type CollectionPeriod } from './billing';
import { coverOnFile, formatDob, insuranceLabel, kinLabel, stayLabel } from './patientAdmin';
import type { CareState, OtCaseRecord, PatientRecord, StaffAccount, VisitRecord } from './types';

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
  openPrintHtml(`Receipt ${copy.receiptNo}`, receiptsDocumentHtml([copy]), 520, 760);
}

function slipHtml(title: string, body: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${esc(title)}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #111; margin: 24px; }
    h1 { font-size: 18px; margin: 0; text-align: center; }
    p { margin: 6px 0; font-size: 13px; }
    .muted { color: #555; text-align: center; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
    td { padding: 4px 0; vertical-align: top; }
    td.amt { text-align: right; white-space: nowrap; }
    .total { font-weight: bold; border-top: 1px solid #111; }
    .stamp { margin-top: 16px; text-align: center; font-weight: bold; letter-spacing: 2px; }
  </style>
</head>
<body>
  <h1>${esc(title)}</h1>
  ${body}
</body>
</html>`;
}

export function visitBillHtml(patient: PatientRecord, visit: VisitRecord): string {
  const lines = visit.orders.filter((order) => order.chargeable !== false);
  const due = lines.filter((order) => !order.paidAt).reduce((sum, order) => sum + order.priceGhs, 0);
  const paid = lines.filter((order) => order.paidAt).reduce((sum, order) => sum + order.priceGhs, 0);
  const rows = lines
    .map((order) => {
      const qty = order.qty && order.qty > 1 ? ` × ${order.qty}` : '';
      return `<tr><td>${esc(order.name)}${qty}${order.paidAt ? ' (paid)' : ''}</td><td class="amt">${formatGhs(order.priceGhs)}</td></tr>`;
    })
    .join('');
  return slipHtml(
    'Patient bill',
    `<p class="muted">Generate bill · Ghana cedis (GH₵)</p>
    ${row('Folder', patient.hospitalNo)}
    ${row('Patient', `${patient.firstName} ${patient.lastName}`)}
    ${row('Clinic', CLINIC_LABELS[visit.clinic ?? 'GENERAL'])}
    ${row('Date', new Date(visit.checkedInAt).toLocaleString())}
    <table>${rows}<tr class="total"><td>Paid</td><td class="amt">${formatGhs(paid)}</td></tr>
    <tr class="total"><td>Amount due</td><td class="amt">${formatGhs(due)}</td></tr></table>
    <p class="stamp">${due > 0 ? 'UNPAID' : 'PAID'}</p>
    <p class="muted">Print only. Cash is collected at the cash unit.</p>`,
  );
}

export function printVisitBill(patient: PatientRecord, visit: VisitRecord) {
  openPrintHtml(`Bill ${patient.hospitalNo}`, visitBillHtml(patient, visit), 520, 760);
}

export function printDepositSlip(input: {
  patientName: string;
  hospitalNo: string;
  receiptNo: string;
  amountGhs: number;
  method: string;
  receivedBy: string;
  at: string;
  note?: string;
}) {
  openPrintHtml(
    `Deposit ${input.receiptNo}`,
    slipHtml(
      'Patient deposit',
      `<p class="muted">Advance on folder · Ghana cedis (GH₵)</p>
      ${row('Receipt', input.receiptNo)}
      ${row('Folder', input.hospitalNo)}
      ${row('Patient', input.patientName)}
      ${row('Amount', formatGhs(input.amountGhs))}
      ${row('Method', input.method)}
      ${row('Date', new Date(input.at).toLocaleString())}
      ${row('Received by', input.receivedBy)}
      ${row('Note', input.note)}
      <p class="stamp">DEPOSIT</p>`,
    ),
    520,
    700,
  );
}

export function printExternalReceiptSlip(input: {
  payerName: string;
  patientName?: string;
  hospitalNo?: string;
  receiptNo: string;
  amountGhs: number;
  description: string;
  method: string;
  receivedBy: string;
  at: string;
}) {
  openPrintHtml(
    `Receipt ${input.receiptNo}`,
    slipHtml(
      'External receipt',
      `<p class="muted">Payment received outside a visit bill</p>
      ${row('Receipt', input.receiptNo)}
      ${row('Payer', input.payerName)}
      ${row('Folder', input.hospitalNo)}
      ${row('Patient', input.patientName)}
      ${row('For', input.description)}
      ${row('Amount', formatGhs(input.amountGhs))}
      ${row('Method', input.method)}
      ${row('Date', new Date(input.at).toLocaleString())}
      ${row('Received by', input.receivedBy)}
      <p class="stamp">PAID</p>`,
    ),
    520,
    700,
  );
}

function openPrintHtml(title: string, html: string, width = 520, height = 700) {
  const popup = window.open('', '_blank', `width=${width},height=${height}`);
  if (popup) {
    popup.document.open();
    popup.document.write(html);
    popup.document.close();
    popup.focus();
    window.setTimeout(() => {
      try {
        popup.print();
      } catch {
        /* ignore */
      }
    }, 120);
    return;
  }
  const frame = document.createElement('iframe');
  frame.title = title;
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(frame);
  const doc = frame.contentWindow?.document;
  if (!doc) return;
  doc.open();
  doc.write(html);
  doc.close();
  window.setTimeout(() => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    window.setTimeout(() => frame.remove(), 1500);
  }, 150);
}

function row(label: string, value?: string | null): string {
  if (!value?.trim()) return '';
  return `<p><strong>${esc(label)}:</strong> ${esc(value)}</p>`;
}

export function folderCoverHtml(patient: PatientRecord): string {
  const opened = patient.folderCreatedAt ? new Date(patient.folderCreatedAt).toLocaleDateString() : new Date().toLocaleDateString();
  const name = [patient.lastName, patient.firstName, patient.otherNames].filter(Boolean).join(' ');
  const age = `${patient.age} years${patient.ageEstimated ? ' (estimated)' : ''}`;
  const dob = patient.dateOfBirth ? formatDob(patient.dateOfBirth) : '';
  const stay = stayLabel(patient);
  const cover = coverOnFile(patient) ?? (patient.insuranceType ? insuranceLabel(patient) : '');
  const kin = kinLabel(patient.nextOfKin);
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Folder ${esc(patient.hospitalNo)}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; color: #111; }
    .cover { border: 3px solid #0f766e; padding: 24px; min-height: 360px; }
    h1 { text-align: center; margin: 0 0 8px; font-size: 22px; }
    .muted { text-align: center; color: #555; margin-bottom: 12px; }
    .no { text-align: center; font-size: 28px; font-family: Consolas, monospace; font-weight: bold; letter-spacing: 2px; margin: 12px 0; }
    p { font-size: 15px; margin: 8px 0; }
    .footer { margin-top: 28px; font-size: 12px; color: #555; text-align: center; }
  </style>
</head>
<body>
  <div class="cover">
    <h1>Patient folder</h1>
    <p class="muted">Records / OPD</p>
    <p class="no">${esc(patient.hospitalNo)}</p>
    ${row('Name', name)}
    ${row('Sex / age', [patient.gender, age, dob && `DOB ${dob}`].filter(Boolean).join(' · '))}
    ${row('Phone', [patient.phone, patient.phoneAlt].filter(Boolean).join(' · '))}
    ${stay !== '—' ? row('Stays', stay) : ''}
    ${row('Ghana Card', patient.ghanaCardNo)}
    ${row('Insurance', cover)}
    ${row('Next of kin', kin)}
    ${row('Blood group', patient.bloodGroup && patient.bloodGroup !== 'Unknown' ? patient.bloodGroup : '')}
    ${row('Allergies', patient.knownAllergies)}
    ${row('Physical card', patient.physicalFolderNo)}
    ${row('Folder opened', opened)}
    <p class="footer">Bring this folder number on every visit. Do not write on the cover except in Records.</p>
  </div>
</body>
</html>`;
}

export function printFolderCover(patient: PatientRecord) {
  openPrintHtml(`Folder ${patient.hospitalNo}`, folderCoverHtml(patient), 520, 700);
}

export function idCardHtml(patient: PatientRecord): string {
  const photo = patient.photoUrl
    ? `<img class="photo" src="${esc(patient.photoUrl)}" alt="" />`
    : `<div class="photo empty">${esc((patient.firstName[0] ?? '') + (patient.lastName[0] ?? ''))}</div>`;
  const name = [patient.lastName, patient.firstName, patient.otherNames].filter(Boolean).join(' ');
  const cover = coverOnFile(patient) ?? (patient.insuranceType ? insuranceLabel(patient) : '');
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>ID card ${esc(patient.hospitalNo)}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 16px; color: #0f172a; }
    .card { width: 86mm; min-height: 54mm; border: 2px solid #0369a1; border-radius: 8px; padding: 8px 10px; display: flex; gap: 10px; }
    .photo { width: 22mm; height: 28mm; object-fit: cover; border-radius: 4px; background: #e0f2fe; display: flex; align-items: center; justify-content: center; font-weight: bold; color: #0369a1; flex-shrink: 0; }
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
      <p><strong>${esc(name)}</strong></p>
      <p>${esc(patient.gender)} · ${patient.age}y${patient.ageEstimated ? ' (est.)' : ''}${patient.dateOfBirth ? ` · ${esc(formatDob(patient.dateOfBirth))}` : ''}</p>
      <p>${esc(patient.phone)}</p>
      ${patient.ghanaCardNo ? `<p>Ghana Card ${esc(patient.ghanaCardNo)}</p>` : ''}
      ${cover ? `<p>${esc(cover)}</p>` : ''}
      <p class="muted">Bring this card to every visit.</p>
    </div>
  </div>
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
    <p>${esc(CLINIC_LABELS[visit.clinic ?? 'GENERAL'])}${visit.reason ? ` · ${esc(visit.reason)}` : ''}</p>
    <p>${esc(new Date(visit.checkedInAt).toLocaleString())}</p>
    ${visit.nhisCcCode ? `<p>CC ${esc(visit.nhisCcCode)}</p>` : ''}
    <p class="muted">Take this ticket to Nursing, then wait to be called.</p>
  </div>
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
  openPrintHtml(
    `Lab report ${input.hospitalNo}`,
    `<!DOCTYPE html>
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
</html>`,
    640,
    800,
  );
}

function personName(staff: StaffAccount[], id?: string): string {
  const person = staff.find((item) => item.id === id);
  return person ? `${person.firstName} ${person.lastName}` : '—';
}

export function otBoardHtml(
  cases: OtCaseRecord[],
  patients: PatientRecord[],
  staff: StaffAccount[],
): string {
  const rows = cases
    .map((row) => {
      const patient = patients.find((item) => item.id === row.patientId);
      const name = patient ? `${patient.firstName} ${patient.lastName}` : 'Patient';
      const folder = patient?.hospitalNo ?? '—';
      return `<tr>
        <td>${esc(new Date(row.startsAt).toLocaleString())}</td>
        <td>${esc(folder)}</td>
        <td>${esc(name)}</td>
        <td>${esc(row.procedure)}</td>
        <td>${esc(row.status.replace('_', ' '))}</td>
        <td>${esc(personName(staff, row.surgeonStaffId))}</td>
      </tr>`;
    })
    .join('');
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>OT list</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; color: #111; }
    h1 { text-align: center; font-size: 18px; margin: 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
    th, td { border: 1px solid #111; padding: 6px 8px; text-align: left; }
    th { background: #f4f4f4; }
  </style>
</head>
<body>
  <h1>Theatre list</h1>
  <p style="text-align:center;color:#555">${esc(new Date().toLocaleString())}</p>
  <table>
    <thead><tr><th>Time</th><th>Folder</th><th>Patient</th><th>Procedure</th><th>Status</th><th>Surgeon</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="6">No cases.</td></tr>'}</tbody>
  </table>
</body>
</html>`;
}

export function printOtBoard(cases: OtCaseRecord[], patients: PatientRecord[], staff: StaffAccount[]) {
  openPrintHtml('OT list', otBoardHtml(cases, patients, staff), 800, 700);
}

export function otConsentHtml(patient: PatientRecord, row: OtCaseRecord): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Consent ${esc(patient.hospitalNo)}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; color: #111; }
    h1 { text-align: center; font-size: 18px; }
    .box { border: 1px solid #111; padding: 16px; margin-top: 16px; }
    p { font-size: 14px; line-height: 1.5; }
    .sign { margin-top: 36px; display: flex; justify-content: space-between; }
  </style>
</head>
<body>
  <h1>Theatre consent</h1>
  <div class="box">
    <p><strong>Folder:</strong> ${esc(patient.hospitalNo)}</p>
    <p><strong>Patient:</strong> ${esc(patient.firstName)} ${esc(patient.lastName)} · ${esc(patient.gender)} · ${patient.age}y</p>
    <p><strong>Procedure:</strong> ${esc(row.procedure)}</p>
    <p><strong>Date / time:</strong> ${esc(new Date(row.startsAt).toLocaleString())}</p>
    <p>I understand the planned procedure, the usual risks, and that further treatment may be needed. I agree to this operation under the anaesthesia discussed with the theatre team.</p>
    <div class="sign">
      <p>Patient / guardian _______________</p>
      <p>Witness _______________</p>
    </div>
  </div>
</body>
</html>`;
}

export function printOtConsent(patient: PatientRecord, row: OtCaseRecord) {
  openPrintHtml(`Consent ${patient.hospitalNo}`, otConsentHtml(patient, row), 640, 700);
}

export function opNoteHtml(patient: PatientRecord, row: OtCaseRecord, staff: StaffAccount[]): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Op note ${esc(patient.hospitalNo)}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; color: #111; }
    h1 { text-align: center; font-size: 18px; }
    p { font-size: 14px; margin: 6px 0; }
  </style>
</head>
<body>
  <h1>Operation note</h1>
  <p><strong>${esc(patient.firstName)} ${esc(patient.lastName)}</strong> · ${esc(patient.hospitalNo)}</p>
  <p><strong>Procedure:</strong> ${esc(row.procedure)}</p>
  <p><strong>Surgeon:</strong> ${esc(personName(staff, row.surgeonStaffId))}</p>
  <p><strong>Assistant:</strong> ${esc(personName(staff, row.assistantStaffId))}</p>
  <p><strong>Anaesthetist:</strong> ${esc(personName(staff, row.anaesthetistStaffId))}</p>
  <p><strong>Scrub:</strong> ${esc(personName(staff, row.scrubNurseStaffId))}</p>
  <p><strong>Anaesthesia:</strong> ${esc(row.anesthesia || '—')} · ASA ${esc(row.asaClass || '—')}</p>
  <p><strong>Findings:</strong> ${esc(row.findings || '—')}</p>
  <p><strong>Complications:</strong> ${esc(row.complications || 'None recorded')}</p>
  <p><strong>Notes:</strong> ${esc(row.surgicalNotes || '—')}</p>
  <p><strong>Recovery:</strong> ${esc(row.recoveryNotes || '—')}</p>
</body>
</html>`;
}

export function printOpNote(patient: PatientRecord, row: OtCaseRecord, staff: StaffAccount[]) {
  openPrintHtml(`Op note ${patient.hospitalNo}`, opNoteHtml(patient, row, staff), 640, 800);
}
