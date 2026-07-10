import type { Metadata } from "next";
import "./globals.css";
import AppShell from "@/components/AppShell";

export const metadata: Metadata = {
  title: "Cofre Digital — Navecon",
  description: "Cofre de certificados digitais e acessos da Navecon",
};

// Aplica o tema salvo antes do primeiro paint para evitar flash.
// Escuro é o padrão do cofre; claro só se o usuário escolheu.
const themeScript = `
try {
  var t = localStorage.getItem("vault-theme");
  if (t === "light") document.documentElement.setAttribute("data-theme", "light");
} catch (e) {}
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
