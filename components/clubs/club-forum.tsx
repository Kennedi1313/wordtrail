"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  MessageCircle,
  Plus,
  Send,
  Users,
  X,
} from "lucide-react";
import {
  ClubMember,
  ClubPost,
  ClubReply,
  createClubPost,
  loadClubForum,
} from "@/services/club-service";

export function ClubForum({
  clubId,
  userId,
  members,
}: {
  clubId: string;
  userId: string;
  members: ClubMember[];
}) {
  const [posts, setPosts] = useState<ClubPost[]>([]);
  const [replies, setReplies] = useState<ClubReply[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  async function refresh() {
    const forum = await loadClubForum(clubId);
    setPosts(forum.posts);
    setReplies(forum.replies);
  }
  useEffect(() => {
    void refresh().catch((reason) =>
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível carregar o fórum.",
      ),
    );
  }, [clubId]);
  useEffect(() => {
    if (!isComposerOpen) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIsComposerOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isComposerOpen]);
  async function submitPost(event: FormEvent) {
    event.preventDefault();
    if (!title.trim() || !body.trim()) return;
    try {
      await createClubPost(clubId, userId, title.trim(), body.trim());
      setTitle("");
      setBody("");
      setIsComposerOpen(false);
      await refresh();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Não foi possível publicar.",
      );
    }
  }
  return (
    <section className="club-forum">
      <header className="club-forum-heading">
        <div className="club-forum-title">
          <span className="club-forum-icon">
            <MessageCircle size={20} />
          </span>
          <div>
            <h2>Tópicos do fórum</h2>
            <p>Abra uma conversa ou comece uma nova.</p>
          </div>
        </div>
        <div className="club-forum-tools">
          <span className="club-forum-count">
            <Users size={15} /> {members.length}{" "}
            {members.length === 1 ? "participante" : "participantes"}
          </span>
          <button
            className="button outline club-new-topic-button"
            type="button"
            aria-expanded={isComposerOpen}
            aria-haspopup="dialog"
            onClick={() => setIsComposerOpen((open) => !open)}
          >
            {isComposerOpen ? <X size={17} /> : <Plus size={17} />}
            {isComposerOpen ? "Fechar" : "Nova conversa"}
          </button>
        </div>
      </header>
      {isComposerOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setIsComposerOpen(false)}
        >
          <section
            className="modal club-new-conversation-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="club-new-conversation-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <span className="eyebrow">FÓRUM DO CLUBE</span>
                <h2 id="club-new-conversation-title">Nova conversa</h2>
              </div>
              <button
                className="modal-close"
                type="button"
                onClick={() => setIsComposerOpen(false)}
                aria-label="Fechar"
              >
                <X size={18} />
              </button>
            </div>
            <form className="club-composer" onSubmit={submitPost}>
              <div className="club-composer-heading">
                <span>Compartilhe uma ideia, dúvida ou trecho favorito.</span>
              </div>
              <label className="club-composer-field">
                <span>Título da conversa</span>
                <input
                  className="field"
                  placeholder="Ex.: O que acharam do capítulo?"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  autoFocus
                  required
                />
              </label>
              <label className="club-composer-field">
                <span>Sua mensagem</span>
                <textarea
                  className="field club-textarea"
                  placeholder="Escreva sua mensagem…"
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  required
                />
              </label>
              {error && <p className="result-status error">{error}</p>}
              <div className="club-composer-actions">
                <span>Todo mundo do clube poderá responder.</span>
                <div>
                  <button
                    className="button club-send-button"
                    type="submit"
                    aria-label="Publicar conversa"
                  >
                    <Send size={17} />
                    <span>Publicar</span>
                  </button>
                </div>
              </div>
            </form>
          </section>
        </div>
      )}
      {error && !isComposerOpen && (
        <p className="result-status error">{error}</p>
      )}
      <div className="club-thread-list">
        {posts.length ? (
          posts.map((post) => (
            <Link
              className="club-thread-row"
              href={`/clubs/${clubId}/threads/${post.id}`}
              key={post.id}
            >
              <span className="club-thread-icon">
                <MessageCircle size={18} />
              </span>
              <span className="club-thread-copy">
                <strong>{post.title}</strong>
                <small>
                  {post.author_id === userId ? "Você" : "Participante"} ·{" "}
                  {new Date(post.created_at).toLocaleDateString("pt-BR", {
                    day: "numeric",
                    month: "short",
                  })}
                </small>
                <small className="club-thread-preview">{post.body}</small>
              </span>
              <span className="club-thread-replies">
                <MessageCircle size={14} />{" "}
                {replies.filter((reply) => reply.post_id === post.id).length}
              </span>
              <ArrowUpRight className="club-thread-open" size={17} />
            </Link>
          ))
        ) : (
          <div className="empty-state">
            Nenhuma conversa ainda. Seja a primeira pessoa a publicar.
          </div>
        )}
      </div>
    </section>
  );
}
