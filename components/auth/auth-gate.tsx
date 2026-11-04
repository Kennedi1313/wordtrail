"use client";

import { useAuth } from "@/hooks/use-auth";

export function AuthGate() {
  const { ready, signIn, configured, user } = useAuth();
  if (!configured || !ready || user) return null;
  return (
    <div className="auth-gate">
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="brand-mark" aria-hidden="true">
          <img src="/icons/icon.svg" alt="" />
        </div>
        <span className="eyebrow">SEU DIÁRIO DE LEITURA</span>
        <h1 id="auth-title">Seu progresso, em qualquer lugar</h1>
        <p>
          Entre com Google para sincronizar palavras, sessões e revisões entre
          seu computador e celular.
        </p>
        <button className="button auth-google-button" onClick={signIn}>
          Continuar com Google
        </button>
      </section>
    </div>
  );
}
