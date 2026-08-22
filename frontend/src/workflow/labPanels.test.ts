import { describe, expect, it } from 'vitest';
import { flagFor, linesFromValues, panelFor, summarizeLabLines } from './labPanels';

describe('lab result table', () => {
  it('flags high and low values like a printed lab report', () => {
    const bun = panelFor('lab-rft', 'RFT').find((item) => item.id === 'bun')!;
    expect(flagFor(bun, '4.53')).toBe('L');
    expect(flagFor(bun, '25')).toBe('H');
    expect(flagFor(bun, '12')).toBe('');
  });

  it('builds a summary from filled table rows', () => {
    const defs = panelFor('lab-lipid', 'Lipid');
    const lines = linesFromValues(defs, { chol: '240', trig: '90' });
    expect(lines.find((line) => line.id === 'chol')?.flag).toBe('H');
    expect(summarizeLabLines(lines)).toMatch(/Cholesterol 240 mg\/dL H/);
    expect(summarizeLabLines(lines)).toMatch(/Triglyceride 90 mg\/dL/);
  });
});
