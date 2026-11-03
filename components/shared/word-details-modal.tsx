import { X } from "lucide-react";
import { Word } from "@/types/domain";

export function WordDetailsModal({
  word,
  onClose,
  refreshing = false,
  onTranslationChange,
}: {
  word: Word;
  onClose: () => void;
  refreshing?: boolean;
  onTranslationChange?: (translation: string) => void;
}) {
  const translationOptions = word.translationOptions?.length
    ? word.translationOptions
    : word.translation
      ? [word.translation]
      : [];
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section
        className="modal word-details-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="word-details-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <span className="eyebrow">PALAVRA GUARDADA</span>
            <h2 id="word-details-title">{word.term}</h2>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Fechar">
            <X aria-hidden="true" />
          </button>
        </div>
        <div className="word-details-content">
          <div className="word-details-meta">
            <div className="pronunciation">
              {word.phonetic ? `/${word.phonetic}/` : "Pronúncia indisponível"}
            </div>
            {refreshing && (
              <div className="word-details-refresh" role="status">
                <span className="loading-spinner" aria-hidden="true" />
                Atualizando informações…
              </div>
            )}
            {word.partOfSpeech && (
              <span className="pos-tag">{word.partOfSpeech}</span>
            )}
          </div>
          <div className="result-divider" />
          <div className="result-label">Traduções em português</div>
          {translationOptions.length > 0 && (
            <div
              className="translation-options"
              aria-label="Escolha a tradução"
            >
              {translationOptions.map((option) => (
                <button
                  className={`translation-option${option === word.translation ? " selected" : ""}`}
                  key={option}
                  type="button"
                  onClick={() => onTranslationChange?.(option)}
                >
                  {option}
                </button>
              ))}
            </div>
          )}
          {translationOptions.length === 0 && (
            <div className="translation-text">
              {word.translation || "Tradução indisponível"}
            </div>
          )}
          <div className="result-divider" />
          <div className="result-label">
            Definition in English
            {word.definitionSource ? " · online" : ""}
          </div>
          <div className="definition-text">
            {word.definition || "Definição indisponível"}
          </div>
        </div>
      </section>
    </div>
  );
}
