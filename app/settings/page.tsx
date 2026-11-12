"use client";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useWordtrail } from "@/hooks/use-wordtrail";
export default function Page() {
  const { settings, setSettings, ready } = useWordtrail();
  const [goal, setGoal] = useState(String(settings.dailyGoal));
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  useEffect(() => {
    if (ready) setGoal(String(settings.dailyGoal));
  }, [ready, settings.dailyGoal]);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const dailyGoal = Number(goal);
    if (!Number.isInteger(dailyGoal) || dailyGoal < 1 || dailyGoal > 1440) return;
    setSaving(true);
    try {
      await setSettings({ ...settings, dailyGoal });
      router.push("/");
    } catch {
      // AppShell displays the server error and keeps this form available.
    } finally {
      setSaving(false);
    }
  }
  return (
    <section
      className="modal-backdrop"
      style={{ position: "relative", minHeight: "calc(100vh - 120px)" }}
    >
      <form
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onSubmit={save}
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
          value={goal}
          onChange={(event) => setGoal(event.target.value)}
        />
        <p className="modal-note">
          Palavras, sessões e progresso são salvos diretamente no servidor.
          Se a conexão cair, a alteração não será aplicada.
        </p>
        <div className="form-actions">
          <button type="submit" className="button" disabled={!ready || saving}>
            {saving ? "Salvando no servidor…" : "Salvar configurações"}
          </button>
        </div>
      </form>
    </section>
  );
}
