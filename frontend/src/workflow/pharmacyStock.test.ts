import { describe, expect, it } from 'vitest';
import { createSeedState } from './seed';
import { afterPharmacyDispense, dispenseStock, hydrateHis } from './his';
import { DEFAULT_DRUG_STOCK, ensureDrugStock, outOfStockItems } from './pharmacyStock';

describe('pharmacy stock', () => {
  it('includes the extra medicines and flags empty shelves', () => {
    const names = DEFAULT_DRUG_STOCK.map((item) => item.name);
    expect(names).toContain('Metronidazole 400mg');
    expect(names).toContain('Salbutamol inhaler');
    expect(outOfStockItems(DEFAULT_DRUG_STOCK).map((item) => item.name)).toEqual(
      expect.arrayContaining(['Salbutamol inhaler', 'Soluble insulin vial']),
    );
  });

  it('merges missing stock into an older hospital file', () => {
    const seeded = createSeedState();
    const slim = hydrateHis({ ...seeded, drugStock: seeded.drugStock.slice(0, 2) });
    expect(ensureDrugStock(slim.drugStock).length).toBe(DEFAULT_DRUG_STOCK.length);
    expect(slim.drugStock.some((item) => item.id === 'stk-insulin')).toBe(true);
    const older = hydrateHis({ ...seeded, drugStock: undefined as never, services: undefined as never });
    expect(older.drugStock.length).toBe(DEFAULT_DRUG_STOCK.length);
    expect(older.services.some((item) => item.id === 'rx-insulin')).toBe(true);
  });

  it('prompts the pharmacist when the last pack goes out', () => {
    const seeded = createSeedState();
    const zinc = seeded.drugStock.find((item) => item.id === 'stk-zinc');
    expect(zinc?.quantity).toBe(3);
    const after = dispenseStock(seeded, {
      serviceId: 'rx-zinc',
      quantity: 3,
      visitId: seeded.visits[0]?.id ?? 'vis-amara',
      staffId: 'staff-pharmacy',
    });
    expect(after.drugStock.find((item) => item.id === 'stk-zinc')?.quantity).toBe(0);
    expect(after.notifications.some((note) => note.kind === 'stock' && note.title === 'Out of stock')).toBe(true);
  });

  it('blocks a dispense and alerts when the medicine is already empty', () => {
    const seeded = createSeedState();
    const after = afterPharmacyDispense(seeded, 'unused', 'unused', 'staff-pharmacy');
    expect(after.notifications.filter((note) => note.kind === 'stock').length).toBe(0);
    const blocked = dispenseStock(seeded, {
      serviceId: 'rx-salb',
      quantity: 1,
      visitId: 'vis-amara',
      staffId: 'staff-pharmacy',
    });
    expect(blocked.drugStock.find((item) => item.id === 'stk-salb')?.quantity).toBe(0);
    expect(blocked.notifications[0]?.title).toBe('Out of stock');
  });
});
