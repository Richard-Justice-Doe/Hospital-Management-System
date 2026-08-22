import type { DepartmentStatRow, StatBlock, TrendPoint } from '../workflow/dashboard';

export const METRIC_COLORS = {
  visits: '#0284c7',
  registration: '#0d9488',
  nhis: '#0369a1',
  private: '#ea580c',
  checkIns: '#7c3aed',
} as const;

export const METRIC_LABELS: Record<keyof StatBlock, string> = {
  visits: 'Total visits',
  registration: 'Registration',
  nhis: 'NHIS',
  private: 'Private',
  checkIns: 'Total check-ins',
};

const METRIC_KEYS: Array<keyof StatBlock> = ['visits', 'registration', 'nhis', 'private', 'checkIns'];

export function ChartLegend({ keys = METRIC_KEYS }: { keys?: Array<keyof StatBlock> }) {
  return (
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
      {keys.map((key) => (
        <li key={key} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: METRIC_COLORS[key] }} />
          {METRIC_LABELS[key]}
        </li>
      ))}
    </ul>
  );
}

export function TrendAreaChart({
  points,
  title,
}: {
  points: TrendPoint[];
  title: string;
}) {
  const width = 720;
  const height = 220;
  const pad = { top: 16, right: 12, bottom: 36, left: 28 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const max = Math.max(1, ...points.map((point) => Math.max(point.visits, point.checkIns, point.registration)));
  const step = points.length > 1 ? innerW / (points.length - 1) : innerW;

  function pathFor(key: keyof StatBlock) {
    return points
      .map((point, index) => {
        const x = pad.left + index * step;
        const y = pad.top + innerH - (point[key] / max) * innerH;
        return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  }

  function areaFor(key: keyof StatBlock) {
    const line = pathFor(key);
    const lastX = pad.left + (points.length - 1) * step;
    const base = pad.top + innerH;
    return `${line} L ${lastX.toFixed(1)} ${base} L ${pad.left} ${base} Z`;
  }

  return (
    <figure>
      <svg role="img" aria-label={title} viewBox={`0 0 ${width} ${height}`} className="h-56 w-full">
        <title>{title}</title>
        {[0, 0.5, 1].map((tick) => {
          const y = pad.top + innerH - tick * innerH;
          return (
            <g key={tick}>
              <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} stroke="#e2e8f0" />
              <text x={4} y={y + 4} className="fill-slate-400" fontSize="10">
                {Math.round(max * tick)}
              </text>
            </g>
          );
        })}
        <path d={areaFor('visits')} fill={METRIC_COLORS.visits} opacity="0.12" />
        <path d={pathFor('visits')} fill="none" stroke={METRIC_COLORS.visits} strokeWidth="2.5" />
        <path d={pathFor('checkIns')} fill="none" stroke={METRIC_COLORS.checkIns} strokeWidth="2" strokeDasharray="4 3" />
        <path d={pathFor('registration')} fill="none" stroke={METRIC_COLORS.registration} strokeWidth="2" />
        {points.map((point, index) => (
          <circle
            key={point.label}
            cx={pad.left + index * step}
            cy={pad.top + innerH - (point.visits / max) * innerH}
            r="3.5"
            fill={METRIC_COLORS.visits}
          >
            <title>
              {point.label}: {point.visits} visits, {point.registration} registrations, {point.checkIns} check-ins
            </title>
          </circle>
        ))}
        {points.map((point, index) =>
          index % 3 === 0 ? (
            <text
              key={`l-${point.label}`}
              x={pad.left + index * step}
              y={height - 10}
              textAnchor="middle"
              className="fill-slate-500"
              fontSize="10"
            >
              {point.label}
            </text>
          ) : null,
        )}
      </svg>
      <ChartLegend keys={['visits', 'checkIns', 'registration']} />
    </figure>
  );
}

export function HorizontalBarChart({
  rows,
  metric,
  title,
}: {
  rows: DepartmentStatRow[];
  metric: keyof StatBlock;
  title: string;
}) {
  const max = Math.max(1, ...rows.map((row) => row[metric]));
  const barH = 18;
  const gap = 10;
  const labelW = 128;
  const width = 640;
  const height = rows.length * (barH + gap) + 8;

  return (
    <svg role="img" aria-label={title} viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height: Math.max(180, rows.length * 28) }}>
      <title>{title}</title>
      {rows.map((row, index) => {
        const y = index * (barH + gap);
        const barW = ((width - labelW - 36) * row[metric]) / max;
        return (
          <g key={row.id}>
            <text x={0} y={y + 13} className="fill-slate-600" fontSize="11">
              {row.label.length > 18 ? `${row.label.slice(0, 17)}…` : row.label}
            </text>
            <rect x={labelW} y={y} width={width - labelW - 8} height={barH} rx="4" fill="#f1f5f9" />
            <rect x={labelW} y={y} width={Math.max(row[metric] ? 6 : 0, barW)} height={barH} rx="4" fill={METRIC_COLORS[metric]} />
            <text x={labelW + Math.max(barW, 8) + 6} y={y + 13} className="fill-slate-700" fontSize="11">
              {row[metric]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function GroupedBarChart({
  rows,
  title,
}: {
  rows: DepartmentStatRow[];
  title: string;
}) {
  const keys: Array<keyof StatBlock> = ['visits', 'registration', 'checkIns'];
  const max = Math.max(1, ...rows.flatMap((row) => keys.map((key) => row[key])));
  const groupW = 56;
  const barW = 12;
  const padL = 28;
  const padB = 78;
  const padT = 12;
  const width = Math.max(480, padL + rows.length * groupW + 8);
  const height = 240;
  const innerH = height - padT - padB;

  return (
    <figure>
      <svg role="img" aria-label={title} viewBox={`0 0 ${width} ${height}`} className="h-64 w-full">
        <title>{title}</title>
        {[0, 0.5, 1].map((tick) => {
          const y = padT + innerH - tick * innerH;
          return (
            <g key={tick}>
              <line x1={padL} x2={width - 8} y1={y} y2={y} stroke="#e2e8f0" />
              <text x={2} y={y + 3} className="fill-slate-400" fontSize="10">
                {Math.round(max * tick)}
              </text>
            </g>
          );
        })}
        {rows.map((row, index) => {
          const x0 = padL + index * groupW + 8;
          return (
            <g key={row.id}>
              {keys.map((key, barIndex) => {
                const h = (row[key] / max) * innerH;
                const x = x0 + barIndex * (barW + 2);
                const y = padT + innerH - h;
                return (
                  <rect key={key} x={x} y={y} width={barW} height={Math.max(h, row[key] ? 2 : 0)} rx="2" fill={METRIC_COLORS[key]}>
                    <title>
                      {row.label} · {METRIC_LABELS[key]}: {row[key]}
                    </title>
                  </rect>
                );
              })}
              <text
                x={x0 + 20}
                y={height - 8}
                fontSize="10"
                className="fill-slate-600"
                textAnchor="end"
                transform={`rotate(-48 ${x0 + 20} ${height - 8})`}
              >
                {row.label}
              </text>
            </g>
          );
        })}
      </svg>
      <ChartLegend keys={keys} />
    </figure>
  );
}

export function PayerDonut({ nhis, privateCount, title }: { nhis: number; privateCount: number; title: string }) {
  const total = nhis + privateCount;
  const r = 54;
  const c = 2 * Math.PI * r;
  const nhisLen = total === 0 ? 0 : (nhis / total) * c;
  const privateLen = total === 0 ? 0 : (privateCount / total) * c;

  return (
    <figure className="flex flex-col items-center">
      <svg role="img" aria-label={title} viewBox="0 0 160 160" className="h-44 w-44">
        <title>{title}</title>
        <circle cx="80" cy="80" r={r} fill="none" stroke="#e2e8f0" strokeWidth="18" />
        {total > 0 && (
          <>
            <circle
              cx="80"
              cy="80"
              r={r}
              fill="none"
              stroke={METRIC_COLORS.nhis}
              strokeWidth="18"
              strokeDasharray={`${nhisLen} ${c}`}
              strokeLinecap="round"
              transform="rotate(-90 80 80)"
            />
            <circle
              cx="80"
              cy="80"
              r={r}
              fill="none"
              stroke={METRIC_COLORS.private}
              strokeWidth="18"
              strokeDasharray={`${privateLen} ${c}`}
              strokeDashoffset={-nhisLen}
              strokeLinecap="round"
              transform="rotate(-90 80 80)"
            />
          </>
        )}
        <text x="80" y="76" textAnchor="middle" className="fill-slate-900" fontSize="22" fontWeight="600">
          {total}
        </text>
        <text x="80" y="96" textAnchor="middle" className="fill-slate-500" fontSize="11">
          visits
        </text>
      </svg>
      <ChartLegend keys={['nhis', 'private']} />
    </figure>
  );
}

export function StackedPayerBars({ rows, title }: { rows: DepartmentStatRow[]; title: string }) {
  const max = Math.max(1, ...rows.map((row) => row.nhis + row.private));
  const barH = 16;
  const gap = 12;
  const labelW = 128;
  const width = 640;
  const height = rows.length * (barH + gap) + 8;

  return (
    <svg role="img" aria-label={title} viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height: Math.max(180, rows.length * 28) }}>
      <title>{title}</title>
      {rows.map((row, index) => {
        const y = index * (barH + gap);
        const scale = (width - labelW - 40) / max;
        const nhisW = row.nhis * scale;
        const privateW = row.private * scale;
        return (
          <g key={row.id}>
            <text x={0} y={y + 12} className="fill-slate-600" fontSize="11">
              {row.label.length > 18 ? `${row.label.slice(0, 17)}…` : row.label}
            </text>
            <rect x={labelW} y={y} width={width - labelW - 8} height={barH} rx="4" fill="#f1f5f9" />
            <rect x={labelW} y={y} width={nhisW} height={barH} fill={METRIC_COLORS.nhis} />
            <rect x={labelW + nhisW} y={y} width={privateW} height={barH} fill={METRIC_COLORS.private} />
            <text x={labelW + nhisW + privateW + 6} y={y + 12} className="fill-slate-700" fontSize="11">
              {row.nhis + row.private}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function DepartmentSpark({ row }: { row: DepartmentStatRow }) {
  const max = Math.max(1, row.visits, row.registration, row.checkIns, row.nhis, row.private);
  return (
    <div className="mt-3 space-y-1.5">
      {METRIC_KEYS.map((key) => (
        <div key={key} className="flex items-center gap-2">
          <span className="w-20 shrink-0 text-[10px] uppercase tracking-wide text-slate-500">{METRIC_LABELS[key]}</span>
          <div className="h-1.5 flex-1 rounded-full bg-slate-100">
            <div
              className="h-1.5 rounded-full"
              style={{ width: `${(row[key] / max) * 100}%`, background: METRIC_COLORS[key] }}
            />
          </div>
          <span className="w-6 text-right text-xs font-medium text-slate-700">{row[key]}</span>
        </div>
      ))}
    </div>
  );
}
