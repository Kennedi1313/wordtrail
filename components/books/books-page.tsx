"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { BookOpen, CheckCircle2, Library, Plus, Trash2 } from "lucide-react";
import { Book } from "@/types/domain";
import { useWordtrail } from "@/hooks/use-wordtrail";
import { ConfirmModal } from "@/components/shared/confirm-modal";

type BookFilter = "reading" | "finished" | "all";
type BookCounts = Record<BookFilter, number>;

const FILTERS: Array<{ key: BookFilter; label: string }> = [
  { key: "reading", label: "Em andamento" },
  { key: "finished", label: "Concluídos" },
  { key: "all", label: "Todos" },
];

function getProgress(book: Book) {
  return Math.min(
    100,
    Math.max(0, Math.round((book.currentPage / book.totalPages) * 100)),
  );
}

function languageLabel(language?: Book["language"]) {
  return language === "pt" ? "Português" : "Inglês";
}

function getEmptyMessage(filter: BookFilter) {
  if (filter === "finished")
    return {
      title: "Nenhum livro concluído ainda",
      body: "Continue lendo para celebrar sua primeira conclusão.",
    };
  if (filter === "reading")
    return {
      title: "Sua próxima leitura começa aqui",
      body: "Cadastre um livro para acompanhar seu progresso.",
    };
  return {
    title: "Sua biblioteca está vazia",
    body: "Cadastre um livro para acompanhar seu progresso.",
  };
}

function LibrarySummary({ counts }: { counts: BookCounts }) {
  const items = [
    { icon: Library, value: counts.all, label: "livros cadastrados" },
    { icon: BookOpen, value: counts.reading, label: "em andamento" },
    { icon: CheckCircle2, value: counts.finished, label: "concluídos" },
  ];
  return (
    <section className="book-library-summary">
      {items.map(({ icon: Icon, value, label }) => (
        <div key={label}>
          <Icon aria-hidden="true" />
          <strong>{value}</strong>
          <span>{label}</span>
        </div>
      ))}
    </section>
  );
}

function BookFilters({
  activeFilter,
  counts,
  onChange,
}: {
  activeFilter: BookFilter;
  counts: BookCounts;
  onChange: (filter: BookFilter) => void;
}) {
  return (
    <div
      className="book-filter-tabs"
      role="tablist"
      aria-label="Filtrar livros"
    >
      {FILTERS.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          className={
            activeFilter === key ? "text-button active" : "text-button"
          }
          onClick={() => onChange(key)}
          role="tab"
          aria-selected={activeFilter === key}
        >
          {label}
          <span>{counts[key]}</span>
        </button>
      ))}
    </div>
  );
}

function BookCard({
  book,
  onRequestDelete,
}: {
  book: Book;
  onRequestDelete: (book: Book) => void;
}) {
  const progress = getProgress(book);
  const isFinished = progress === 100;
  return (
    <article className="book-library-card">
      <div className="book-library-card-top">
        <span className={`book-status-dot${isFinished ? " finished" : ""}`} />
        <span className="book-status">
          {isFinished ? "Concluído" : "Em andamento"}
        </span>
        <button
          type="button"
          className="delete-session-button"
          title="Excluir livro"
          onClick={() => onRequestDelete(book)}
        >
          <Trash2 aria-hidden="true" />
        </button>
      </div>
      <h3>{book.title}</h3>
      <p>{book.author || "Livro sem autor"}</p>
      <span className="book-language-label">
        {languageLabel(book.language)}
      </span>
      <div className="book-library-progress">
        <span>
          <strong>{progress}%</strong>
          <small>
            {book.currentPage} de {book.totalPages} páginas
          </small>
        </span>
        <div className="book-progress-track">
          <span style={{ width: `${progress}%` }} />
        </div>
      </div>
      {!isFinished && (
        <Link
          className="text-button book-read-button"
          href={`/reading?book=${encodeURIComponent(book.id)}`}
        >
          Ler agora →
        </Link>
      )}
    </article>
  );
}

function CreateBookModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section
        className="modal book-create-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="book-create-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <span className="eyebrow">SUA BIBLIOTECA</span>
            <h2 id="book-create-title">Adicionar novo livro</h2>
          </div>
          <button
            className="modal-close"
            type="button"
            onClick={onClose}
            aria-label="Fechar"
          >
            ×
          </button>
        </div>
        <p className="modal-note">
          Cadastre os dados do livro para acompanhar sua evolução página por
          página.
        </p>
        <form className="new-book-form" onSubmit={onCreate}>
          <label>
            <span className="input-label">Título</span>
            <input
              className="field"
              placeholder="ex.: The Hobbit"
              name="title"
              required
              autoFocus
            />
          </label>
          <label>
            <span className="input-label">
              Autor <small>(opcional)</small>
            </span>
            <input
              className="field"
              placeholder="ex.: J. R. R. Tolkien"
              name="author"
            />
          </label>
          <label>
            <span className="input-label">Total de páginas</span>
            <input
              className="field"
              type="number"
              min="1"
              placeholder="ex.: 310"
              name="pages"
              required
            />
          </label>
          <label>
            <span className="input-label">Idioma do livro</span>
            <select className="field" name="language" defaultValue="en">
              <option value="en">Inglês</option>
              <option value="pt">Português</option>
            </select>
          </label>
          <div className="form-actions">
            <button className="button" type="submit">
              Cadastrar livro
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export function BooksPage() {
  const { state, ready, setState } = useWordtrail();
  const [filter, setFilter] = useState<BookFilter>("reading");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [bookToDelete, setBookToDelete] = useState<Book | null>(null);
  const counts = useMemo<BookCounts>(
    () => ({
      reading: state.books.filter((book) => getProgress(book) < 100).length,
      finished: state.books.filter((book) => getProgress(book) === 100).length,
      all: state.books.length,
    }),
    [state.books],
  );
  const books = useMemo(
    () =>
      state.books.filter(
        (book) =>
          filter === "all" ||
          (filter === "finished"
            ? getProgress(book) === 100
            : getProgress(book) < 100),
      ),
    [filter, state.books],
  );

  function createBook(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") || "").trim();
    const author = String(form.get("author") || "").trim();
    const totalPages = Number(form.get("pages"));
    const language = form.get("language") === "pt" ? "pt" : "en";
    if (!title || !Number.isInteger(totalPages) || totalPages < 1) return;
    const now = new Date().toISOString();
    setState((current) => ({
      ...current,
      books: [
        {
          id: crypto.randomUUID(),
          title,
          author: author || undefined,
          totalPages,
          currentPage: 0,
          createdAt: now,
          updatedAt: now,
          language,
        },
        ...current.books,
      ],
    }));
    setFilter("reading");
    setIsCreateModalOpen(false);
  }

  function deleteBook(bookId: string) {
    setState((current) => ({
      ...current,
      books: current.books.filter((book) => book.id !== bookId),
    }));
  }
  const emptyMessage = getEmptyMessage(filter);

  return (
    <section>
      <section className="page-intro">
        <span className="eyebrow">SUA BIBLIOTECA</span>
        <h1>Meus livros</h1>
      </section>
      <LibrarySummary
        counts={ready ? counts : { reading: 0, finished: 0, all: 0 }}
      />
      <section className="books-library-panel panel">
        <div className="section-heading books-heading">
          <div>
            <h2>Seu acervo</h2>
          </div>
          <button
            className="button"
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
          >
            <Plus aria-hidden="true" /> Novo livro
          </button>
        </div>
        <BookFilters
          activeFilter={filter}
          counts={counts}
          onChange={setFilter}
        />
        {books.length ? (
          <div className="book-library-grid">
            {books.map((book) => (
              <BookCard
                key={book.id}
                book={book}
                onRequestDelete={setBookToDelete}
              />
            ))}
          </div>
        ) : (
          <div className="empty-state book-empty-state">
            <strong>{emptyMessage.title}</strong>
            {emptyMessage.body}
          </div>
        )}
      </section>
      {isCreateModalOpen && (
        <CreateBookModal
          onClose={() => setIsCreateModalOpen(false)}
          onCreate={createBook}
        />
      )}
      {bookToDelete && (
        <ConfirmModal
          title="Excluir livro?"
          message={`O livro "${bookToDelete.title}" e seu progresso serão removidos.`}
          confirmLabel="Excluir livro"
          onCancel={() => setBookToDelete(null)}
          onConfirm={() => {
            deleteBook(bookToDelete.id);
            setBookToDelete(null);
          }}
        />
      )}
    </section>
  );
}
