import { describe, expect, it } from 'vitest';
import { paidReceipts, receiptFromVisit } from './printReceipt';
import { receiptsPdfBytes } from './receiptsPdf';
import { createSeedState } from './seed';

describe('receipt PDFs', () => {
  const state = createSeedState();

  it('builds a paid receipt with every paid line', () => {
    const visit = state.visits.find((item) => item.id === 'vis-omar');
    const patient = state.patients.find((item) => item.id === 'pat-omar');
    const copy = receiptFromVisit(visit!, patient, state.staff);
    expect(copy?.receiptNo).toBe('RCP-00002');
    expect(copy?.items.length).toBeGreaterThan(1);
    expect(copy?.paidTotal).toBeGreaterThan(0);
  });

  it('lists paid receipts and builds a PDF', () => {
    const copies = paidReceipts(state, 'all');
    expect(copies.length).toBeGreaterThan(0);
    const pdf = receiptsPdfBytes(copies);
    const header = new TextDecoder().decode(pdf.slice(0, 8));
    expect(header).toBe('%PDF-1.4');
    expect(pdf.length).toBeGreaterThan(200);
  });
});
