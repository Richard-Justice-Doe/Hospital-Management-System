import { DEFAULT_SERVICES } from './catalog';
import type { DrugStockRecord, HospitalService } from './types';

function stock(
  id: string,
  serviceId: string,
  name: string,
  quantity: number,
  reorderAt: number,
  expiresOn: string,
  drugClass: string,
  controlled = false,
): DrugStockRecord {
  return { id, serviceId, name, quantity, reorderAt, expiresOn, controlled, drugClass };
}

export const DEFAULT_DRUG_STOCK: DrugStockRecord[] = [
  stock('stk-pcm', 'rx-pcm', 'Paracetamol 500mg', 240, 40, '2027-03-01', 'analgesic'),
  stock('stk-amox', 'rx-amox', 'Amoxicillin 500mg', 80, 20, '2026-11-15', 'penicillin'),
  stock('stk-ors', 'rx-ors', 'ORS sachet', 150, 30, '2027-08-01', 'rehydration'),
  stock('stk-act', 'rx-act', 'ACT antimalarial', 60, 15, '2027-01-20', 'antimalarial'),
  stock('stk-prenatal', 'rx-prenatal', 'Prenatal vitamins', 90, 20, '2027-06-01', 'vitamin'),
  stock('stk-ibu', 'rx-ibuprofen', 'Ibuprofen 400mg', 100, 20, '2026-09-01', 'nsaid'),
  stock('stk-metro', 'rx-metro', 'Metronidazole 400mg', 70, 15, '2027-02-01', 'antibiotic'),
  stock('stk-cipro', 'rx-cipro', 'Ciprofloxacin 500mg', 55, 12, '2027-04-01', 'antibiotic'),
  stock('stk-coamox', 'rx-coamox', 'Co-amoxiclav 625mg', 40, 10, '2026-12-15', 'penicillin'),
  stock('stk-fluclo', 'rx-fluclo', 'Flucloxacillin 500mg', 45, 10, '2027-01-10', 'penicillin'),
  stock('stk-cefuro', 'rx-cefuro', 'Cefuroxime 500mg', 28, 8, '2026-10-20', 'antibiotic'),
  stock('stk-zinc', 'rx-zinc', 'Zinc sulphate 20mg', 3, 10, '2027-05-01', 'mineral'),
  stock('stk-alben', 'rx-alben', 'Albendazole 400mg', 64, 16, '2027-07-01', 'anthelmintic'),
  stock('stk-folic', 'rx-folic', 'Folic acid 5mg', 110, 20, '2027-09-01', 'vitamin'),
  stock('stk-multi', 'rx-multi', 'Multivitamin', 85, 20, '2027-06-15', 'vitamin'),
  stock('stk-omep', 'rx-omep', 'Omeprazole 20mg', 50, 12, '2027-03-20', 'ppi'),
  stock('stk-metf', 'rx-metf', 'Metformin 500mg', 72, 18, '2027-01-05', 'antidiabetic'),
  stock('stk-amlo', 'rx-amlo', 'Amlodipine 10mg', 60, 15, '2027-02-12', 'antihypertensive'),
  stock('stk-diclo', 'rx-diclo', 'Diclofenac 50mg', 88, 20, '2026-11-01', 'nsaid'),
  stock('stk-cough', 'rx-cough', 'Cough syrup 100ml', 36, 10, '2026-10-01', 'cough'),
  stock('stk-hydro', 'rx-hydro', 'Hydrocortisone cream', 22, 8, '2027-04-18', 'steroid'),
  stock('stk-salb', 'rx-salb', 'Salbutamol inhaler', 0, 6, '2027-08-01', 'inhaler'),
  stock('stk-insulin', 'rx-insulin', 'Soluble insulin vial', 0, 4, '2026-12-20', 'insulin'),
  stock('stk-morph', 'rx-pcm', 'Morphine ampoule (controlled)', 8, 4, '2026-12-01', 'opioid', true),
];

export function ensureDefaultServices(services: HospitalService[] | undefined): HospitalService[] {
  const current = Array.isArray(services) ? services : [];
  const ids = new Set(current.map((item) => item.id));
  return [...current, ...DEFAULT_SERVICES.filter((item) => !ids.has(item.id))];
}

export function ensureDrugStock(stockList: DrugStockRecord[] | undefined): DrugStockRecord[] {
  const current = Array.isArray(stockList) ? stockList : [];
  const ids = new Set(current.map((item) => item.id));
  return [...current, ...DEFAULT_DRUG_STOCK.filter((item) => !ids.has(item.id))];
}

export function isOutOfStock(item: DrugStockRecord): boolean {
  return item.quantity <= 0;
}

export function isLowStock(item: DrugStockRecord): boolean {
  return item.quantity > 0 && item.quantity <= item.reorderAt;
}

export function outOfStockItems(stockList: DrugStockRecord[] | undefined): DrugStockRecord[] {
  return (stockList ?? []).filter(isOutOfStock);
}

export function lowStockItems(stockList: DrugStockRecord[] | undefined): DrugStockRecord[] {
  return (stockList ?? []).filter(isLowStock);
}

export function stockAlertKey(stockList: DrugStockRecord[] | undefined): string {
  return outOfStockItems(stockList)
    .map((item) => item.id)
    .sort()
    .join('|');
}

export function itemsNeedingRestock(stockList: DrugStockRecord[] | undefined): DrugStockRecord[] {
  return [...outOfStockItems(stockList), ...lowStockItems(stockList)];
}

export function suggestedRestockQty(item: DrugStockRecord): number {
  if (item.quantity <= 0) return Math.max(item.reorderAt * 2, 6);
  return Math.max(item.reorderAt, 1);
}
