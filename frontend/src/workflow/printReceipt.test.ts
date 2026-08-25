import { describe, expect, it } from 'vitest';
import { folderCoverHtml, idCardHtml, labSampleLabelHtml, queueTicketHtml, visitBillHtml } from './printReceipt';
import { createSeedState } from './seed';

describe('print slips', () => {
  const state = createSeedState();
  const patient = state.patients[0]!;
  const visit = state.visits[0]!;
  const privatePatient = state.patients.find((item) => item.insuranceType === 'PRIVATE')!;

  it('prints a patient ID card with the folder number and cover on file', () => {
    const html = idCardHtml(patient);
    expect(html).toContain(patient.hospitalNo);
    expect(html).toContain(patient.firstName);
    expect(html).toContain('Patient ID card');
    expect(html).toContain(patient.phone);
  });

  it('prints a folder cover with name, phone, and private insurance', () => {
    const html = folderCoverHtml(privatePatient);
    expect(html).toContain(privatePatient.hospitalNo);
    expect(html).toContain(privatePatient.firstName);
    expect(html).toContain(privatePatient.phone);
    expect(html).toContain(privatePatient.insuranceProvider ?? '');
    expect(html).toContain(privatePatient.insuranceNumber ?? '');
    expect(html).toContain('Patient folder');
  });

  it('prints a queue ticket', () => {
    const html = queueTicketHtml(patient, { ...visit, queueNo: 12 });
    expect(html).toContain('12');
    expect(html).toContain(patient.hospitalNo);
    expect(html).toContain('Queue ticket');
  });

  it('prints a lab sample label', () => {
    const html = labSampleLabelHtml({
      patientName: `${patient.firstName} ${patient.lastName}`,
      hospitalNo: patient.hospitalNo,
      accessionNo: 'ACC-00021',
      testName: 'FBC',
      collectedAt: new Date().toISOString(),
    });
    expect(html).toContain('ACC-00021');
    expect(html).toContain('FBC');
    expect(html).toContain(patient.hospitalNo);
  });

  it('prints a visit bill with folder number and amount due', () => {
    const unpaid = state.visits.find((item) => item.id === 'vis-nina')!;
    const person = state.patients.find((item) => item.id === unpaid.patientId)!;
    const html = visitBillHtml(person, unpaid);
    expect(html).toContain(person.hospitalNo);
    expect(html).toContain(person.firstName);
    expect(html).toContain('Amount due');
    expect(html).toContain('UNPAID');
  });
});
