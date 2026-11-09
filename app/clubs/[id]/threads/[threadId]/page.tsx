"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { Send, Trash2 } from "lucide-react";
import { ConfirmModal } from "@/components/shared/confirm-modal";
import { useWordtrail } from "@/hooks/use-wordtrail";
import {
  Club,
  ClubMember,
  ClubPost,
  ClubReply,
  createClubReply,
  deleteClubPost,
  deleteClubReply,
  loadClubThread,
  loadClubs,
} from "@/services/club-service";

export default function ClubThreadPage() {
  const { id, threadId } = useParams<{ id: string; threadId: string }>();
  const router = useRouter();
  const { userId } = useWordtrail();
  const [club, setClub] = useState<Club | null>(null);
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [post, setPost] = useState<ClubPost | null>(null);
  const [replies, setReplies] = useState<ClubReply[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [pendingDelete, setPendingDelete] = useState<
    { type: "post"; id: string } | { type: "reply"; id: string } | null
  >(null);
  const isAdmin = members.some(
    (member) => member.user_id === userId && member.role === "admin",
  );

  async function refresh() {
    const thread = await loadClubThread(id, threadId);
    setPost(thread.post);
    setReplies(thread.replies);
  }

  useEffect(() => {
    if (!id || !threadId || !userId) return;
    void Promise.all([loadClubs(userId), loadClubThread(id, threadId)])
      .then(([clubs, thread]) => {
        const view = clubs.find((item) => item.club.id === id);
        if (!view) throw new Error("Clube não encontrado.");
        setClub(view.club);
        setMembers(view.members);
        setPost(thread.post);
        setReplies(thread.replies);
      })
      .catch((reason) => {
        const message =
          reason instanceof Error
            ? reason.message
            : typeof reason === "object" && reason && "message" in reason
              ? String(reason.message)
              : "Não foi possível carregar a conversa.";
        setError(message);
      });
  }, [id, threadId, userId]);

  async function submitReply(event: FormEvent) {
    event.preventDefault();
    if (!userId || !draft.trim()) return;
    try {
      await createClubReply(threadId, userId, draft.trim());
      setDraft("");
      await refresh();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível responder.",
      );
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    if (pendingDelete.type === "post") {
      await deleteClubPost(pendingDelete.id);
      router.push(`/clubs/${id}`);
      return;
    }
    await deleteClubReply(pendingDelete.id);
    setPendingDelete(null);
    await refresh();
  }

  if (error)
    return (
      <section className="empty-state">
        <strong>{error}</strong>
        <Link className="text-button" href={`/clubs/${id}`}>
          Voltar ao clube
        </Link>
      </section>
    );
  if (!club || !post || !userId) return <main aria-busy="true" />;

  return (
    <section>
      <Link className="text-button club-back-link" href={`/clubs/${id}`}>
        ← Voltar ao clube
      </Link>
      <div className="club-thread-detail-heading">
        <span className="eyebrow">FÓRUM · {club.name}</span>
        <h1>{post.title}</h1>
        <p>
          {post.author_id === userId ? "Você" : "Participante"} ·{" "}
          {new Date(post.created_at).toLocaleDateString("pt-BR", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
      </div>
      <article className="panel club-thread-original">
        <div className="club-thread-original-top">
          <span className="club-post-avatar">
            {post.author_id === userId ? "V" : "L"}
          </span>
          <strong>{post.author_id === userId ? "Você" : "Participante"}</strong>
          {(isAdmin || post.author_id === userId) && (
            <button
              className="club-icon-action"
              type="button"
              onClick={() => setPendingDelete({ type: "post", id: post.id })}
              aria-label="Excluir conversa"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
        <p>{post.body}</p>
      </article>
      <section className="club-thread-reply-section">
        <div className="section-heading">
          <div>
            <h2>Respostas</h2>
            <p>
              {replies.length} {replies.length === 1 ? "resposta" : "respostas"}
            </p>
          </div>
        </div>
        <div className="club-thread-reply-list">
          {replies.map((reply) => (
            <article className="panel club-thread-reply" key={reply.id}>
              <div className="club-thread-original-top">
                <span className="club-reply-avatar">
                  {reply.author_id === userId ? "V" : "L"}
                </span>
                <strong>
                  {reply.author_id === userId ? "Você" : "Participante"}
                </strong>
                <small>
                  {new Date(reply.created_at).toLocaleDateString("pt-BR", {
                    day: "numeric",
                    month: "short",
                  })}
                </small>
                {(isAdmin || reply.author_id === userId) && (
                  <button
                    className="club-icon-action"
                    type="button"
                    onClick={() =>
                      setPendingDelete({ type: "reply", id: reply.id })
                    }
                    aria-label="Excluir resposta"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
              <p>{reply.body}</p>
            </article>
          ))}
          {!replies.length && (
            <div className="empty-state">
              Ainda não há respostas. Comece a conversa.
            </div>
          )}
        </div>
        <form className="club-thread-reply-composer" onSubmit={submitReply}>
          <textarea
            className="field club-textarea"
            placeholder="Escreva uma resposta…"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            required
          />
          <button className="button club-send-button" type="submit">
            <Send size={17} /> Responder
          </button>
        </form>
      </section>
      {pendingDelete && (
        <ConfirmModal
          title={
            pendingDelete.type === "post"
              ? "Excluir conversa?"
              : "Excluir resposta?"
          }
          message="Esta ação não pode ser desfeita."
          confirmLabel="Excluir"
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => void confirmDelete()}
        />
      )}
    </section>
  );
}
