"use client";

export default function Switch({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-3.5">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {description && <p className="mt-0.5 text-xs text-ink-3">{description}</p>}
      </div>
      <input
        type="checkbox"
        className="vlt-switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}
