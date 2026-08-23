export default function VitalsPad({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'];
  return (
    <div className="mt-2 grid grid-cols-3 gap-1">
      {keys.map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => {
            if (key === '⌫') onChange(value.slice(0, -1));
            else onChange(`${value}${key}`);
          }}
          className="rounded-lg bg-slate-100 py-2 text-lg font-bold hover:bg-slate-200"
        >
          {key}
        </button>
      ))}
    </div>
  );
}
