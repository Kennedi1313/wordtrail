"use client";

import { FormEvent, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useWordtrail } from "@/hooks/use-wordtrail";

export function SettingsModal() {
  const { settings, setSettings } = useWordtrail();
  const router = useRouter();
  const pathname = usePathname();
  const [goal, setGoal] = useState(String(settings.dailyGoal));
  const [saved, setSaved] = useState(false);
  async function save(event: FormEvent) {
    event.preventDefault();
    const value = Number(goal);
    if (Number.isInteger(value) && value >= 1 && value <= 1440) {
      try {
        await setSettings({ ...settings, dailyGoal: value });
        setSaved(true);
      } catch {
        setSaved(false);
      }
      window.setTimeout(() => setSaved(false), 2500);
    }
  }
  return (
    <div className="modal-backdrop">
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
      >
        <div className="modal-header">
          <div>
            <span className="eyebrow">SEU CANTINHO</span>
            <h2 id="settings-title">Configurações</h2>
          </div>
          <button
            type="button"
            className="modal-close"
            aria-label="Fechar"
            onClick={() => router.replace(pathname)}
          >
            ×
          </button>
        </div>
        <form onSubmit={save}>
          <label className="input-label" htmlFor="daily-goal-modal">
            Meta diária de leitura (minutos)
          </label>
          <input
            className="field"
            id="daily-goal-modal"
            type="number"
            min="1"
            max="1440"
            value={goal}
            onChange={(event) => setGoal(event.target.value)}
          />
          <label className="input-label" htmlFor="theme-modal">
            Aparência
          </label>
          <select
            className="field"
            id="theme-modal"
            value={settings.theme}
            onChange={(event) =>
              setSettings({ ...settings,
                theme: event.target.value as "system" | "light" | "dark",
              })
            }
          >
            <option value="system">Usar preferência do sistema</option>
            <option value="light">Claro</option>
            <option value="dark">Escuro</option>
          </select>
          <p className="modal-note">
            Palavras, sessões e progresso são salvos diretamente no servidor.
            Se a conexão cair, a alteração não será aplicada.
          </p>
          <div className="form-actions">
            <button className="button" type="submit">
              Salvar configurações
            </button>
          </div>
        </form>
        <div className={`toast ${saved ? "show" : ""}`} role="status" aria-live="polite">
          Configurações salvas.
        </div>
      </section>
    </div>
  );
}
