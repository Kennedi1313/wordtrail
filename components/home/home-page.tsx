"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useWordtrail } from "@/hooks/use-wordtrail";
import { WordCountBadge } from "@/components/shared/stat-cards";
import { GoalCard } from "@/components/shared/goal-card";
import { StartCard } from "@/components/shared/start-card";
import { localReadingDate, readingGoalStreak, readingMinutesByDate } from "@/services/reading-stats";

export function HomePage() {
  const { state, settings, ready } = useWordtrail();
  const words = useMemo(() => {
    if (!ready) return [];
    const unique = new Map<string, (typeof state.words)[number]>();
    state.words.forEach((word) => {
      const key = word.normalized.trim().toLowerCase() || word.term.trim().toLowerCase();
      if (!unique.has(key)) unique.set(key, word);
    });
    return [...unique.values()];
  }, [ready, state.words]);
  const lookupCount = words.reduce((sum, word) => sum + word.lookups, 0);
  const now = Date.now();
  const today = localReadingDate(now);
  const minutesByDate = readingMinutesByDate(
    state.readingSessions,
    state.activeReadingSession,
    now,
  );
  const todayMinutes = minutesByDate.get(today) || 0;
  const readingDays = readingGoalStreak(
    state.readingSessions,
    state.activeReadingSession,
    settings.dailyGoal,
    now,
  );
  const recentActivity = useMemo(() => {
    if (!ready) return [];
    const definitions = new Map(
      words.map((word) => [word.normalized.trim().toLowerCase(), word.definition]),
    );
    const sessions = [
      ...state.readingSessions,
      ...(state.activeReadingSession ? [state.activeReadingSession] : []),
    ];
    const lookups = sessions.flatMap((session) =>
      (session.lookups || []).map((lookup) => ({
        kind: "lookup" as const,
        at: lookup.at,
        term: lookup.term,
        definition:
          lookup.definition || definitions.get(lookup.normalized.trim().toLowerCase()),
      })),
    );
    const latestLookups = [...lookups]
      .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
      .slice(0, 2);
    const latestSession = [...state.readingSessions]
      .filter((session) => Boolean(session.endedAt || session.active === false))
      .sort(
        (a, b) =>
          Date.parse(b.endedAt || b.startedAt) -
          Date.parse(a.endedAt || a.startedAt),
      )[0];
    const items = [
      ...latestLookups,
      ...(latestSession
        ? [
            {
              kind: "session" as const,
              at: latestSession.endedAt || latestSession.startedAt,
              session: latestSession,
            },
          ]
        : []),
    ];
    return items.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  }, [ready, state.activeReadingSession, state.readingSessions, words]);

  return (
    <>
      <section className="page-intro">
        <span className="eyebrow">SEU DIÁRIO DE LEITURA</span>
        <h1>Oi, que bom te ver por aqui</h1>
      </section>
      <section className="home-grid">
        <StartCard
          eyebrow="UM PASSINHO DE CADA VEZ"
          title="Pronta pra começar a leitura?"
          description="Inicie uma sessão, leia no seu ritmo e pesquise palavras sem perder o fio."
          action={
            <Link className="button" href="/reading">
              Começar uma leitura
            </Link>
          }
        />
        <GoalCard
          title="Sua meta de leitura"
          value={todayMinutes}
          total={settings.dailyGoal}
          unit="minutos lidos"
          caption={`de ${settings.dailyGoal} minutos hoje`}
          action={
            <Link className="text-button" href="/reading">
              Registrar +
            </Link>
          }
        />
      </section>
      <section className="stats-row">
        <div className="stat-card stat-card-home">
          <strong className="stat-icon stat-value">{words.length}</strong>
          <small>palavras guardadas</small>
        </div>
        <div className="stat-card stat-card-home">
          <strong className="stat-icon stat-value">{lookupCount}</strong>
          <small>pesquisas feitas</small>
        </div>
        <div className="stat-card stat-card-home">
          <strong className="stat-icon stat-value">
            {ready ? readingDays : 0}
          </strong>
          <small>dias seguidos com a meta batida</small>
        </div>
        <div className="stat-card stat-card-home">
          <strong className="stat-icon stat-value">
            {state.reviews.length}
          </strong>
          <small>revisões concluídas</small>
        </div>
      </section>
      <section className="lower-grid">
        <div>
          <div className="section-heading">
            <div>
              <h2>Palavras que mais aparecem</h2>
              <p>As suas descobertas</p>
            </div>
            <Link className="text-button" href="/vocabulary">
              Ver tudo
            </Link>
          </div>
          <div className="panel">
            {!ready ? (
              <div className="server-data-loading" role="status">
                <span className="loading-spinner" aria-hidden="true" />
                <span>Carregando suas palavras…</span>
              </div>
            ) : words.length ? (
              words.slice(0, 5).map((word) => (
                <div className="word-row" key={word.normalized.trim().toLowerCase() || word.term.trim().toLowerCase()}>
                  <div className="word-meta">
                    <strong>{word.term}</strong>
                    <small>
                      {word.definition || "Definição indisponível"}
                    </small>
                  </div>
                  <WordCountBadge count={word.lookups} />
                </div>
              ))
            ) : (
              <div className="empty-state">
                Pesquise algo que encontrou no livro e seu vocabulário vai
                crescendo.
              </div>
            )}
          </div>
        </div>
        <div>
          <div className="section-heading">
            <div>
              <h2>Seu caminho recente</h2>
              <p>Pequenas conquistas do dia a dia</p>
            </div>
          </div>
          <div className="panel">
            {!ready ? (
              <div className="server-data-loading" role="status">
                <span className="loading-spinner" aria-hidden="true" />
                <span>Carregando sua atividade…</span>
              </div>
            ) : recentActivity.length ? (
              <div className="activity-list">
                {recentActivity.map((item, index) => {
                  const date = new Intl.DateTimeFormat("pt-BR", {
                    timeZone: "America/Fortaleza",
                    day: "numeric",
                    month: "long",
                  }).format(new Date(item.at));
                  return (
                    <div className="activity-item" key={`${item.kind}-${item.at}-${index}`}>
                      <span className="activity-dot" />
                      <div>
                        {item.kind === "lookup" ? (
                          <>
                            <strong>Você pesquisou {item.term}</strong>
                            <small>
                              {item.definition || "Definição indisponível"} · {date}
                            </small>
                          </>
                        ) : (
                          <>
                            <strong>
                              {Math.floor(
                                Math.max(
                                  item.session.seconds || 0,
                                  item.session.durationSeconds || 0,
                                  (item.session.minutes || 0) * 60,
                                ) / 60,
                              )} min · {item.session.pages || 0} páginas de leitura
                            </strong>
                            <small>{date}</small>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="empty-state">
                Sua atividade vai aparecer aqui assim que você começar.
              </div>
            )}
          </div>
        </div>
      </section>
      <section className="section-heading game-section-heading">
        <div>
          <h2>Uma pausa?</h2>
          <p>Relembre palavras enquanto elas ainda estão fresquinhas.</p>
        </div>
        <Link className="button" href="/practice">
          Começar jogo →
        </Link>
      </section>
    </>
  );
}
