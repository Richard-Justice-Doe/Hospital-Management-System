import { describe, expect, it } from 'vitest';
import { canAccessPage, effectivePages, pagesFromChecks } from './permissions';

describe('page permissions', () => {
  it('gives a nurse the nursing pages and not lab', () => {
    const pages = effectivePages({ role: 'NURSE' });
    expect(pages).toContain('nursing');
    expect(pages).toContain('shifts');
    expect(pages).not.toContain('lab');
    expect(pages).not.toContain('admin');
  });

  it('lets admin add an extra page and hide a default page', () => {
    const pages = effectivePages({ role: 'NURSE', extra: ['lab'], hidden: ['ward'] });
    expect(pages).toContain('lab');
    expect(pages).not.toContain('ward');
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
});
