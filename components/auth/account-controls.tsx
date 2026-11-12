"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
export function AccountControls() {
  const [mounted, setMounted] = useState(false);
  const { user, ready, signIn, signOut, configured } = useAuth();
  useEffect(() => setMounted(true), []);
  if (!configured)
    return (
      <div className="sidebar-account-note">
        <span className="account-avatar" aria-hidden="true">
          W
        </span>
        <span>Servidor indisponível</span>
      </div>
    );
  if (!mounted || !ready) return <small>Conectando…</small>;
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
