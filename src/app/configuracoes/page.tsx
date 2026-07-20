"use client";

import { useState } from "react";
import { BellRing, ShieldCheck, Paintbrush, KeyRound, Lock } from "lucide-react";
import Switch from "@/components/ui/Switch";
import { setSetting, useSettings } from "@/lib/settings";
import { setTheme, useTheme } from "@/lib/theme";
import { useMe } from "@/lib/useMe";
import { toast, toastError } from "@/lib/toast";
import {
  lockVault,
  removeVaultPin,
  setVaultPin,
  updateVaultPolicy,
  useVaultConfig,
} from "@/lib/vaultConfig";

export default function SettingsPage() {
  const settings = useSettings();
  const theme = useTheme();
  const { admin: editor } = useMe();
  const vault = useVaultConfig();
  const [notifyHint, setNotifyHint] = useState("");

  async function toggleNotifications(on: boolean) {
    if (!on) {
      setSetting("notifyBrowser", false);
      setNotifyHint("");
      return;
    }
    if (typeof Notification === "undefined") {
      setNotifyHint("Este navegador não suporta notificações.");
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      setSetting("notifyBrowser", true);
      setNotifyHint("");
    } else {
      setNotifyHint(
        "Permissão negada pelo navegador — libere as notificações do site para ativar.",
      );
    }
  }

  function policy(patch: Parameters<typeof updateVaultPolicy>[0]) {
    updateVaultPolicy(patch).catch(() =>
      toast.error("Falha ao salvar a política do cofre."),
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <header className="anim-fade-up mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
        <p className="mt-1 text-sm text-ink-2">
          {editor
            ? "Políticas do cofre (valem para todos) e preferências pessoais."
            : "Preferências pessoais deste navegador."}
        </p>
      </header>

      <div className="space-y-6">
        {/* Alertas */}
        <Section
          icon={<BellRing className="size-4" />}
          title="Alertas de vencimento"
          subtitle={
            editor
              ? "Quando um certificado passa a contar como “vencendo”."
              : "Avisos sobre certificados vencendo."
          }
          delay="60ms"
        >
          {editor && (
            <div className="flex items-center justify-between gap-4 py-3.5">
              <div>
                <p className="text-sm font-medium">Janela de vencimento</p>
                <p className="mt-0.5 text-xs text-ink-3">
                  Vale para o cofre inteiro, para todos os setores.
                </p>
              </div>
              <select
                className="vlt-input !w-32"
                value={vault.alertDays}
                onChange={(e) => policy({ alertDays: Number(e.target.value) })}
              >
                <option value={15}>15 dias</option>
                <option value={30}>30 dias</option>
                <option value={45}>45 dias</option>
                <option value={60}>60 dias</option>
                <option value={90}>90 dias</option>
              </select>
            </div>
          )}
          <div>
            <Switch
              label="Notificações do navegador"
              description="Ao abrir o cofre, avisa se houver certificados vencendo ou vencidos (no máximo uma vez por dia)."
              checked={settings.notifyBrowser}
              onChange={toggleNotifications}
            />
            {notifyHint && (
              <p className="-mt-1 pb-3 text-xs text-warn">{notifyHint}</p>
            )}
          </div>
        </Section>

        {/* Segurança — política global, só admin */}
        {editor && (
          <Section
            icon={<ShieldCheck className="size-4" />}
            title="Segurança do cofre"
            subtitle="Bloqueio geral e política de inatividade — vale para todos."
            delay="120ms"
          >
            <PinManager hasPin={vault.hasPin} />
            <Switch
              label="Sair por inatividade"
              description="Desconecta qualquer usuário que ficar sem usar o cofre."
              checked={vault.autoLock}
              onChange={(v) => policy({ autoLock: v })}
            />
            {vault.autoLock && (
              <div className="flex items-center justify-between gap-4 py-3.5">
                <div>
                  <p className="text-sm font-medium">Tempo de inatividade</p>
                  <p className="mt-0.5 text-xs text-ink-3">
                    Quanto tempo sem uso até desconectar.
                  </p>
                </div>
                <select
                  className="vlt-input !w-32"
                  value={vault.lockMinutes}
                  onChange={(e) => policy({ lockMinutes: Number(e.target.value) })}
                >
                  <option value={5}>5 min</option>
                  <option value={15}>15 min</option>
                  <option value={30}>30 min</option>
                  <option value={60}>1 hora</option>
                </select>
              </div>
            )}
            <Switch
              label="Confirmar antes de revelar"
              description="Pedir confirmação extra ao exibir uma senha (preferência sua)."
              checked={settings.confirmReveal}
              onChange={(v) => setSetting("confirmReveal", v)}
            />
          </Section>
        )}

        {/* Aparência */}
        <Section
          icon={<Paintbrush className="size-4" />}
          title="Aparência"
          subtitle="O cofre nasceu para o modo noturno, mas você escolhe."
          delay="180ms"
        >
          <div className="flex items-center justify-between gap-4 py-3.5">
            <div>
              <p className="text-sm font-medium">Tema</p>
              <p className="mt-0.5 text-xs text-ink-3">
                Aplicado na hora, salvo neste navegador.
              </p>
            </div>
            <div className="vlt-segment">
              <button data-active={theme === "dark"} onClick={() => setTheme("dark")}>
                Noturno
              </button>
              <button data-active={theme === "light"} onClick={() => setTheme("light")}>
                Claro
              </button>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}

function PinManager({ hasPin }: { hasPin: boolean }) {
  const [editing, setEditing] = useState(false);
  const [pin, setPinValue] = useState("");
  const [saved, setSaved] = useState(false);

  async function save() {
    if (pin.length < 4) return;
    try {
      await setVaultPin(pin);
      setPinValue("");
      setEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      toastError(err, "Falha ao salvar o PIN.");
    }
  }

  return (
    <div className="py-3.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">PIN de bloqueio</p>
          <p className="mt-0.5 text-xs text-ink-3">
            {hasPin
              ? "Bloqueou, travou para todos — útil para alterações em massa."
              : "Necessário para bloquear o cofre para todos."}
          </p>
        </div>
        {!editing && (
          <div className="flex gap-2">
            {hasPin && (
              <>
                <button
                  onClick={() =>
                    lockVault().catch(() =>
                      toast.error("Falha ao bloquear o cofre."),
                    )
                  }
                  className="vlt-btn vlt-btn-ghost !px-3 !py-1.5 text-xs"
                >
                  <Lock className="size-3.5" />
                  Bloquear agora
                </button>
                <button
                  onClick={() =>
                    removeVaultPin().catch(() =>
                      toast.error("Falha ao remover o PIN."),
                    )
                  }
                  className="vlt-btn vlt-btn-danger !px-3 !py-1.5 text-xs"
                >
                  Remover
                </button>
              </>
            )}
            <button
              onClick={() => setEditing(true)}
              className="vlt-btn vlt-btn-ghost !px-3 !py-1.5 text-xs"
            >
              <KeyRound className="size-3.5" />
              {hasPin ? "Alterar" : "Definir PIN"}
            </button>
          </div>
        )}
      </div>

      {editing && (
        <div className="mt-3 flex items-center gap-2">
          <input
            type="password"
            inputMode="numeric"
            autoFocus
            value={pin}
            onChange={(e) => setPinValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
            placeholder="Mínimo 4 dígitos"
            className="vlt-input !w-48 font-mono tracking-widest"
          />
          <button
            onClick={save}
            disabled={pin.length < 4}
            className="vlt-btn vlt-btn-primary !px-3 !py-1.5 text-xs"
          >
            Salvar
          </button>
          <button
            onClick={() => {
              setEditing(false);
              setPinValue("");
            }}
            className="vlt-btn vlt-btn-ghost !px-3 !py-1.5 text-xs"
          >
            Cancelar
          </button>
        </div>
      )}

      {saved && <p className="mt-2 text-xs text-ok">PIN salvo.</p>}
    </div>
  );
}

function Section({
  icon,
  title,
  subtitle,
  delay,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  delay: string;
  children: React.ReactNode;
}) {
  return (
    <section className="vlt-card anim-fade-up" style={{ animationDelay: delay }}>
      <div className="flex items-center gap-3 border-b border-line px-6 py-4">
        <span className="flex size-8 items-center justify-center rounded-lg bg-brand-soft text-brand">
          {icon}
        </span>
        <div>
          <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
          <p className="text-xs text-ink-3">{subtitle}</p>
        </div>
      </div>
      <div className="divide-y divide-line px-6 py-1">{children}</div>
    </section>
  );
}
