import { useMemo, useState } from 'react';

export default function SearchableSelect({
  label,
  required,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ id: string; label: string }>;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = options.find((option) => option.id === value);
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((option) => option.label.toLowerCase().includes(q));
  }, [options, query]);

  return (
    <label className="relative block text-sm font-medium text-slate-700">
      {label}
      {required ? <span className="text-red-600">*</span> : null}
      <button
        type="button"
        className="mt-1 flex w-full items-center justify-between rounded-lg border border-slate-300 bg-white px-3 py-2 text-left text-sm font-normal"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-label={placeholder}
      >
        <span className={selected ? 'text-slate-900' : 'text-slate-400'}>{selected?.label ?? placeholder}</span>
        <span className="text-slate-400">{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border bg-white shadow-lg">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full border-b px-3 py-2 text-sm outline-none"
            aria-label={`Search ${label}`}
          />
          <ul className="max-h-48 overflow-auto py-1">
            {matches.length === 0 ? (
              <li className="px-3 py-2 text-sm text-slate-500">No match.</li>
            ) : (
              matches.map((option) => (
                <li key={option.id}>
                  <button
                    type="button"
                    className={`w-full px-3 py-2 text-left text-sm ${option.id === value ? 'bg-sky-600 text-white' : 'hover:bg-sky-50'}`}
                    onClick={() => {
                      onChange(option.id);
                      setQuery('');
                      setOpen(false);
                    }}
                  >
                    {option.label}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </label>
  );
}
