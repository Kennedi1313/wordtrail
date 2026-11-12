"use client";
import { useEffect, useMemo, useState } from "react";
import { useWordtrail } from "@/hooks/use-wordtrail";
import {
  quizOptions,
  practiceWords,
  shuffle,
  updateReview,
} from "@/services/practice-service";
import { StatCards } from "@/components/shared/stat-cards";
import { Clock3 } from "lucide-react";
import { PracticeTip } from "@/components/practice/practice-tip";
import { PracticeSetup } from "@/components/practice/practice-setup";
import { motion } from "motion/react";
import { useSoundEffects } from "@/hooks/use-sound-effects";
export function PracticePage() {
  const MINIMUM_WORDS = 10;
  const MAXIMUM_ROUND_WORDS = 10;
  const { state, setState, dueWords } = useWordtrail();
  const { playCorrect, playIncorrect, playComplete } = useSoundEffects();
  const [source, setSource] = useState<"vocabulary" | "dictionary">(
    "vocabulary",
  );
  const [mode, setMode] = useState<"flashcard" | "quiz">("flashcard");
  const [onlineWords, setOnlineWords] = useState<typeof state.words>([]);
  const [sessionWords, setSessionWords] = useState<typeof state.words>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const words = useMemo(
    () => (source === "dictionary" ? onlineWords : practiceWords(state.words)),
    [onlineWords, source, state.words],
  );
  const [index, setIndex] = useState<number | null>(null);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<boolean | null>(null);
  const [answerSaving, setAnswerSaving] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(300);
  const [practiceSummary, setPracticeSummary] = useState<{
    correct: number;
    answered: number;
    duration: number;
  } | null>(null);
  const [answered, setAnswered] = useState(0);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const activeWords = index === null ? words : sessionWords;
  const canStartPractice =
    source === "dictionary" || words.length >= MINIMUM_WORDS;
  const word = index === null ? null : activeWords[index];
  const options = useMemo(() => {
    if (!word || mode !== "quiz") return [];
    if (source === "dictionary") {
      return shuffle([
        word,
        ...activeWords
          .filter((item) => item.normalized !== word.normalized)
          .slice(0, 3),
      ]).map((item) => ({
          value: item.term,
          correct: item.normalized === word.normalized,
        }));
    }
    return quizOptions(word, activeWords);
  }, [word?.normalized, mode, source, activeWords]);
  useEffect(() => {
    if (index === null) return;
    const timer = window.setInterval(
      () => setSecondsLeft((value) => Math.max(0, value - 1)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [index]);
  useEffect(() => {
    if (index !== null && secondsLeft === 0) finishPractice();
  }, [index, secondsLeft]);
  async function startPractice() {
    if (!canStartPractice) {
      setLoadError(
        `Você precisa pesquisar pelo menos ${MINIMUM_WORDS} palavras com definição para começar.`,
      );
      return;
    }
    setPracticeSummary(null);
    setAnswered(0);
    setCorrectAnswers(0);
    setLoadError("");
    if (source === "dictionary") {
      setLoading(true);
      try {
        const response = await fetch("/api/dictionary/practice?count=20");
        if (!response.ok)
          throw new Error("Não foi possível carregar palavras online agora.");
        const data = await response.json();
        const fetchedWords = (
          Array.isArray(data.words) ? data.words : []
        ) as typeof state.words;
        if (!fetchedWords.length)
          throw new Error("A API não retornou palavras para praticar.");
        setOnlineWords(fetchedWords);
        setSessionWords(shuffle(fetchedWords).slice(0, MAXIMUM_ROUND_WORDS));
        setIndex(0);
        setFeedback(null);
        setSelectedOption(null);
        setAnswer("");
        setSecondsLeft(300);
      } catch (error) {
        setLoadError(
          error instanceof Error
            ? error.message
            : "Não foi possível carregar palavras online agora.",
        );
      } finally {
        setLoading(false);
      }
      return;
    }
    setSessionWords(shuffle(words).slice(0, MAXIMUM_ROUND_WORDS));
    setIndex(0);
    setFeedback(null);
    setSelectedOption(null);
    setAnswer("");
    setSecondsLeft(300);
  }
  async function answerWord(correct: boolean, selectedValue?: string) {
    if (!word || feedback !== null || answerSaving) return;
    setAnswerSaving(true);
    try {
      await setState((current) => ({
        ...current,
        reviews: [
          ...current.reviews,
          { at: new Date().toISOString(), term: word.term, correct, mode },
        ],
        words: current.words.map((item) =>
          item.normalized === word.normalized
            ? updateReview(item, correct)
            : item,
        ),
      }));
      setSelectedOption(selectedValue ?? null);
      setFeedback(correct);
      if (correct) playCorrect();
      else playIncorrect();
      setAnswered((value) => value + 1);
      if (correct) setCorrectAnswers((value) => value + 1);
    } catch {
      // AppShell displays the server error; keep this question unanswered.
    } finally {
      setAnswerSaving(false);
    }
  }
  function next() {
    if (answered >= MAXIMUM_ROUND_WORDS) {
      finishPractice();
      return;
    }
    setIndex((current) =>
      current === null ? 0 : (current + 1) % Math.max(sessionWords.length, 1),
    );
    setFeedback(null);
    setSelectedOption(null);
    setAnswer("");
    setSecondsLeft(300);
  }
  function finishPractice() {
    setPracticeSummary({
      correct: correctAnswers,
      answered,
      duration: Math.floor((300 - secondsLeft) / 60),
    });
    setIndex(null);
    setFeedback(null);
    if (answered >= MAXIMUM_ROUND_WORDS) playComplete();
    else playIncorrect();
  }
  return (
    <section className={practiceSummary ? "practice-summary-page" : undefined}>
      {practiceSummary ? (
        <>
          <section className="page-intro practice-summary-intro">
            <span className="eyebrow">PAUSA PRA FIXAR</span>
            <h1>Hora do jogo!</h1>
            <p>Uma pausa curtinha também é progresso.</p>
          </section>
          <motion.section
            className="session-card practice-complete"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
          >
            <span className="eyebrow">RODADA CONCLUÍDA</span>
            <h2>Mandou bem nessa pausa!</h2>
            <p>
              {practiceSummary.answered
                ? `Você lembrou ${practiceSummary.correct} de ${practiceSummary.answered} ${practiceSummary.answered === 1 ? "palavra" : "palavras"}. Volta pro seu livro com mais uma vitória no bolso.`
                : "Rodada encerrada. Quando quiser, você pode tentar de novo."}
            </p>
            <div className="practice-complete-stats">
              <div>
                <strong>{practiceSummary.correct}</strong>
                <small>lembradas</small>
              </div>
              <div>
                <strong>{practiceSummary.answered}</strong>
                <small>respondidas</small>
              </div>
              <div>
                <strong>{practiceSummary.duration}</strong>
                <small>minutos de prática</small>
              </div>
            </div>
            <button
              className="button practice-return-button"
              onClick={() => setPracticeSummary(null)}
            >
              Voltar aos jogos →
            </button>
          </motion.section>
        </>
      ) : null}
      {practiceSummary ? null : (
        <>
          {index === null && (
            <section className="page-intro">
              <span className="eyebrow">PAUSA PRA FIXAR</span>
              <h1>Bora praticar?</h1>
            </section>
          )}
          {index === null && (
            <PracticeSetup
              words={words.length}
              reviewedToday={
                new Set(
                  state.reviews
                    .filter(
                      (review) =>
                        review.at.slice(0, 10) ===
                        new Date().toISOString().slice(0, 10),
                    )
                    .map((review) => review.term),
                ).size
              }
              dueTotal={dueWords.length}
              reviews={state.reviews}
              vocabularySize={state.words.length}
              mode={mode}
              onModeChange={setMode}
              onStart={startPractice}
              disabled={loading || !canStartPractice}
            />
          )}
          {false ? (
            <>
              <div className="form-card practice-start-card">
                <div className="side-panel-title">
                  <div>
                    <h2>Sua próxima rodada</h2>
                    <p className="practice-description">
                      {words.length
                        ? `Você tem ${words.length} palavras. Faltam ${MINIMUM_WORDS - words.length} para liberar o jogo.`
                        : `Pesquise pelo menos ${MINIMUM_WORDS} palavras durante a leitura pra começar a jogar.`}
                    </p>
                  </div>
                  <span className="goal-icon" aria-hidden="true">
                    <Clock3 />
                  </span>
                </div>
                <div className="practice-config">
                  <span className="practice-config-label">Palavras de</span>
                  <div className="segmented">
                    <button
                      className={source === "vocabulary" ? "selected" : ""}
                      onClick={() => setSource("vocabulary")}
                    >
                      Meu vocabulário
                    </button>
                  </div>
                </div>
                <div className="practice-config">
                  <span className="practice-config-label">
                    Escolha como jogar
                  </span>
                  <div
                    className="segmented"
                    role="group"
                    aria-label="Modo de jogo"
                  >
                    <button
                      type="button"
                      className={mode === "flashcard" ? "selected" : ""}
                      aria-pressed={mode === "flashcard"}
                      onClick={() => setMode("flashcard")}
                    >
                      Flashcards
                    </button>
                    <button
                      type="button"
                      className={mode === "quiz" ? "selected" : ""}
                      aria-pressed={mode === "quiz"}
                      onClick={() => setMode("quiz")}
                    >
                      Múltipla escolha
                    </button>
                  </div>
                </div>
                <PracticeTip />
                <button
                  className="button"
                  disabled={loading || !canStartPractice}
                  onClick={startPractice}
                >
                  {loading ? "Carregando palavras…" : "Começar a jogar →"}
                </button>
                {loadError && (
                  <div className="result-status error">{loadError}</div>
                )}
              </div>
              <section className="section-heading">
                <div>
                  <h2>Seu progresso nas revisões</h2>
                  <p>Aprender também é tentar, errar e tentar de novo.</p>
                </div>
              </section>
              <StatCards
                className="practice-stats"
                items={[
                  { value: 0, label: "respostas tentadas" },
                  { value: 0, label: "lembradas de primeira" },
                  { value: 0, label: "palavras prontas agora" },
                  { value: 0, label: "palavras no vocabulário" },
                ]}
              />
            </>
          ) : false ? (
            <>
              <div className="form-card practice-start-card">
                <div className="side-panel-title">
                  <div>
                    <h2>Sua próxima rodada</h2>
                    <p className="practice-description">
                      {words.length} palavras prontas pra revisar. Palavras
                      antigas também entram no jogo.
                      {words.length < MINIMUM_WORDS &&
                        ` Faltam ${MINIMUM_WORDS - words.length} para liberar.`}
                    </p>
                  </div>
                </div>
                <div className="practice-config">
                  <span className="practice-config-label">Palavras de: </span>
                  <div className="segmented">
                    <button
                      className={source === "vocabulary" ? "selected" : ""}
                      onClick={() => setSource("vocabulary")}
                    >
                      Meu vocabulário
                    </button>
                  </div>
                </div>
                <div className="practice-config">
                  <span className="practice-config-label">Modo de jogo: </span>
                  <div className="segmented">
                    <button
                      className={mode === "flashcard" ? "selected" : ""}
                      onClick={() => setMode("flashcard")}
                    >
                      Flashcards
                    </button>
                    <button
                      className={mode === "quiz" ? "selected" : ""}
                      onClick={() => setMode("quiz")}
                    >
                      Múltipla escolha
                    </button>
                  </div>
                </div>
                <PracticeTip />
                <button
                  className="button"
                  onClick={startPractice}
                  disabled={!canStartPractice}
                >
                  Começar a jogar →
                </button>
              </div>
              <section className="section-heading">
                <div>
                  <h2>Seu progresso nas revisões</h2>
                  <p>Aprender também é tentar, errar e tentar de novo.</p>
                </div>
              </section>
              <StatCards
                className="practice-stats"
                items={[
                  { value: state.reviews.length, label: "respostas tentadas" },
                  {
                    value: state.reviews.filter((review) => review.correct)
                      .length,
                    label: "lembradas de primeira",
                  },
                  { value: words.length, label: "palavras prontas agora" },
                  {
                    value: state.words.length,
                    label: "palavras no vocabulário",
                  },
                ]}
              />
            </>
          ) : index !== null ? (
            <div className="practice-screen">
              <section className="page-intro">
                <span className="eyebrow">SUA PAUSA DE CINCO MINUTOS</span>
                <h1>Você consegue</h1>
                <p>
                  {mode === "flashcard"
                    ? "Leia a definição, digite a palavra e confira sua resposta."
                    : "Pense um pouquinho antes de escolher a resposta."}
                </p>
              </section>
              <div className="session-card">
                <div className="session-top">
                  <span>
                    Volta 1 · Palavra {index + 1} de {activeWords.length}
                  </span>
                  <span className="timer" role="timer">
                    {Math.floor(secondsLeft / 60)}:
                    {String(secondsLeft % 60).padStart(2, "0")}
                  </span>
                </div>
                <div className="session-progress">
                  <span
                    style={{
                      width: `${((index + 1) / activeWords.length) * 100}%`,
                    }}
                  />
                </div>
                {mode === "quiz" ? (
                  <>
                    <div className="prompt-label">Qual é a palavra?</div>
                    <p className="prompt-definition">{word?.definition}</p>
                    {word?.examples?.[0] && (
                      <p className="practice-example">
                        Exemplo: “{word.examples[0]}”
                      </p>
                    )}
                    <div className="quiz-options">
                      {options.map((option) => (
                        <button
                          className={`quiz-option ${feedback !== null && option.correct ? "correct" : ""} ${feedback !== null && selectedOption === option.value && !option.correct ? "wrong" : ""}`}
                          key={option.value}
                          disabled={feedback !== null || answerSaving}
                          onClick={() =>
                            answerWord(option.correct, option.value)
                          }
                        >
                          {option.value}
                        </button>
                      ))}
                    </div>
                  </>
                ) : null}
                {mode === "flashcard" && (
                  <>
                    <div className="prompt-label">
                      Leia a definição e digite a palavra
                    </div>
                    <p className="prompt-definition">{word?.definition}</p>
                    {word?.examples?.[0] && (
                      <p className="practice-example">
                        Exemplo: “{word.examples[0]}”
                      </p>
                    )}
                  </>
                )}
                {feedback !== null && (
                  <motion.div
                    className={`answer-box ${feedback ? "answer-correct" : "answer-wrong"}`}
                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.18 }}
                  >
                    <span className="answer-label">
                      {feedback
                        ? "Isso! Palavra correta."
                        : `Quase! A palavra era: ${word?.term}`}
                    </span>
                  </motion.div>
                )}
                {mode === "flashcard" && feedback === null && (
                  <div className="flashcard-answer-form">
                    <label
                      className="letter-slots-label"
                      htmlFor="flash-answer"
                    >
                      Sua resposta ·{" "}
                      {
                        [...(word?.term || "")].filter((character) =>
                          /[a-z]/i.test(character),
                        ).length
                      }{" "}
                      letras
                    </label>
                    <div className="letter-input-wrap">
                      <div className="letter-slots" aria-hidden="true">
                        {[...(word?.term || "")].map((character, position) =>
                          /[a-z]/i.test(character) ? (
                            <span className="letter-slot" key={position}>
                              {answer[position] || ""}
                            </span>
                          ) : (
                            <span
                              className="letter-slot-separator"
                              key={position}
                            >
                              {character}
                            </span>
                          ),
                        )}
                      </div>
                      <input
                        id="flash-answer"
                        className="letter-answer-input"
                        value={answer}
                        autoComplete="off"
                        onChange={(event) => setAnswer(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter")
                            answerWord(
                              answer.trim().toLowerCase() ===
                                word?.term.toLowerCase(),
                            );
                        }}
                      />
                    </div>
                  </div>
                )}
                <div
                  className="practice-controls"
                  aria-label="Controles da sessão"
                >
                  <button
                    className="text-button practice-quit"
                    onClick={finishPractice}
                  >
                    Encerrar sessão
                  </button>
                  <div className="practice-primary-controls">
                    {mode === "flashcard" && feedback === null && (
                      <button
                        className="button"
                        type="button"
                        disabled={!answer.trim() || answerSaving}
                        onClick={() =>
                          answerWord(
                            answer.trim().toLowerCase() ===
                              word?.term.toLowerCase(),
                          )
                        }
                      >
                        Conferir resposta
                      </button>
                    )}
                    {feedback !== null && (
                      <button className="button" onClick={next}>
                        {answered >= MAXIMUM_ROUND_WORDS
                          ? "Concluir rodada"
                          : "Próxima palavra →"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
