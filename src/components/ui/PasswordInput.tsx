"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

// Campo de senha com botão de revelar (olhinho). Controlado, aceita os mesmos
// props de um <input> — inclusive `ref` e `onKeyDown`. O botão não entra no tab
// nem submete o formulário (type="button"), então serve dentro e fora de forms.
export default function PasswordInput({
  className = "",
  ref,
  ...props
}: React.ComponentPropsWithRef<"input">) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        {...props}
        ref={ref}
        type={show ? "text" : "password"}
        className={`vlt-input pr-9 ${className}`}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShow((s) => !s)}
        title={show ? "Ocultar senha" : "Mostrar senha"}
        className="vlt-icon-btn absolute top-1/2 right-1 -translate-y-1/2"
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}
