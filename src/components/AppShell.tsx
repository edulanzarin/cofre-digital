"use client";

import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import LockGuard from "./LockGuard";
import Toaster from "./ui/Toaster";

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
      <main className="min-h-dvh pl-60 max-lg:pl-16">
        <div className="mx-auto w-full max-w-[1720px] px-6 py-8 lg:px-12">
          {children}
        </div>
      </main>
    </>
  );
}
