"use client";

import Link from "next/link";
import { ReactNode } from "react";
import { AccountControls } from "@/components/auth/account-controls";
import { usePathname } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { SettingsModal } from "@/components/settings/settings-modal";
import { useWordtrail } from "@/hooks/use-wordtrail";
import { AuthGate } from "@/components/auth/auth-gate";
import { useEffect, useState } from "react";
import { NavIcon } from "@/components/ui/nav-icon";
import { Menu, Settings, X } from "lucide-react";

export function AppShell({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const date = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
  const pathname = usePathname();
  useEffect(() => setNavigating(false), [pathname]);
  useEffect(() => setHydrated(true), []);
  const navigate = () => {
    setMenuOpen(false);
    setNavigating(true);
  };
  const searchParams = useSearchParams();
  const { state, settings, ready } = useWordtrail();
  const today = new Date().toISOString().slice(0, 10);
  const todayMinutes =
    hydrated && ready
      ? Math.floor(
          state.readingSessions
            .filter((session) => session.date === today)
            .reduce((total, session) => total + (session.seconds || 0), 0) / 60,
        )
      : 0;
  const readingDays = hydrated
    ? new Set(
        state.readingSessions.map((session) => session.date).filter(Boolean),
      ).size
    : 0;
  const dailyGoal = hydrated ? settings.dailyGoal : 30;
  return (
    <div className="app-shell">
      <aside className={`sidebar${menuOpen ? " open" : ""}`} id="app-sidebar">
        <div className="sidebar-header">
          <Link
            className="brand"
            href="/"
            aria-label="Wordtrail início"
            onClick={navigate}
          >
            <span className="brand-mark">w</span>
            <span>
              wordtrail<small>read a little. grow a lot.</small>
            </span>
          </Link>
          <div className="sidebar-header-actions">
            <Link
              className="settings-button"
              href={`${pathname}?settings=1`}
              aria-label="Configurações"
              title="Configurações"
              onClick={() => setMenuOpen(false)}
            >
              <Settings aria-hidden="true" />
            </Link>
            <button
              className="icon-button sidebar-close"
              aria-label="Fechar menu"
              onClick={() => setMenuOpen(false)}
            >
              <X aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="sidebar-label">SEU ESPAÇO</div>
        <nav className="main-nav" aria-label="Navegação principal">
          <Link
            className={`nav-link ${pathname === "/" ? "active" : ""}`}
            href="/"
            onClick={navigate}
          >
            <NavIcon name="home" /> Visão geral
          </Link>
          <Link
            className={`nav-link ${pathname === "/reading" ? "active" : ""}`}
            href="/reading"
            onClick={navigate}
          >
            <NavIcon name="reading" /> Sessão de leitura
          </Link>
          <Link
            className={`nav-link ${pathname === "/practice" ? "active" : ""}`}
            href="/practice"
            onClick={navigate}
          >
            <NavIcon name="practice" /> Hora do jogo{" "}
          </Link>
          <Link
            className={`nav-link ${pathname === "/vocabulary" ? "active" : ""}`}
            href="/vocabulary"
            onClick={navigate}
          >
            <NavIcon name="vocabulary" /> Meu vocabulário
          </Link>
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <p>Uma página de cada vez.</p>
            <div className="note-progress">
              <span
                style={{
                  width: `${Math.min(100, (todayMinutes / dailyGoal) * 100)}%`,
                }}
              />
            </div>
            <small>
              {todayMinutes} de {dailyGoal} min hoje
            </small>
          </div>
          <div className="sidebar-account">
            <AccountControls />
          </div>
        </div>
      </aside>
      <main className="main-area">
        <header className="mobile-header">
          <Link className="brand" href="/" onClick={navigate}>
            <span className="brand-mark">w</span>
          </Link>
          <button
            className="icon-button mobile-menu"
            aria-label="Abrir menu"
            onClick={() => setMenuOpen(true)}
          >
            <Menu aria-hidden="true" />
          </button>
        </header>
        <div className="main-scroll">
          <header className="topbar">
            <div>
              <span className="date-label" suppressHydrationWarning>
                {date}
              </span>
            </div>
            <div className="topbar-actions">
              <Link className="topbar-streak" href="/reading">
                <span>🔥</span>
                <strong suppressHydrationWarning>
                  {ready ? readingDays : 0}
                </strong>
              </Link>
            </div>
          </header>
          <div className="view-content">{children}</div>
        </div>
      </main>
      {searchParams.get("settings") === "1" && <SettingsModal />}
      <AuthGate />
      {navigating && (
        <div
          className="navigation-loading"
          role="status"
          aria-label="Carregando"
        >
          <span className="loading-spinner" />
        </div>
      )}
    </div>
  );
}
