import { describe, expect, it } from 'vitest';
import { idCardHtml, labSampleLabelHtml, queueTicketHtml } from './printReceipt';
import { createSeedState } from './seed';

describe('print slips', () => {
  const state = createSeedState();
  const patient = state.patients[0]!;
  const visit = state.visits[0]!;

  it('prints a patient ID card with the folder number', () => {
    const html = idCardHtml(patient);
    expect(html).toContain(patient.hospitalNo);
    expect(html).toContain(patient.firstName);
    expect(html).toContain('Patient ID card');
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
});
