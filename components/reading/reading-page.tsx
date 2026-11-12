"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useReadingSession } from "@/hooks/use-reading-session";
import { useWordtrail } from "@/hooks/use-wordtrail";
import { lookupWord, suggestWords } from "@/services/dictionary-service";
import { Word } from "@/types/domain";
import { ConfirmModal } from "@/components/shared/confirm-modal";
import { WordCountBadge } from "@/components/shared/stat-cards";
import { GoalCard } from "@/components/shared/goal-card";
import { Pause, Play, Search, Square, Trash2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function formatElapsed(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  if (!minutes) return `${remainder} seg`;
  return remainder < 10 ? `${minutes} min` : `${minutes} min ${remainder} seg`;
}

const toLocalDateString = (
  dateInput: string | Date | number | null | undefined,
): string | null => {
  if (!dateInput) return null;

  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return null;

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Fortaleza",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(d);
};

export function ReadingPage() {
  const { state, settings, ready, setState } = useWordtrail();
  const searchParams = useSearchParams();
  const today = toLocalDateString(new Date());
  const todayMinutes = Math.floor(
    state.readingSessions
      .filter((session) => toLocalDateString(session.date) === today)
      .reduce((total, session) => total + (session.seconds || 0), 0) / 60,
  );
  const {
    active,
    elapsed,
    start,
    finish,
    pause,
    continueReading,
    save,
    resume,
    discard,
    remove,
    history,
    trackLookup,
  } = useReadingSession();
  const [term, setTerm] = useState("");
  const [pages, setPages] = useState("");
  const [note, setNote] = useState("");
  const [result, setResult] = useState<Partial<Word> | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [searchError, setSearchError] = useState("");
  const [searching, setSearching] = useState(false);
  const [selectedBookId, setSelectedBookId] = useState(
    () => searchParams.get("book") || "",
  );
  const [confirmAction, setConfirmAction] = useState<"discard" | string | null>(
    null,
  );
  const [bookToDelete, setBookToDelete] = useState<string | null>(null);
  const visibleHistory = ready ? history : [];
  const bookById = useMemo(
    () => new Map(state.books.map((book) => [book.id, book])),
    [state.books],
  );
  const selectedBook = useMemo(
    () => state.books.find((book) => book.id === selectedBookId),
    [selectedBookId, state.books],
  );
  const availableBooks = useMemo(
    () => state.books.filter((book) => book.currentPage < book.totalPages),
    [state.books],
  );
  useEffect(() => {
    if (!availableBooks.some((book) => book.id === selectedBookId)) {
      setSelectedBookId(availableBooks[0]?.id || "");
    }
  }, [availableBooks, selectedBookId]);

  async function startBook(bookId: string) {
    if (bookId) await start(bookId);
  }

  async function deleteBook(bookId: string) {
    await setState((current) => {
      const updatedBooks = current.books.filter((book) => book.id !== bookId);
      return {
        ...current,
        books: updatedBooks,
      };
    });
    if (selectedBookId === bookId) setSelectedBookId("");
  }

  async function search(event: FormEvent, requestedTerm = term) {
    event.preventDefault();
    setSearchError("");
    const inputTerm = requestedTerm.trim().replace(/\s+/g, " ");
    if (!inputTerm) return;
    setTerm("");
    setResult(null);
    setSuggestions([]);
    setActiveSuggestionIndex(-1);
    setSearching(true);
    try {
      const dictionary = (await lookupWord(inputTerm)) || {};
      const word = {
        ...dictionary,
        term: dictionary.term || inputTerm,
        normalized: inputTerm.toLowerCase(),
      };
      if (word.term && word.normalized) {
        const saved = {
          ...word,
          term: word.term,
          normalized: word.normalized,
          lookups: 1,
        };
        await trackLookup(saved);
      }
      setResult(word);
    } catch (error) {
      setResult(null);
      setSearchError(
        error instanceof Error
          ? error.message
          : "Não foi possível pesquisar esta palavra agora.",
      );
    } finally {
      setSearching(false);
    }
  }
  async function updateSuggestions(value: string) {
    setTerm(value);
    setActiveSuggestionIndex(-1);
    if (value.trim().length < 2 || /\s/.test(value)) {
      setSuggestions([]);
      return;
    }
    setSuggestions(await suggestWords(value).catch(() => []));
  }

  function chooseSuggestion(suggestion: string) {
    setTerm(suggestion);
    setSuggestions([]);
    setActiveSuggestionIndex(-1);
    void search({ preventDefault() {} } as FormEvent, suggestion);
  }

  if (ready && active?.endedAt) {
    const duration = formatDuration(
      active.durationSeconds || active.seconds || 0,
    );
    const lookupGroups = new Map<
      string,
      { term: string; definition?: string; count: number; wasKnown: boolean }
    >();
    active.lookups.forEach((lookup) => {
      const current = lookupGroups.get(lookup.normalized);
      lookupGroups.set(lookup.normalized, {
        term: current?.term || lookup.term,
        definition: current?.definition || lookup.definition,
        count: (current?.count || 0) + 1,
        wasKnown: Boolean(current?.wasKnown || lookup.wasKnown),
      });
    });
    const lookupSummary = [...lookupGroups.values()];
    return (
      <section>
        <section className="page-intro">
          <span className="eyebrow">SESSÃO FINALIZADA</span>
          <h1>Olha só o que você fez</h1>
          <p suppressHydrationWarning>
            Seu tempo já está registrado. Se quiser, anote também quantas
            páginas leu.
          </p>
        </section>
        <section className="reading-summary-card">
          <div className="reading-summary-top">
            <div>
              <span className="eyebrow">TEMPO DE LEITURA</span>
              <strong>{duration}</strong>
            </div>
            <div>
              <span className="eyebrow">PESQUISAS</span>
              <strong>{active.lookups.length}</strong>
            </div>
            <div>
              <span className="eyebrow">PALAVRAS DIFERENTES</span>
              <strong>
                {new Set(active.lookups.map((item) => item.normalized)).size}
              </strong>
            </div>
          </div>
          {lookupSummary.length ? (
            <div className="session-word-summary">
              <h3>Palavras que apareceram</h3>
              {lookupSummary.map((word) => (
                <div className="summary-word-row" key={word.term}>
                  <span>
                    <strong>{word.term}</strong>
                    <small>{word.definition || "Definição indisponível"}</small>
                  </span>
                  <WordCountBadge count={word.count} />
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              Nenhuma palavra pesquisada nesta sessão — e tudo bem, você leu do
              seu jeito.
            </div>
          )}
          <form
            className="finish-reading-form"
            onSubmit={(event) => {
              event.preventDefault();
              save(Number(pages) || 0, note);
            }}
          >
            <label>
              <span className="input-label">
                Quantas páginas você leu? (opcional)
              </span>
              <input
                className="field"
                type="number"
                min="1"
                max="10000"
                placeholder="ex.: 18"
                value={pages}
                onChange={(event) => setPages(event.target.value)}
              />
            </label>
            <label>
              <span className="input-label">Anotações (opcional)</span>
              <input
                className="field"
                maxLength={240}
                placeholder="ex.: capítulo 4, trecho importante..."
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </label>
            <div className="form-actions">
              <button
                type="button"
                className="button discard-finished-button"
                onClick={() => setConfirmAction("discard")}
              >
                Sair sem salvar
              </button>
              <button type="button" className="button outline" onClick={resume}>
                Continuar lendo
              </button>
              <button type="submit" className="button">
                Salvar sessão
              </button>
            </div>
          </form>
          {confirmAction === "discard" && (
            <ConfirmModal
              title="Sair sem salvar?"
              message="O tempo e as pesquisas desta sessão serão descartados."
              confirmLabel="Sair sem salvar"
              onCancel={() => setConfirmAction(null)}
              onConfirm={() => void discard().then(() => setConfirmAction(null)).catch(() => undefined)}
            />
          )}
        </section>
      </section>
    );
  }

  if (ready && active) {
    return (
      <section>
        <section className="reading-session-head">
          <div>
            <span className="eyebrow">SESSÃO DE LEITURA EM ANDAMENTO</span>
            <h1>Vai no seu ritmo</h1>
            <p>
              Deixa essa tela do lado do seu livro. O cronômetro continua
              enquanto você lê.
            </p>
          </div>
          <div className="reading-session-controls">
            <div className="live-timer">
              <span
                className={`live-timer-copy${active.active === false ? " paused" : ""}`}
              >
                <strong>{formatElapsed(elapsed)}</strong>
                <small>
                  {active.active === false
                    ? "leitura pausada"
                    : "tempo de leitura"}
                </small>
              </span>
            </div>
            <div className="reading-session-actions">
              <button
                className="button outline pause-reading-button"
                onClick={() =>
                  active.active === false ? continueReading() : pause()
                }
                aria-label={
                  active.active === false ? "Retomar leitura" : "Pausar leitura"
                }
                title={
                  active.active === false ? "Retomar leitura" : "Pausar leitura"
                }
              >
                {active.active === false ? <Play /> : <Pause />}
              </button>
              <button
                className="button stop-reading-button"
                onClick={() => finish()}
                aria-label="Finalizar leitura"
                title="Finalizar leitura"
              >
                <Square />
              </button>
            </div>
          </div>
        </section>
        <section className="reading-live-layout">
          <div className="reading-search-column">
            <div className="search-autocomplete">
              <form className="search-box" role="search" onSubmit={search}>
                <input
                  value={term}
                  disabled={searching}
                  onChange={(event) => updateSuggestions(event.target.value)}
                  placeholder="Qual palavra te parou?"
                  aria-label="Palavra em inglês"
                  required
                  onKeyDown={(event) => {
                    if (event.key === "ArrowDown" && suggestions.length) {
                      event.preventDefault();
                      setActiveSuggestionIndex(
                        (current) => (current + 1) % suggestions.length,
                      );
                    }
                    if (event.key === "ArrowUp" && suggestions.length) {
                      event.preventDefault();
                      setActiveSuggestionIndex(
                        (current) =>
                          (current - 1 + suggestions.length) %
                          suggestions.length,
                      );
                    }
                    if (event.key === "Escape") setSuggestions([]);
                    if (event.key === "Enter" && activeSuggestionIndex >= 0) {
                      event.preventDefault();
                      chooseSuggestion(suggestions[activeSuggestionIndex]);
                    }
                  }}
                />
                <button
                  className="button search-submit"
                  type="submit"
                  disabled={searching}
                  aria-label="Pesquisar palavra"
                >
                  {searching ? (
                    <span className="button-spinner" aria-hidden="true" />
                  ) : (
                    <Search aria-hidden="true" />
                  )}
                </button>
              </form>
              {suggestions.length > 0 && (
                <div className="suggestion-list" role="listbox">
                  {suggestions.map((suggestion) => (
                    <button
                      type="button"
                      className="suggestion-option"
                      key={suggestion}
                      onClick={() => chooseSuggestion(suggestion)}
                      aria-selected={
                        suggestions[activeSuggestionIndex] === suggestion
                      }
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div id="search-result">
              {searching && (
                <div className="search-loading" role="status">
                  <span className="loading-spinner" aria-hidden="true" />
                  <span>Pesquisando palavra…</span>
                </div>
              )}
              {searchError && (
                <div className="error-message">{searchError}</div>
              )}
              {result ? (
                <article className="result-card">
                  <div className="result-top">
                    <div>
                      <div className="result-word">{result.term}</div>
                      <div className="pronunciation">
                        {result.phonetic
                          ? `/${result.phonetic}/`
                          : "Pronúncia indisponível"}
                      </div>
                    </div>
                    {result.partOfSpeech && (
                      <span className="pos-tag">{result.partOfSpeech}</span>
                    )}
                  </div>
                  <div className="result-divider" />
                  <div className="result-label">Definição</div>
                  <div className="definition-text">
                    {result.definition ||
                      "Não foi possível carregar a definição agora."}
                  </div>
                  {result.usageLabels?.length ? (
                    <div className="dictionary-detail-row">
                      <span className="result-label">USO</span>
                      <div className="dictionary-tags">
                        {result.usageLabels.map((label) => (
                          <span key={label}>{label}</span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {result.relatedWords?.length ? (
                    <div className="dictionary-detail-row">
                      <span className="result-label">
                        PALAVRAS RELACIONADAS
                      </span>
                      <p className="dictionary-detail-copy">
                        {result.relatedWords.join(", ")}
                      </p>
                    </div>
                  ) : null}
                  {result.examples?.length ? (
                    <div className="dictionary-detail-row">
                      <span className="result-label">EXEMPLOS</span>
                      <div className="dictionary-examples">
                        {result.examples.map((example) => (
                          <p key={example}>{example}</p>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </article>
              ) : (
                <div className="empty-large empty-state">
                  Digite a palavra que encontrou e volte pro livro.
                </div>
              )}
            </div>
          </div>
          <aside className="reading-session-sidebar">
            <div className="panel">
              <div className="side-panel-title">
                <h3>Palavras desta sessão</h3>
                <span className="word-count">
                  {active.lookups.length} pesquisa
                  {active.lookups.length === 1 ? "" : "s"}
                </span>
              </div>
              {active.lookups.length ? (
                <div className="word-list">
                  {active.lookups
                    .slice()
                    .reverse()
                    .map((lookup, index) => (
                      <div
                        className="word-row"
                        key={`${lookup.normalized}-${index}`}
                      >
                        <div className="word-meta">
                          <strong>{lookup.term}</strong>
                          {lookup.definition && (
                            <small>{lookup.definition}</small>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="empty-state">
                  consultar durante esta leitura aparecem aqui.
                </div>
              )}
            </div>
          </aside>
        </section>
      </section>
    );
  }

  return (
    <section>
      <section className="page-intro">
        <span className="eyebrow">SEU TEMPO COM OS LIVROS</span>
        <h1>Uma leitura de cada vez</h1>
      </section>
      <section className="home-grid">
        <div className="reading-library-card">
          <div className="reading-start-copy">
            <span className="eyebrow">HORA DE LEITURA</span>
            <h2>Qual livro você quer continuar?</h2>
            <p>
              Escolha um livro em andamento ou cadastre um novo para acompanhar
              seu progresso.
            </p>
          </div>
          {availableBooks.length ? (
            <div className="book-picker-list">
              {availableBooks.map((book) => {
                const progress = Math.round(
                  (book.currentPage / book.totalPages) * 100,
                );
                return (
                  <div
                    className={`book-picker-item${selectedBookId === book.id ? " selected" : ""}`}
                    key={book.id}
                    aria-pressed={selectedBookId === book.id}
                    onClick={() => setSelectedBookId(book.id)}
                  >
                    <span className="book-picker-copy">
                      <strong>{book.title}</strong>
                      <small>
                        {book.author || "Livro sem autor"} · {progress}%
                        concluído ·{" "}
                        {book.language === "pt" ? "Português" : "Inglês"}
                      </small>
                      <span className="book-progress-track">
                        <span style={{ width: `${progress}%` }} />
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-state book-empty-state">
              <strong>
                {state.books.length
                  ? "Você concluiu todos os livros"
                  : "Você ainda não cadastrou nenhum livro"}
              </strong>
            </div>
          )}
          {selectedBook && (
            <button
              className="button"
              type="button"
              onClick={() => startBook(selectedBook.id)}
            >
              <Play aria-hidden="true" />
              {selectedBook.title}
            </button>
          )}
          <Link className="text-button reading-library-link" href="/books">
            Cadastrar ou gerenciar livros →
          </Link>
        </div>
        <GoalCard
          title="Sua meta de leitura"
          value={todayMinutes}
          total={settings.dailyGoal}
          unit="min"
          caption={`de ${settings.dailyGoal} min hoje`}
          action={
            <Link className="text-button" href="/reading">
              Registrar +
            </Link>
          }
        />
      </section>
      <div className="section-heading">
        <div>
          <h2>Histórico de leitura</h2>
          <p suppressHydrationWarning>
            {visibleHistory.length}{" "}
            {visibleHistory.length === 1 ? "sessão" : "sessões"} ·{" "}
            {visibleHistory.reduce(
              (total, session) =>
                total +
                (session.minutes || Math.floor((session.seconds || 0) / 60)),
              0,
            )}{" "}
            min lidos
          </p>
        </div>
      </div>
      <div className="session-history">
        {visibleHistory.length ? (
          [...visibleHistory]
            .sort(
              (a, b) =>
                new Date(b.createdAt || b.startedAt).getTime() -
                new Date(a.createdAt || a.startedAt).getTime(),
            )
            .map((session) => {
              const lookups = session.lookups || [];
              return (
                <details
                  className="history-card"
                  key={session.id || session.createdAt}
                >
                  <summary>
                    <span className="history-date">
                      <strong>
                        {new Intl.DateTimeFormat("pt-BR", {
                          day: "numeric",
                          month: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        }).format(
                          new Date(session.createdAt || session.startedAt),
                        )}
                      </strong>
                      <small>
                        {session.bookId
                          ? bookById.get(session.bookId)?.title ||
                            "Livro removido"
                          : "Sessão de leitura"}
                        {session.note ? ` · ${session.note}` : ""}
                      </small>
                    </span>
                    <button
                      type="button"
                      className="delete-session-button"
                      aria-label={`Apagar sessão de ${session.note || "leitura"}`}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setConfirmAction(session.id);
                      }}
                    >
                      <Trash2 aria-hidden="true" />
                    </button>
                    <span className="history-chevron" aria-hidden="true">
                      ⌄
                    </span>
                  </summary>
                  <div className="history-insights">
                    <div>
                      <strong>
                        {formatDuration(
                          session.durationSeconds || session.seconds || 0,
                        )}
                      </strong>
                      <small>tempo lido</small>
                    </div>
                    <div>
                      <strong>{lookups.length}</strong>
                      <small>
                        {lookups.length === 1 ? "pesquisa" : "pesquisas"}
                      </small>
                    </div>
                    <div>
                      <strong>{session.pages || 0}</strong>
                      <small>páginas</small>
                    </div>
                  </div>
                  {lookups.length ? (
                    <div className="history-lookups">
                      {[
                        ...new Map(
                          lookups.map((lookup) => [lookup.normalized, lookup]),
                        ).values(),
                      ].map((lookup) => {
                        const count = lookups.filter(
                          (item) => item.normalized === lookup.normalized,
                        ).length;
                        const savedWord =
                          session.pendingWords?.[lookup.normalized] ||
                          session.wordSnapshots?.[lookup.normalized] ||
                          state.words.find(
                            (word) => word.normalized === lookup.normalized,
                          );
                        const definition = savedWord?.definition;
                        return (
                          <div className="word-row" key={lookup.normalized}>
                            <div className="word-meta">
                              <strong>{lookup.term}</strong>
                              <small>
                                {definition || "Definição indisponível"}
                              </small>
                            </div>
                            <WordCountBadge count={count} />
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="history-empty">
                      Nenhuma palavra pesquisada nesta sessão.
                    </p>
                  )}
                </details>
              );
            })
        ) : (
          <div className="empty-state">
            Depois da primeira sessão, o resumo e as palavras pesquisadas ficam salvos aqui.
          </div>
        )}
      </div>
      {confirmAction && confirmAction !== "discard" && (
        <ConfirmModal
          title="Apagar sessão?"
          message="Esta sessão e suas pesquisas serão removidas deste navegador."
          confirmLabel="Apagar sessão"
          onCancel={() => setConfirmAction(null)}
          onConfirm={() => void remove(confirmAction).then(() => setConfirmAction(null)).catch(() => undefined)}
        />
      )}
      {bookToDelete && (
        <ConfirmModal
          title="Excluir livro?"
          message={`O livro "${state.books.find((book) => book.id === bookToDelete)?.title || "selecionado"}" e seu progresso serão removidos.`}
          confirmLabel="Excluir livro"
          onCancel={() => setBookToDelete(null)}
          onConfirm={() => void deleteBook(bookToDelete).then(() => setBookToDelete(null)).catch(() => undefined)}
        />
      )}
    </section>
  );
}
