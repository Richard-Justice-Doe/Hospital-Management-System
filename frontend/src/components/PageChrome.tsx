import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

export function DeskPage({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`desk-page ${className}`.trim()}>{children}</div>;
}

export function PageHeader({
  title,
  hint,
  actions,
  kicker,
}: {
  title: string;
  hint?: string;
  kicker?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        {kicker ? <p className="desk-kicker">{kicker}</p> : null}
        <h1 className={`desk-title ${kicker ? 'mt-1' : ''}`.trim()}>{title}</h1>
        {hint ? <p className="desk-hint">{hint}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function DeskPanel({
  children,
  className = '',
  padded = true,
  title,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
  title?: string;
}) {
  return (
    <section className={`desk-panel ${padded ? 'p-5' : ''} ${className}`.trim()}>
      {title ? <h2 className="desk-section-title">{title}</h2> : null}
      {title ? <div className={padded ? 'mt-3' : 'p-5'}>{children}</div> : children}
    </section>
  );
}

export function FeatureRail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-700/40 shadow-sm">
      <p className="bg-slate-800 px-3 py-2.5 text-sm font-semibold tracking-wide text-white">{label}</p>
      <nav className="flex flex-col bg-slate-800" aria-label={label}>
        {children}
      </nav>
    </div>
  );
}

export function FeatureLink({ to, active, children }: { to: string; active: boolean; children: ReactNode }) {
  return (
    <NavLink
      to={to}
      className={`px-3 py-2.5 text-sm ${active ? 'bg-clinic-600 font-medium text-white' : 'text-slate-200 hover:bg-slate-700'}`}
    >
      {children}
    </NavLink>
  );
}

export function DeskTabs({
  items,
  value,
  onChange,
}: {
  items: ReadonlyArray<{ id: string; label: string }>;
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
            value === item.id ? 'bg-clinic-600 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-clinic-50'
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function DeskLayout({ rail, children }: { rail: ReactNode; children: ReactNode }) {
  return (
    <div className="mt-5 grid gap-5 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="space-y-3">{rail}</aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
