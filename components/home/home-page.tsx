"use client";

import Link from "next/link";
import { useWordtrail } from "@/hooks/use-wordtrail";
import { WordCountBadge } from "@/components/shared/stat-cards";
import { Clock3 } from "lucide-react";

export function HomePage() {
  const { state, settings, ready } = useWordtrail();
  const words = ready ? state.words : [];
  const lookupCount = words.reduce((sum, word) => sum + word.lookups, 0);
  const today = new Date().toISOString().slice(0, 10);
  const todayMinutes = Math.floor(
    state.readingSessions
      .filter((session) => session.date === today)
      .reduce((total, session) => total + (session.seconds || 0), 0) / 60,
  );
  const readingDays = new Set(
    state.readingSessions.map((session) => session.date).filter(Boolean),
  ).size;
  return (
    <>
      <section className="page-intro">
        <span className="eyebrow">SEU DIÁRIO DE LEITURA</span>
        <h1>Oi, que bom te ver por aqui</h1>
        <p>
          Um cantinho pra acompanhar suas leituras e guardar cada palavra nova.
        </p>
      </section>
      <section className="home-grid">
        <div className="hero-card">
          <div className="hero-copy">
            <span className="eyebrow">UM PASSINHO DE CADA VEZ</span>
            <h2>Pronta pra começar a leitura?</h2>
            <p>
              Inicie uma sessão, leia no seu ritmo e pesquise palavras sem
              perder o fio.
            </p>
          </div>
        </div>
        <div className="goal-card">
          <div className="goal-head">
            <div>
              <h3>Sua meta de leitura</h3>
            </div>
            <span className="goal-icon" aria-hidden="true">
              <Clock3 />
            </span>
          </div>
          <div className="goal-meter">
            <div
              className="ring"
              style={
                {
                  "--progress": `${Math.min(100, (todayMinutes / settings.dailyGoal) * 100)}%`,
                } as React.CSSProperties
              }
            >
              <span>
                {Math.round(
                  Math.min(100, (todayMinutes / settings.dailyGoal) * 100),
                )}
                %
              </span>
            </div>
            <div className="goal-copy">
              <strong>
                {todayMinutes} <small>min</small>
              </strong>
              <small>de {settings.dailyGoal} min hoje</small>
            </div>
          </div>
          <div className="goal-bottom">
            <span />
            <Link className="text-button" href="/reading">
              Registrar +
            </Link>
          </div>
        </div>
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
          <small>dias lendo em sequência</small>
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
            {words.length ? (
              words.slice(0, 5).map((word) => (
                <div className="word-row" key={word.normalized}>
                  <div className="word-meta">
                    <strong>{word.term}</strong>
                    <small>
                      {word.translation || "Tradução não encontrada"}
                    </small>
                  </div>
                  <WordCountBadge count={word.lookups} />
                </div>
              ))
            ) : (
              <div className="empty-state">
                <strong>Sua primeira palavra começa aqui</strong>
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
            {state.readingSessions.length ? (
              <div className="activity-list">
                {words.slice(0, 2).map((word) => (
                  <div className="activity-item" key={word.normalized}>
                    <span className="activity-dot" />
                    <div>
                      <strong>Você pesquisou {word.term}</strong>
                      <small>
                        {word.translation || "Tradução indisponível"} ·{" "}
                        {word.lookups} consulta{word.lookups === 1 ? "" : "s"}
                      </small>
                    </div>
                  </div>
                ))}
                <div className="activity-item">
                  <span className="activity-dot" />
                  <div>
                    <strong>
                      {todayMinutes} min · {state.readingSessions[0].pages || 0}{" "}
                      páginas de leitura
                    </strong>
                    <small>
                      {new Date(
                        state.readingSessions[0].createdAt ||
                          state.readingSessions[0].startedAt,
                      ).toLocaleDateString("pt-BR", {
                        day: "numeric",
                        month: "long",
                      })}
                    </small>
                  </div>
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <strong>Tudo começa na próxima página</strong>
                Sua atividade vai aparecer aqui assim que você começar.
              </div>
            )}
          </div>
        </div>
      </section>
      <section className="section-heading game-section-heading">
        <div>
          <h2>Uma pausa de cinco minutinhos?</h2>
          <p>Relembre palavras enquanto elas ainda estão fresquinhas.</p>
        </div>
        <Link className="button" href="/practice">
          Começar jogo →
        </Link>
      </section>
    </>
  );
}
