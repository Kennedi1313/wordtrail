import { Check, Clock3, Layers3, ListChecks, Play } from "lucide-react";
import { StatCards } from "@/components/shared/stat-cards";
import { GoalCard } from "@/components/shared/goal-card";
import { StartCard } from "@/components/shared/start-card";
import Link from "next/link";

export function PracticeSetup({
  words,
  reviewedToday,
  dueTotal,
  reviews,
  vocabularySize,
  mode,
  onModeChange,
  onStart,
  disabled,
}: {
  words: number;
  reviewedToday: number;
  dueTotal: number;
  reviews: { correct: boolean }[];
  vocabularySize: number;
  mode: "flashcard" | "quiz";
  onModeChange: (mode: "flashcard" | "quiz") => void;
  onStart: () => void;
  disabled: boolean;
}) {
  const minimum = 10;
  const ready = words >= minimum;
  return (
    <>
      <section className="practice-start-grid">
        <StartCard
          className="practice-game-start-card"
          eyebrow="SUA PRÓXIMA RODADA"
          title="Pronto para relembrar as palavras?"
          action={
            <button
              className="button practice-hero-cta"
              onClick={onStart}
              disabled={disabled}
            >
              <Play />{" "}
              {disabled && !ready ? "Continue pesquisando" : "Começar a jogar"}
            </button>
          }
        >
          <div className="practice-hero-meta">
            <span>
              <Layers3 /> <strong>{words}</strong> palavras no vocabulário
            </span>
            <span>
              <Clock3 /> <strong>5</strong> min
            </span>
          </div>
          {!ready && (
            <p className="practice-unlock-note">
              Faltam {minimum - words} palavras com definição para liberar o
              jogo.
            </p>
          )}
        </StartCard>
        <GoalCard
          title="Revisões de hoje"
          value={reviewedToday}
          total={dueTotal}
          unit="palavras revisadas"
          caption={`${dueTotal} palavras precisam de revisão`}
          action={
            <Link className="text-button" href="/vocabulary">
              Ver vocabulário
            </Link>
          }
        />
      </section>
      <section
        className="practice-mode-grid"
        aria-label="Escolha o modo de jogo"
      >
        <button
          className={`practice-mode-card${mode === "flashcard" ? " selected" : ""}`}
          onClick={() => onModeChange("flashcard")}
          aria-pressed={mode === "flashcard"}
        >
          <Layers3 />
          <span>
            <strong>Flashcards</strong>
            <small>Digite a palavra a partir da definição</small>
          </span>
          {mode === "flashcard" && <Check className="practice-mode-check" />}
        </button>
        <button
          className={`practice-mode-card${mode === "quiz" ? " selected" : ""}`}
          onClick={() => onModeChange("quiz")}
          aria-pressed={mode === "quiz"}
        >
          <ListChecks />
          <span>
            <strong>Múltipla escolha</strong>
            <small>Escolha a palavra certa entre quatro opções</small>
          </span>
          {mode === "quiz" && <Check className="practice-mode-check" />}
        </button>
      </section>
      <section className="section-heading practice-progress-heading">
        <div>
          <h2>Seu progresso</h2>
          <p>Aprender também é tentar, errar e tentar de novo.</p>
        </div>
      </section>
      <StatCards
        className="practice-stats"
        items={[
          { value: reviews.length, label: "respostas tentadas" },
          {
            value: reviews.filter((review) => review.correct).length,
            label: "lembradas de primeira",
          },
          { value: words, label: "palavras disponíveis nos games" },
          { value: vocabularySize, label: "palavras no vocabulário" },
        ]}
      />
    </>
  );
}
