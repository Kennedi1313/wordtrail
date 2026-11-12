"use client";
import { useMemo, useState } from "react";
import { useWordtrail } from "@/hooks/use-wordtrail";
import { ConfirmModal } from "@/components/shared/confirm-modal";
import { WordCountBadge } from "../shared/stat-cards";
import { WordDetailsModal } from "../shared/word-details-modal";
import { VocabularySearch } from "../shared/vocabulary-search";
import { lookupWord } from "@/services/dictionary-service";
import { Word } from "@/types/domain";
import { X } from "lucide-react";
import { readingGoalStreak } from "@/services/reading-stats";

export function VocabularyPage() {
  const { state, settings, removeWord, ready, dueWords, addWord } = useWordtrail();
  const visibleWords = ready ? state.words : [];
  const [filter, setFilter] = useState("");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [selectedWord, setSelectedWord] = useState<
    (typeof visibleWords)[number] | null
  >(null);
  const [refreshingWord, setRefreshingWord] = useState(false);
  const filteredWords = useMemo(() => {
    const query = filter.toLowerCase();
    const seen = new Set<string>();
    return visibleWords.filter((word) => {
      const normalized = word.normalized.trim().toLowerCase();
      const matches =
        `${word.term} ${word.definition || ""}`
          .toLowerCase()
          .includes(query);
      if (!matches || seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });
  }, [filter, visibleWords]);
  async function openWord(word: Word) {
    setSelectedWord(word);
    if (word.definition?.trim()) return;

    setRefreshingWord(true);
    try {
      const dictionary = await lookupWord(word.term).catch(() => ({}));
      const refreshed = {
        ...word,
        ...dictionary,
        term: word.term,
        normalized: word.normalized,
        lookups: word.lookups,
      };
      // Keep the old server-backed definition visible until the updated record
      // has been confirmed by Supabase.
      await addWord(refreshed);
      setSelectedWord(refreshed);
    } finally {
      setRefreshingWord(false);
    }
  }
  return (
    <section>
      <section className="page-intro">
        <span className="eyebrow">SEU VOCABULÁRIO PESSOAL</span>
        <h1>Palavras que você encontrou</h1>
        <p>Cada pesquisa vira uma descoberta guardada pra depois.</p>
      </section>
      <div className="stats-row">
        <div className="stat-card stat-card-home">
          <strong className="stat-icon stat-value">
            {visibleWords.length}
          </strong>
          <small>palavras diferentes</small>
        </div>
        <div className="stat-card stat-card-home">
          <strong className="stat-icon stat-value">
            {visibleWords.reduce((sum, word) => sum + word.lookups, 0)}
          </strong>
          <small>pesquisas no total</small>
        </div>
        <div className="stat-card stat-card-home">
          <strong className="stat-icon stat-value">
            {ready ? dueWords.length : 0}
          </strong>
          <small>prontas pra revisar</small>
        </div>
        <div className="stat-card stat-card-home">
          <strong className="stat-icon stat-value">
            {ready
              ? readingGoalStreak(
                  state.readingSessions,
                  state.activeReadingSession,
                  settings.dailyGoal,
                )
              : 0}
          </strong>
          <small>dias seguidos com a meta batida</small>
        </div>
      </div>
      <VocabularySearch words={visibleWords} onSearch={setFilter} />
      <div className="word-table">
        {!ready ? (
          <div className="server-data-loading" role="status">
            <span className="loading-spinner" aria-hidden="true" />
            <span>Carregando seu vocabulário…</span>
          </div>
        ) : (
          (filteredWords.length ? (
            filteredWords.map((word) => (
              <article
                className="word-row vocabulary-word-row"
                key={word.normalized.trim().toLowerCase() || word.term.trim().toLowerCase()}
                onClick={() => void openWord(word)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    void openWord(word);
                  }
                }}
              >
                <div className="table-detail">
                  <strong>{word.term}</strong>
                  <small>{word.definition || "Definição indisponível"}</small>
                </div>
                <WordCountBadge count={word.lookups} />
                <button
                  className="delete-word"
                  onClick={(event) => {
                    event.stopPropagation();
                    setPendingDelete(word.normalized);
                  }}
                  aria-label={`Remover ${word.term}`}
                >
                  <X aria-hidden="true" />
                </button>
              </article>
            ))
          ) : (
            <div className="empty-state">
              Pesquise uma palavra durante a leitura pra começar.
            </div>
          ))
        )}
      </div>
      {selectedWord && (
        <WordDetailsModal
          word={selectedWord}
          onClose={() => setSelectedWord(null)}
          refreshing={refreshingWord}
        />
      )}
      {pendingDelete && (
        <ConfirmModal
          title="Apagar palavra?"
          message="Esta palavra será removida do seu vocabulário neste navegador."
          confirmLabel="Apagar palavra"
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            removeWord(pendingDelete);
            setPendingDelete(null);
          }}
        />
      )}
    </section>
  );
}
