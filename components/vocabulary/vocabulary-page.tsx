"use client";
import { useState } from "react";
import { useWordtrail } from "@/hooks/use-wordtrail";
import { ConfirmModal } from "@/components/shared/confirm-modal";
import { WordCountBadge } from "../shared/stat-cards";
import { WordDetailsModal } from "../shared/word-details-modal";
import { VocabularySearch } from "../shared/vocabulary-search";
import {
  lookupWord,
  translateWordOptions,
} from "@/services/dictionary-service";
import { Word } from "@/types/domain";
import { X } from "lucide-react";

export function VocabularyPage() {
  const { state, removeWord, ready, dueWords, addWord } = useWordtrail();
  const visibleWords = ready ? state.words : [];
  const [filter, setFilter] = useState("");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [selectedWord, setSelectedWord] = useState<
    (typeof visibleWords)[number] | null
  >(null);
  const [refreshingWord, setRefreshingWord] = useState(false);
  async function openWord(word: Word) {
    setSelectedWord(word);
    setRefreshingWord(true);
    const [dictionaryResult, translationResult] = await Promise.allSettled([
      lookupWord(word.term),
      translateWordOptions(word.term),
    ]);
    const dictionary =
      dictionaryResult.status === "fulfilled" ? dictionaryResult.value : {};
    const translation =
      translationResult.status === "fulfilled"
        ? translationResult.value.translation
        : "";
    const translationOptions =
      translationResult.status === "fulfilled"
        ? translationResult.value.options
        : [];
    const refreshed = {
      ...word,
      ...dictionary,
      term: word.term,
      normalized: word.normalized,
      translation: word.translation || translation,
      translationOptions: word.translationOptions?.length
        ? word.translationOptions
        : translationOptions,
      lookups: word.lookups,
    };
    setSelectedWord(refreshed);
    addWord(refreshed);
    setRefreshingWord(false);
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
              ? new Set(
                  state.readingSessions
                    .map((session) => session.date)
                    .filter(Boolean),
                ).size
              : 0}
          </strong>
          <small>dias lendo em sequência</small>
        </div>
      </div>
      <VocabularySearch words={visibleWords} onSearch={setFilter} />
      <div className="word-table">
        {ready &&
          (state.words.filter((word) =>
            `${word.term} ${word.translation || ""} ${word.definition || ""}`
              .toLowerCase()
              .includes(filter.toLowerCase()),
          ).length ? (
            state.words
              .filter((word) =>
                `${word.term} ${word.translation || ""} ${word.definition || ""}`
                  .toLowerCase()
                  .includes(filter.toLowerCase()),
              )
              .map((word) => (
                <article
                  className="word-row vocabulary-word-row"
                  key={word.normalized}
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
                    <small>
                      {word.translation || "Tradução indisponível"} ·{" "}
                      {word.definition || "Definição indisponível"}
                    </small>
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
              <strong>Seu vocabulário começa com uma curiosidade</strong>
              Pesquise uma palavra durante a leitura pra começar.
            </div>
          ))}
      </div>
      {selectedWord && (
        <WordDetailsModal
          word={selectedWord}
          onClose={() => setSelectedWord(null)}
          refreshing={refreshingWord}
          onTranslationChange={(translation) => {
            if (!selectedWord) return;
            const updated = { ...selectedWord, translation };
            setSelectedWord(updated);
            addWord(updated);
          }}
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
