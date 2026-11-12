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
import { readingGoalStreak } from "@/services/reading-stats";
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
  const navigate = (href: string) => {
    setMenuOpen(false);
    setNavigating(href.split("?")[0] !== pathname);
  };
  const searchParams = useSearchParams();
  const { state, settings, ready, syncError, syncPending, userId } = useWordtrail();
  const readingDays = hydrated && ready
    ? readingGoalStreak(
        state.readingSessions,
        state.activeReadingSession,
        settings.dailyGoal,
      )
    : 0;
  return (
    <div
      className={`app-shell${hydrated && syncPending ? " is-syncing" : ""}`}
      aria-busy={hydrated && (syncPending || (!ready && Boolean(userId)))}
    >
      {hydrated && ((!ready && userId) || syncPending) ? (
        <div className="server-sync-indicator" role="status" aria-live="polite">
          <span className="loading-spinner" aria-hidden="true" />
          <span>{!ready ? "Carregando seus dados…" : "Salvando no servidor…"}</span>
        </div>
      ) : null}
      <aside className={`sidebar${menuOpen ? " open" : ""}`} id="app-sidebar">
        <div className="sidebar-header">
          <Link
            className="brand"
            href="/"
            aria-label="Wordtrail início"
            onClick={() => navigate("/")}
          >
            <span className="brand-mark">
              <img src="/icons/icon.svg" alt="" />
            </span>
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
            onClick={() => navigate("/")}
          >
            <NavIcon name="home" /> Visão geral
          </Link>
          <Link
            className={`nav-link ${pathname === "/reading" ? "active" : ""}`}
            href="/reading"
            onClick={() => navigate("/reading")}
          >
            <NavIcon name="reading" /> Sessão de leitura
          </Link>
          <Link
            className={`nav-link ${pathname === "/practice" ? "active" : ""}`}
            href="/practice"
            onClick={() => navigate("/practice")}
          >
            <NavIcon name="practice" /> Hora do jogo{" "}
          </Link>
          <Link
            className={`nav-link ${pathname === "/vocabulary" ? "active" : ""}`}
            href="/vocabulary"
            onClick={() => navigate("/vocabulary")}
          >
            <NavIcon name="vocabulary" /> Meu vocabulário
          </Link>
          <Link
            className={`nav-link ${pathname === "/books" ? "active" : ""}`}
            href="/books"
            onClick={() => navigate("/books")}
          >
            <NavIcon name="books" /> Meus livros
          </Link>
          <Link
            className={`nav-link ${pathname === "/clubs" ? "active" : ""}`}
            href="/clubs"
            onClick={() => navigate("/clubs")}
          >
            <NavIcon name="clubs" /> Clubes do livro
          </Link>
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-account">
            <AccountControls />
          </div>
        </div>
      </aside>
      <main className="main-area">
        <header className="mobile-header">
          <Link className="brand" href="/" onClick={() => navigate("/")}>
            <span className="brand-mark">
              <img src="/icons/icon.svg" alt="" />
            </span>
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
              <Link
                className="topbar-streak"
                href="/reading"
                aria-label={`${readingDays} dias consecutivos com a meta de leitura atingida`}
                title="Dias consecutivos batendo sua meta de leitura"
              >
                <span>🔥</span>
                <strong suppressHydrationWarning>
                  {ready ? readingDays : 0}
                </strong>
              </Link>
            </div>
          </header>
          <div className="view-content">{children}</div>
          {syncError && (
            <div className="sync-error" role="alert">
              Não foi possível salvar no servidor. Nenhuma alteração local foi aplicada.
            </div>
          )}
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
