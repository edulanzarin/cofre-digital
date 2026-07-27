"use client";

import { useState } from "react";
import {
  BellRing,
  ShieldCheck,
  Paintbrush,
  KeyRound,
  Lock,
  FolderCog,
  FolderSearch,
} from "lucide-react";
import Switch from "@/components/ui/Switch";
import FolderPicker from "@/components/settings/FolderPicker";
import { setSetting, useSettings } from "@/lib/settings";
import { setTheme, useTheme } from "@/lib/theme";
import { useMe } from "@/lib/useMe";
import { toast, toastError } from "@/lib/toast";
import {
  lockVault,
  removeVaultPin,
  setStorageRoot,
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
        "Permissão negada pelo navegador. Libere as notificações do site para ativar.",
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
              description="Avisa sobre certificados vencendo ao abrir o cofre."
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
            subtitle="Regras válidas para todos os setores."
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
              description="Pede confirmação extra ao exibir uma senha."
              checked={settings.confirmReveal}
              onChange={(v) => setSetting("confirmReveal", v)}
            />
          </Section>
        )}

        {/* Armazenamento de arquivos — política global, só admin */}
        {editor && (
          <Section
            icon={<FolderCog className="size-4" />}
            title="Armazenamento de arquivos"
            subtitle="Onde os arquivos ficam guardados (certificados, alvarás e imagens)."
            delay="150ms"
          >
            <StorageManager
              storageRoot={vault.storageRoot}
              unlockable={vault.storageUnlockable}
            />
          </Section>
        )}

        {/* Aparência */}
        <Section
          icon={<Paintbrush className="size-4" />}
          title="Aparência"
          subtitle="Tema da interface."
          delay="210ms"
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
              ? "Bloqueia o cofre para todos de uma vez."
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

// Pasta dos arquivos: há um PADRÃO (env), mas um admin pode navegar a rede e
// trocar (com a senha do servidor). Ao trocar, os arquivos são MOVIDOS da pasta
// antiga para a nova — daí o "Transferindo arquivos…" enquanto salva.
function StorageManager({
  storageRoot,
  unlockable,
}: {
  storageRoot: string | null;
  unlockable: boolean;
}) {
  const [pending, setPending] = useState<string | null>(null); // pasta escolhida
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [picking, setPicking] = useState(false);

  const editing = pending !== null;

  async function save() {
    if (pending === null || !password) return;
    setSaving(true);
    try {
      const { moved, failed } = await setStorageRoot(pending, password);
      setPending(null);
      setPassword("");
      toast.success(
        failed > 0
          ? `Pasta alterada. ${moved} arquivo(s) movido(s), ${failed} falharam.`
          : moved > 0
            ? `Pasta alterada e ${moved} arquivo(s) transferido(s).`
            : "Pasta alterada.",
      );
    } catch (err) {
      toastError(err, "Não foi possível alterar a pasta.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="py-3.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">Pasta dos arquivos</p>
          {storageRoot ? (
            <p className="mt-0.5 truncate font-mono text-xs text-ink-2">{storageRoot}</p>
          ) : (
            <p className="mt-0.5 text-xs text-ink-3">
              Os arquivos ficam guardados no próprio sistema.
            </p>
          )}
          <p className="mt-1 text-xs text-ink-3">
            Os arquivos são gravados direto nesse destino.
          </p>
        </div>
        {!editing && unlockable && (
          <button
            onClick={() => setPicking(true)}
            className="vlt-btn vlt-btn-ghost !px-3 !py-1.5 text-xs"
          >
            <FolderSearch className="size-3.5" />
            Alterar pasta
          </button>
        )}
      </div>

      {!unlockable && (
        <p className="mt-2 text-xs text-ink-3">
          A alteração da pasta não está liberada nesta instalação.
        </p>
      )}

      {editing && (
        <div className="mt-3 space-y-2">
          <div>
            <span className="mb-1 block text-xs text-ink-3">Nova pasta</span>
            <p className="truncate rounded-lg border border-line bg-panel-2 px-3 py-2 font-mono text-xs">
              {pending || "(raiz)"}
            </p>
          </div>
          <label className="block">
            <span className="mb-1 block text-xs text-ink-3">Senha de segurança</span>
            <input
              type="password"
              value={password}
              autoFocus
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && save()}
              placeholder="Senha"
              className="vlt-input font-mono"
            />
          </label>
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={!password || saving}
              className="vlt-btn vlt-btn-primary !px-3 !py-1.5 text-xs"
            >
              {saving ? "Transferindo arquivos…" : "Salvar e transferir"}
            </button>
            <button
              onClick={() => setPicking(true)}
              disabled={saving}
              className="vlt-btn vlt-btn-ghost !px-3 !py-1.5 text-xs"
            >
              Escolher outra
            </button>
            <button
              onClick={() => {
                setPending(null);
                setPassword("");
              }}
              disabled={saving}
              className="vlt-btn vlt-btn-ghost !px-3 !py-1.5 text-xs"
            >
              Cancelar
            </button>
          </div>
          <p className="text-[0.7rem] text-ink-3">
            Ao salvar, os arquivos existentes são movidos para a nova pasta.
          </p>
        </div>
      )}

      {picking && (
        <FolderPicker
          initialPath={pending || undefined}
          onPick={(p) => {
            setPending(p);
            setPicking(false);
          }}
          onClose={() => setPicking(false)}
        />
      )}
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
