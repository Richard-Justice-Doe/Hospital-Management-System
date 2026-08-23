import { CLINIC_LABELS } from './catalog';
import { downloadText } from './his';
import { CLAIM_STATUS_LABEL, claimQueue } from './supportDesks';
import type { CareState } from './types';

export interface AccountantClaimRow {
  claimNo: string;
  submittedAt: string;
  patientName: string;
  hospitalNo: string;
  scheme: string;
  insurer: string;
  coverNo: string;
  ccCode: string;
  clinic: string;
  diagnosis: string;
  services: string;
  amountGhs: number;
  status: string;
}

export interface AccountantClaimLine {
  claimNo: string;
  patientName: string;
  service: string;
  department: string;
  amountGhs: number;
}

export function accountantClaimPack(state: CareState, visitId?: string) {
  const rows = claimQueue(state).filter((row) => {
    const status = row.claim?.status ?? 'DRAFT';
    if (visitId && row.visit.id === visitId) return true;
    return status === 'SUBMITTED';
  });
  const claims: AccountantClaimRow[] = rows.map((row) => {
    const patient = row.patient;
    const claim = row.claim;
    const cover =
      patient?.ghanaCardNo ||
      patient?.hinNumber ||
      patient?.insuranceNumber ||
      '';
    return {
      claimNo: claim?.claimNo ?? 'Pending',
      submittedAt: claim?.submittedAt ? new Date(claim.submittedAt).toLocaleString() : 'Ready for accountant',
      patientName: patient ? `${patient.firstName} ${patient.lastName}` : 'Unknown patient',
      hospitalNo: patient?.hospitalNo ?? '',
      scheme: row.scheme === 'NHIS' ? 'NHIS / Ghana Card' : 'Private',
      insurer: row.scheme === 'NHIS' ? 'NHIS' : patient?.insuranceProvider ?? 'Private',
      coverNo: cover,
      ccCode: row.visit.nhisCcCode ?? '',
      clinic: CLINIC_LABELS[row.visit.clinic ?? 'GENERAL'],
      diagnosis: row.visit.diagnosis ?? row.visit.reason,
      services: row.visit.orders
        .filter((order) => order.chargeable !== false)
        .map((order) => order.name)
        .join('; '),
      amountGhs: claim?.amountGhs ?? row.visit.orders.filter((order) => order.chargeable !== false).reduce((sum, order) => sum + order.priceGhs, 0),
      status: CLAIM_STATUS_LABEL[claim?.status ?? 'DRAFT'],
    };
  });
  const lines: AccountantClaimLine[] = rows.flatMap((row) => {
    const patient = row.patient;
    const name = patient ? `${patient.firstName} ${patient.lastName}` : 'Unknown patient';
    return row.visit.orders
      .filter((order) => order.chargeable !== false)
      .map((order) => ({
        claimNo: row.claim?.claimNo ?? 'Pending',
        patientName: name,
        service: order.name,
        department: order.department,
        amountGhs: order.priceGhs,
      }));
  });
  const totalGhs = claims.reduce((sum, row) => sum + row.amountGhs, 0);
  return { claims, lines, totalGhs };
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function stringCell(value: string): string {
  return `<Cell><Data ss:Type="String">${xmlEscape(value)}</Data></Cell>`;
}

function numberCell(value: number): string {
  return `<Cell><Data ss:Type="Number">${value.toFixed(2)}</Data></Cell>`;
}

function headerRow(labels: string[]): string {
  return `<Row>${labels.map(stringCell).join('')}</Row>`;
}

export function accountantClaimsExcelXml(state: CareState, visitId?: string): string {
  const pack = accountantClaimPack(state, visitId);
  const claimHeader = [
    'Claim no',
    'Submitted',
    'Patient',
    'Folder',
    'Scheme',
    'Insurer',
    'NHIS / Ghana Card / policy',
    'CC code',
    'Clinic',
    'Diagnosis',
    'Services',
    'Amount GHS',
    'Status',
  ];
  const claimRows = pack.claims
    .map(
      (row) =>
        `<Row>${stringCell(row.claimNo)}${stringCell(row.submittedAt)}${stringCell(row.patientName)}${stringCell(row.hospitalNo)}${stringCell(row.scheme)}${stringCell(row.insurer)}${stringCell(row.coverNo)}${stringCell(row.ccCode)}${stringCell(row.clinic)}${stringCell(row.diagnosis)}${stringCell(row.services)}${numberCell(row.amountGhs)}${stringCell(row.status)}</Row>`,
    )
    .join('');
  const lineHeader = ['Claim no', 'Patient', 'Service', 'Department', 'Amount GHS'];
  const lineRows = pack.lines
    .map((row) => `<Row>${stringCell(row.claimNo)}${stringCell(row.patientName)}${stringCell(row.service)}${stringCell(row.department)}${numberCell(row.amountGhs)}</Row>`)
    .join('');
  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="For accountant">
<Table>
<Row>${stringCell('Claims for the accountant — check this list before sending to NHIS / government for remittance.')}</Row>
<Row>${stringCell(`Prepared ${new Date().toLocaleString()} · Total GHS ${pack.totalGhs.toFixed(2)}`)}</Row>
<Row></Row>
${headerRow(claimHeader)}
${claimRows}
<Row>${stringCell('')}${stringCell('')}${stringCell('')}${stringCell('')}${stringCell('')}${stringCell('')}${stringCell('')}${stringCell('')}${stringCell('')}${stringCell('')}${stringCell('Total')}${numberCell(pack.totalGhs)}${stringCell('')}</Row>
</Table>
</Worksheet>
<Worksheet ss:Name="Service lines">
<Table>
${headerRow(lineHeader)}
${lineRows}
</Table>
</Worksheet>
</Workbook>`;
}

export function accountantExcelFilename(now = new Date()): string {
  const day = now.toISOString().slice(0, 10);
  return `claims-for-accountant-${day}.xls`;
}

export function downloadAccountantClaimsExcel(state: CareState, visitId?: string): void {
  downloadText(accountantExcelFilename(), accountantClaimsExcelXml(state, visitId), 'application/vnd.ms-excel');
}
