"use client";

import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import LockGuard from "./LockGuard";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Login não tem sidebar nem cadeado.
  if (pathname === "/login") {
    return <>{children}</>;
  }

  return (
    <>
      <LockGuard />
      <Sidebar />
      <main className="min-h-dvh pl-60 max-lg:pl-16">
        <div className="mx-auto w-full max-w-[1720px] px-6 py-8 lg:px-12">
          {children}
        </div>
      </main>
    </>
  );
}
