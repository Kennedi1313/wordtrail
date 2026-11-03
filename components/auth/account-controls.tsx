"use client";
import { useAuth } from "@/hooks/use-auth";
export function AccountControls() {
  const { user, ready, signIn, signOut, configured } = useAuth();
  if (!configured)
    return (
      <div className="sidebar-account-note">
        <span className="account-avatar" aria-hidden="true">
          W
        </span>
        <span>Salvo neste navegador</span>
      </div>
    );
  if (!ready) return <small>Conectando…</small>;
  return user ? (
    <div className="sidebar-account-info">
      <span className="account-avatar" aria-hidden="true">
        G
      </span>
      <span className="account-email" title={user.email || "Conta Google"}>
        {user.email || "Conta Google"}
      </span>
      <button
        className="button outline small"
        onClick={signOut}
        aria-label="Sair da conta"
        title="Sair da conta"
      >
        Sair
      </button>
    </div>
  ) : (
    <button className="button outline sidebar-sign-in" onClick={signIn}>
      Entrar com Google
    </button>
  );
}
