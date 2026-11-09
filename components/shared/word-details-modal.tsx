import { X } from "lucide-react";
import { Word } from "@/types/domain";
import { motion } from "motion/react";

export function WordDetailsModal({
  word,
  onClose,
  refreshing = false,
}: {
  word: Word;
  onClose: () => void;
  refreshing?: boolean;
}) {
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <motion.section
        className="modal word-details-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="word-details-title"
        onClick={(event) => event.stopPropagation()}
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
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
          <div className="result-label">Definição</div>
          <div className="definition-text">
            {word.definition || "Definição indisponível"}
          </div>
          {word.usageLabels?.length ? (
            <div className="dictionary-detail-row">
              <span className="result-label">USO</span>
              <div className="dictionary-tags">
                {word.usageLabels.map((label) => (
                  <span key={label}>{label}</span>
                ))}
              </div>
            </div>
          ) : null}
          {word.relatedWords?.length ? (
            <div className="dictionary-detail-row">
              <span className="result-label">PALAVRAS RELACIONADAS</span>
              <p className="dictionary-detail-copy">
                {word.relatedWords.join(", ")}
              </p>
            </div>
          ) : null}
          {word.examples?.length ? (
            <div className="dictionary-detail-row">
              <span className="result-label">EXEMPLOS</span>
              <div className="dictionary-examples">
                {word.examples.map((example) => (
                  <p key={example}>{example}</p>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </motion.section>
    </div>
  );
}
