"use client";

import { FormEvent, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useWordtrail } from "@/hooks/use-wordtrail";

export function SettingsModal() {
  const { settings, setSettings } = useWordtrail();
  const router = useRouter();
  const pathname = usePathname();
  const [goal, setGoal] = useState(String(settings.dailyGoal));
  function save(event: FormEvent) {
    event.preventDefault();
    const value = Number(goal);
    if (Number.isInteger(value) && value >= 1 && value <= 1440)
      setSettings({ dailyGoal: value });
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
          <p className="modal-note">
            Por enquanto, palavras e progresso ficam salvos neste navegador.
            Configure o Supabase para sincronizar entre dispositivos. APIs
            públicas podem ter limites ou indisponibilidade.
          </p>
          <div className="form-actions">
            <button className="button" type="submit">
              Salvar configurações
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
