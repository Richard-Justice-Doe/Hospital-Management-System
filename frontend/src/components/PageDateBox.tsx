import { useEffect, useState } from 'react';

const STORAGE_KEY = 'cms_page_date';

export function todayDateValue(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isoToDateValue(iso?: string) {
  if (!iso) return todayDateValue();
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return todayDateValue();
  return todayDateValue(date);
}

export function usePageDate() {
  const [date, setDate] = useState(() => {
    if (typeof window === 'undefined') return todayDateValue();
    return window.localStorage.getItem(STORAGE_KEY) || todayDateValue();
  });

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, date);
  }, [date]);

  return [date, setDate] as const;
}

export default function PageDateBox({
  tone = 'light',
}: {
  tone?: 'light' | 'dark';
}) {
  const [date, setDate] = usePageDate();
  const light = tone === 'light';

  return (
    <label className={`flex items-center gap-2 text-sm font-medium ${light ? 'text-slate-700' : 'text-white'}`}>
      Date
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className={`rounded-lg border px-3 py-1.5 font-semibold ${
          light ? 'border-slate-300 bg-white text-slate-900' : 'border-white/30 bg-white/10 text-white'
        }`}
      />
    </label>
  );
}
