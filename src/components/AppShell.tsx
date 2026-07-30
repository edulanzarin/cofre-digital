"use client";

import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import LockGuard from "./LockGuard";
import Toaster from "./ui/Toaster";

// Telas de lista rolam por dentro (ver ListShell): cabeçalho e filtros ficam
// fixos e só a tabela rola. Elas recebem o quadro de altura fixa direto, sem o
// wrapper rolável. As demais telas (visão geral, detalhe, configurações, equipe)
// continuam rolando a página inteira. Casa por rota exata: /empresas é lista,
// /empresas/[id] é detalhe.
const LIST_ROUTES = new Set([
  "/certificados",
  "/empresas",
  "/acessos",
  "/alvaras",
]);

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Login não tem sidebar nem cadeado — mas tem toast.
  if (pathname === "/login") {
    return (
      <>
        {children}
        <Toaster />
      </>
    );
  }

  return (
    <>
      <LockGuard />
      <Sidebar />
      <Toaster />
      <main className="flex h-dvh flex-col overflow-hidden pl-60 max-lg:pl-16">
        {LIST_ROUTES.has(pathname) ? (
          children
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-[1720px] px-6 py-8 lg:px-12">
              {children}
            </div>
          </div>
        )}
      </main>
    </>
  );
}
