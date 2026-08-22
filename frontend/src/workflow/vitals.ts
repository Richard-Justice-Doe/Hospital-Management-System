import type { VitalsRecord } from './types';

export type VitalsInput = Omit<VitalsRecord, 'abnormalFlags' | 'recordedAt' | 'recordedBy'>;

export function evaluateVitals(input: VitalsInput): string[] {
  const flags: string[] = [];
  if (input.systolicBp >= 140 || input.diastolicBp >= 90) flags.push('High blood pressure');
  if (input.systolicBp < 90 || input.diastolicBp < 60) flags.push('Low blood pressure');
  if (input.temperatureC >= 38) flags.push('Fever');
  if (input.temperatureC < 36) flags.push('Hypothermia');
  if (input.pulseBpm > 100) flags.push('Tachycardia');
  if (input.pulseBpm < 60) flags.push('Bradycardia');
  if (input.spo2 < 95) flags.push('Low SpO2');
  if (input.weightKg > 0 && input.heightCm > 0) {
    const heightM = input.heightCm / 100;
    const bmi = input.weightKg / (heightM * heightM);
    if (bmi >= 30) flags.push('High BMI');
    if (bmi < 18.5) flags.push('Low BMI');
  }
  return flags;
}
