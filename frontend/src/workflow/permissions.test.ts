import { describe, expect, it } from 'vitest';
import { canAccessPage, effectivePages, pagesFromChecks } from './permissions';

describe('page permissions', () => {
  it('gives a nurse the nursing pages and not lab', () => {
    const pages = effectivePages({ role: 'NURSE' });
    expect(pages).toContain('nursing');
    expect(pages).toContain('shifts');
    expect(pages).not.toContain('lab');
    expect(pages).not.toContain('admin');
    expect(pages).not.toContain('reception');
  });

  it('gives reception only reception work, not other departments', () => {
    const pages = effectivePages({ role: 'RECEPTIONIST' });
    expect(pages).toContain('reception');
    expect(pages).toContain('appointments');
    expect(pages).toContain('dashboard');
    expect(pages).not.toContain('nursing');
    expect(pages).not.toContain('lab');
    expect(pages).not.toContain('triage');
    expect(pages).not.toContain('billing');
    expect(pages).not.toContain('doctor');
  });

  it('gives a ward nurse the ward desk, not the OPD nursing queue', () => {
    const pages = effectivePages({ role: 'NURSE', department: 'WARD' });
    expect(pages).toContain('ward');
    expect(pages).not.toContain('nursing');
    expect(pages).not.toContain('theatre');
    expect(pages).not.toContain('lab');
  });

  it('keeps the dashboard required even if someone tries to hide it', () => {
    const pages = effectivePages({ role: 'NURSE', hidden: ['dashboard'] });
    expect(pages).toContain('dashboard');
    expect(pagesFromChecks('LAB', ['chart', 'assistant', 'messages', 'shifts', 'lab']).hidden).not.toContain('dashboard');
  });

  it('lets admin add an extra page and hide a default page', () => {
    const pages = effectivePages({ role: 'NURSE', extra: ['lab'], hidden: ['messages'] });
    expect(pages).toContain('lab');
    expect(pages).not.toContain('messages');
    expect(canAccessPage({ role: 'NURSE', extra: ['lab'] }, 'lab')).toBe(true);
  });

  it('never grants Admin setup through extras', () => {
    expect(canAccessPage({ role: 'NURSE', extra: ['admin'] }, 'admin')).toBe(false);
    expect(canAccessPage({ role: 'ADMIN', hidden: ['admin'] }, 'admin')).toBe(true);
  });

  it('turns a checklist into extra and hidden lists', () => {
    const { extra, hidden } = pagesFromChecks('LAB', ['dashboard', 'chart', 'assistant', 'messages', 'shifts', 'nursing']);
    expect(extra).toContain('nursing');
    expect(hidden).toContain('lab');
  });

  it('uses the staff department when saving extra and hidden pages', () => {
    const { extra, hidden } = pagesFromChecks(
      'NURSE',
      ['dashboard', 'chart', 'assistant', 'messages', 'shifts', 'ward'],
      'WARD',
    );
    expect(extra).not.toContain('ward');
    expect(hidden).not.toContain('ward');
    expect(hidden).not.toContain('nursing');
  });

  it('shows only the pages admin ticked after those ticks are saved', () => {
    const ticks = ['dashboard', 'reception', 'billing'] as const;
    const saved = pagesFromChecks('RECEPTIONIST', [...ticks]);
    expect(saved.extra).toEqual(['billing']);
    expect(saved.hidden).toContain('appointments');
    const seen = effectivePages({ role: 'RECEPTIONIST', extra: saved.extra, hidden: saved.hidden });
    expect(seen).toEqual(['dashboard', 'reception', 'billing']);
    expect(canAccessPage({ role: 'RECEPTIONIST', extra: saved.extra, hidden: saved.hidden }, 'lab')).toBe(false);
  });

  it('gives the matron nursing, ward, and maternity, and doctors the clinical chart', () => {
    expect(effectivePages({ role: 'MATRON' })).toEqual(
      expect.arrayContaining(['dashboard', 'nursing', 'ward', 'maternity', 'triage', 'chart']),
    );
    expect(effectivePages({ role: 'DOCTOR' })).toContain('clinical');
    expect(effectivePages({ role: 'ADMIN' })).toContain('clinical');
    expect(effectivePages({ role: 'NURSE' })).not.toContain('clinical');
    expect(canAccessPage({ role: 'NURSE', extra: ['clinical'] }, 'clinical')).toBe(true);
    expect(effectivePages({ role: 'NURSE', rolePages: ['nursing', 'clinical'] })).toContain('clinical');
  });

  it('gives claims, stores, procurement, and IT their own desks', () => {
    expect(effectivePages({ role: 'CLAIMS' })).toContain('claims');
    expect(effectivePages({ role: 'CLAIMS' })).not.toContain('admin');
    expect(effectivePages({ role: 'STOREKEEPER' })).toContain('stores');
    expect(effectivePages({ role: 'PROCUREMENT' })).toContain('procurement');
    expect(effectivePages({ role: 'PROCUREMENT' })).toContain('stores');
    expect(effectivePages({ role: 'IT' })).toContain('it');
    expect(effectivePages({ role: 'IT' })).not.toContain('admin');
    expect(canAccessPage({ role: 'IT' }, 'reception')).toBe(false);
  });

  it('clears custom pages when admin saves empty extra and hidden lists', () => {
    const seen = effectivePages({ role: 'NURSE', extra: [], hidden: [] });
    expect(seen).toEqual(effectivePages({ role: 'NURSE' }));
    expect(seen).not.toContain('lab');
  });
});
