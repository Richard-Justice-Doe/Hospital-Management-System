import { useMemo, useState } from 'react';
import { useCare } from '../../context/CareContext';
import { DEPARTMENT_LABELS } from '../../workflow/catalog';
import type { Department } from '../../workflow/types';
import { EmptyState, SearchBox } from './adminUi';

export default function AdminServicesPage() {
  const { state, toggleService, updatePrice } = useCare();
  const [query, setQuery] = useState('');
  const [department, setDepartment] = useState<Department | 'ALL'>('ALL');

  const departments = (Object.keys(DEPARTMENT_LABELS) as Department[]).filter((dept) =>
    state.services.some((service) => service.department === dept),
  );

  const items = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return state.services.filter((service) => {
      if (department !== 'ALL' && service.department !== department) return false;
      if (!needle) return true;
      return service.name.toLowerCase().includes(needle) || DEPARTMENT_LABELS[service.department].toLowerCase().includes(needle);
    });
  }, [state.services, query, department]);

  const grouped = departments
    .map((dept) => ({
      dept,
      label: DEPARTMENT_LABELS[dept],
      items: items.filter((service) => service.department === dept),
    }))
    .filter((group) => group.items.length > 0);

  const enabledCount = state.services.filter((service) => service.enabled).length;

  return (
    <section className="desk-panel p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-medium text-slate-900">Hospital services</h2>
        </div>
        <p className="text-sm text-slate-500">
          {enabledCount} of {state.services.length} on
        </p>
      </div>

      <div className="mt-4">
        <SearchBox value={query} onChange={setQuery} placeholder="Search a service, e.g. malaria or X-ray" />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <DeptChip label="All departments" active={department === 'ALL'} onClick={() => setDepartment('ALL')} />
        {departments.map((dept) => (
          <DeptChip
            key={dept}
            label={DEPARTMENT_LABELS[dept]}
            active={department === dept}
            onClick={() => setDepartment(dept)}
          />
        ))}
      </div>

      {grouped.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="No matching services" hint="Clear the search or pick another department." />
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {grouped.map((group) => (
            <div key={group.dept}>
              <p className="text-xs font-semibold uppercase tracking-wide text-clinic-700">{group.label}</p>
              <ul className="mt-2 divide-y rounded-lg border border-slate-100">
                {group.items.map((service) => (
                  <li key={service.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-800">{service.name}</p>
                      <p className="text-xs text-slate-500">{service.enabled ? 'Available to order' : 'Hidden from doctors'}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-1 text-sm text-slate-600">
                        GH₵
                        <input
                          type="number"
                          min={0}
                          defaultValue={service.priceGhs}
                          key={`${service.id}-${service.priceGhs}`}
                          onBlur={(e) => {
                            const next = Number(e.target.value);
                            if (!Number.isNaN(next) && next !== service.priceGhs) updatePrice(service.id, next);
                          }}
                          className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                          aria-label={`Price for ${service.name}`}
                        />
                      </label>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={service.enabled}
                        aria-label={`${service.enabled ? 'Turn off' : 'Turn on'} ${service.name}`}
                        onClick={() => toggleService(service.id, !service.enabled)}
                        className={`relative h-7 w-12 rounded-full transition-colors ${
                          service.enabled ? 'bg-clinic-600' : 'bg-slate-300'
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition-[left] ${
                            service.enabled ? 'left-5' : 'left-0.5'
                          }`}
                        />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function DeptChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-medium ${
        active ? 'bg-clinic-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      }`}
    >
      {label}
    </button>
  );
}
