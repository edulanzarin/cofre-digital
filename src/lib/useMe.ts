"use client";

import { useCallback, useEffect, useState } from "react";
import type { SectorKey } from "./sectors";
import {
  allows,
  type Level,
  type ModuleKey,
  type PermissionRules,
} from "./permissions";

export type Me = {
  name: string;
  email: string;
  sector: SectorKey;
  admin: boolean;
  rules: PermissionRules;
};

// Cache de módulo: /api/me é buscado uma vez por carregamento de página.
let cached: Me | null = null;
let inflight: Promise<Me | null> | null = null;

function load(): Promise<Me | null> {
  inflight ??= fetch("/api/me")
    .then((r) => (r.ok ? (r.json() as Promise<Me>) : null))
    .then((me) => {
      cached = me;
      return me;
    })
    .catch(() => null);
  return inflight;
}

export function useMe() {
  const [me, setMe] = useState<Me | null>(cached);

  useEffect(() => {
    if (cached) return;
    let active = true;
    load().then((m) => {
      if (active && m) setMe(m);
    });
    return () => {
      active = false;
    };
  }, []);

  const can = useCallback(
    (module: ModuleKey, min: Level = "view") => allows(me, module, min),
    [me],
  );

  return { me, admin: me?.admin ?? false, can };
}

export async function logout() {
  await fetch("/api/auth/logout", { method: "POST" });
  cached = null;
  inflight = null;
  window.location.href = "/login";
}
