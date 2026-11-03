"use client";
import { useWordtrail } from "@/hooks/use-wordtrail";
export default function Page() {
  const { settings, setSettings, ready } = useWordtrail();
  return (
    <section
      className="modal-backdrop"
      style={{ position: "relative", minHeight: "calc(100vh - 120px)" }}
    >
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
          <a className="modal-close" href="/" aria-label="Fechar">
            ×
          </a>
        </div>
        <label className="input-label" htmlFor="daily-goal">
          Meta diária de leitura (minutos)
        </label>
        <input
          className="field"
          id="daily-goal"
          type="number"
          min="1"
          max="1440"
          value={ready ? settings.dailyGoal : 30}
          onChange={(event) =>
            setSettings({ dailyGoal: Math.max(1, Number(event.target.value)) })
          }
        />
        <p className="modal-note">
          Por enquanto, palavras e progresso ficam salvos neste navegador.
          Configure o Supabase para sincronizar entre dispositivos. APIs
          públicas podem ter limites ou indisponibilidade.
        </p>
        <div className="form-actions">
          <a className="button" href="/">
            Salvar configurações
          </a>
        </div>
      </section>
    </section>
  );
}
