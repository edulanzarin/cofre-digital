"use client";

import { centsFromTyping, moneyDigits } from "@/lib/money";

// Campo de dinheiro em centavos: a máscara empurra as casas conforme se
// digita (9 → 0,09; 95000 → 950,00), então o campo nunca precisa adivinhar
// se o ponto era milhar ou decimal. O "R$" fica fora do campo, como rótulo.
export default function CurrencyInput({
  value,
  onChange,
  placeholder = "0,00",
  id,
}: {
  value: number | null; // centavos
  onChange: (cents: number | null) => void;
  placeholder?: string;
  id?: string;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-xs text-ink-3">
        R$
      </span>
      <input
        id={id}
        className="vlt-input pl-9 text-right font-mono"
        value={moneyDigits(value)}
        onChange={(e) => onChange(centsFromTyping(e.target.value))}
        placeholder={placeholder}
        inputMode="numeric"
      />
    </div>
  );
}
