export default function HospitalMark({
  size = 'md',
  tone = 'onDark',
}: {
  size?: 'sm' | 'md';
  tone?: 'onDark' | 'onLight';
}) {
  const box = size === 'sm' ? 'h-9 w-9' : 'h-11 w-11';
  const icon = size === 'sm' ? 'h-5 w-5' : 'h-7 w-7';
  const wrap = tone === 'onDark' ? 'bg-white/15 ring-1 ring-white/25 text-white' : 'bg-clinic-600 text-white shadow-sm';
  return (
    <span className={`flex ${box} items-center justify-center rounded-xl ${wrap}`}>
      <svg viewBox="0 0 32 32" className={icon} aria-hidden="true">
        <rect x="13" y="4" width="6" height="24" rx="1.5" fill="currentColor" />
        <rect x="4" y="13" width="24" height="6" rx="1.5" fill="currentColor" />
      </svg>
    </span>
  );
}
