import type { LabFlag, LabLine } from './types';

export interface LabAnalyteDef {
  id: string;
  name: string;
  unit: string;
  refLow?: number;
  refHigh?: number;
  type: 'number' | 'choice';
  options?: string[];
}

const num = (id: string, name: string, unit: string, refLow?: number, refHigh?: number): LabAnalyteDef => ({
  id,
  name,
  unit,
  refLow,
  refHigh,
  type: 'number',
});

const choice = (id: string, name: string, unit: string, options: string[]): LabAnalyteDef => ({
  id,
  name,
  unit,
  type: 'choice',
  options,
});

export const LAB_PANELS: Record<string, LabAnalyteDef[]> = {
  'lab-fbc': [
    num('hb', 'Hb', 'g/dL', 12, 16),
    num('wbc', 'WBC', 'x10⁹/L', 4, 11),
    num('rbc', 'RBC', 'x10¹²/L', 4.2, 5.4),
    num('pcv', 'PCV', '%', 36, 46),
    num('plt', 'Platelets', 'x10⁹/L', 150, 400),
  ],
  'lab-rft': [
    num('bun', 'BUN', 'mg/dL', 7, 20),
    num('creat', 'Creatinine', 'mg/dL', 0.6, 1.3),
    num('uric', 'Uric acid', 'mg/dL', 3.5, 7.2),
  ],
  'lab-lft': [
    num('alp', 'ALP', 'U/L', 44, 147),
    num('alt', 'ALT', 'U/L', 7, 56),
    num('ast', 'AST', 'U/L', 10, 40),
    num('tbil', 'Total bilirubin', 'mg/dL', 0.1, 1.2),
  ],
  'lab-lipid': [
    num('chol', 'Cholesterol', 'mg/dL', 0, 200),
    num('trig', 'Triglyceride', 'mg/dL', 0, 150),
    num('hdl', 'HDL', 'mg/dL', 40, 80),
    num('ldl', 'LDL', 'mg/dL', 0, 100),
  ],
  'lab-rbs': [num('rbs', 'RBS / FBS', 'mg/dL', 70, 110)],
  'lab-rdt': [choice('rdt', 'Malaria RDT', '', ['Negative', 'Positive'])],
  'lab-mp': [choice('mp', 'Malaria parasites', '', ['Not seen', 'Seen'])],
  'lab-sickling': [choice('sickle', 'Sickling', '', ['Negative', 'Positive'])],
  'lab-group': [choice('group', 'Blood group', '', ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])],
  'lab-urine': [
    choice('protein', 'Protein', '', ['Nil', 'Trace', '+', '++', '+++']),
    choice('glucose', 'Glucose', '', ['Nil', 'Trace', '+', '++', '+++']),
    num('leuco', 'Leucocytes', '/HPF', 0, 5),
  ],
  'lab-stool': [choice('stool', 'Stool RE', '', ['No ova/cyst', 'Ova seen', 'Cyst seen', 'Occult blood'])],
  'lab-widal': [choice('widal', 'Widal', '', ['Negative', 'Positive'])],
  'lab-hpylori': [choice('hpylori', 'H. pylori', '', ['Negative', 'Positive'])],
  'lab-preg': [choice('hcg', 'Pregnancy test', '', ['Negative', 'Positive'])],
  'lab-hiv': [choice('hiv', 'HIV screening', '', ['Non-reactive', 'Reactive'])],
  'lab-hepb': [choice('hepb', 'HBsAg', '', ['Non-reactive', 'Reactive'])],
};

export function panelFor(serviceId: string, fallbackName: string): LabAnalyteDef[] {
  return LAB_PANELS[serviceId] ?? [num(serviceId, fallbackName, '')];
}

export function flagFor(def: LabAnalyteDef, raw: string): LabFlag {
  const value = raw.trim();
  if (!value) return '';
  if (def.type === 'choice') {
    const abnormal = ['Positive', 'Seen', 'Reactive', '+', '++', '+++', 'Occult blood'];
    return abnormal.includes(value) ? 'H' : '';
  }
  const n = Number(value);
  if (Number.isNaN(n)) return '';
  if (def.refHigh != null && n > def.refHigh) return 'H';
  if (def.refLow != null && n < def.refLow) return 'L';
  return '';
}

export function linesFromValues(defs: LabAnalyteDef[], values: Record<string, string>): LabLine[] {
  return defs.map((def) => {
    const value = (values[def.id] ?? '').trim();
    return {
      id: def.id,
      name: def.name,
      value,
      unit: def.unit,
      flag: flagFor(def, value),
    };
  });
}

export function summarizeLabLines(lines: LabLine[]): string {
  const filled = lines.filter((line) => line.value);
  if (filled.length === 0) return '';
  return filled
    .map((line) => `${line.name} ${line.value}${line.unit ? ` ${line.unit}` : ''}${line.flag ? ` ${line.flag}` : ''}`)
    .join('; ');
}

export function linesFromOrder(order: { labLines?: LabLine[]; result?: string; name: string; serviceId: string }): LabLine[] {
  if (order.labLines && order.labLines.length > 0) return order.labLines;
  if (!order.result) return [];
  return [{ id: order.serviceId, name: order.name, value: order.result, unit: '', flag: '' }];
}
