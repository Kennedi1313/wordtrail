"use client";
import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Crown, Hash, Plus, Users } from "lucide-react";
import { useWordtrail } from "@/hooks/use-wordtrail";
import { ConfirmModal } from "@/components/shared/confirm-modal";
import {
  Club,
  ClubMember,
  createClub,
  buildClubReadingProfile,
  joinClub,
  loadClubs,
  syncClubReadingProfile,
} from "@/services/club-service";

type ClubView = { club: Club; members: ClubMember[] };
export default function ClubsPage() {
  const { userId, state, settings, displayName } = useWordtrail();
  const [clubs, setClubs] = useState<ClubView[]>([]);
  const [name, setName] = useState("");
  const [bookTitle, setBookTitle] = useState("");
  const [bookAuthor, setBookAuthor] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [pendingInviteCode, setPendingInviteCode] = useState("");
  const [message, setMessage] = useState("");
  async function refresh() {
    if (userId) setClubs(await loadClubs(userId));
  }
  useEffect(() => {
    void refresh().catch((error) => setMessage(error.message));
  }, [userId]);
  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!userId) return setMessage("Faça login para criar um clube.");
    try {
      await createClub(userId, { name, bookTitle, bookAuthor });
      void syncClubReadingProfile(
        userId,
        buildClubReadingProfile(state, settings, displayName),
      ).catch((error) => console.error("Club profile sync failed", error));
      setName("");
      setBookTitle("");
      setBookAuthor("");
      setMessage("Clube criado.");
      await refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível criar o clube.",
      );
    }
  }
  function handleJoin(event: FormEvent) {
    event.preventDefault();
    if (!userId) return setMessage("Faça login para entrar em um clube.");
    setPendingInviteCode(inviteCode.trim().toUpperCase());
  }
  async function confirmJoin() {
    if (!userId || !pendingInviteCode) return;
    try {
      await joinClub(userId, pendingInviteCode);
      void syncClubReadingProfile(
        userId,
        buildClubReadingProfile(state, settings, displayName),
      ).catch((error) => console.error("Club profile sync failed", error));
      setInviteCode("");
      setPendingInviteCode("");
      setMessage("Você entrou no clube.");
      await refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível entrar no clube.",
      );
    }
  }
  return (
    <section>
      <section className="page-intro">
        <span className="eyebrow">LEITURA EM GRUPO</span>
        <h1>Clubes do livro</h1>
        <p>Crie um grupo, convide pessoas e acompanhe a leitura juntos.</p>
      </section>
      <div className="club-actions">
        <form className="panel club-form" onSubmit={handleCreate}>
          <div className="club-form-heading">
            <span className="club-form-icon">
              <Plus size={20} />
            </span>
            <div>
              <h2>Criar clube</h2>
              <p>Comece uma leitura em grupo.</p>
            </div>
          </div>
          <input
            className="field"
            placeholder="Nome do clube"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
          <input
            className="field"
            placeholder="Livro atual"
            value={bookTitle}
            onChange={(event) => setBookTitle(event.target.value)}
            required
          />
          <input
            className="field"
            placeholder="Autor (opcional)"
            value={bookAuthor}
            onChange={(event) => setBookAuthor(event.target.value)}
          />
          <button className="button club-form-submit" type="submit">
            <Plus size={17} />
            Criar clube
          </button>
        </form>
        <form className="panel club-form" onSubmit={handleJoin}>
          <div className="club-form-heading">
            <span className="club-form-icon club-form-icon-alt">
              <Hash size={20} />
            </span>
            <div>
              <h2>Entrar em um clube</h2>
              <p>Use o código de convite de alguém.</p>
            </div>
          </div>
          <input
            className="field"
            placeholder="Código do convite"
            value={inviteCode}
            onChange={(event) => setInviteCode(event.target.value)}
            required
          />
          <button className="button outline" type="submit">
            <Users size={17} />
            Entrar como participante
          </button>
        </form>
      </div>
      {message && <p className="result-status">{message}</p>}
      {pendingInviteCode && (
        <ConfirmModal
          title="Entrar neste clube?"
          message="Ao participar, as pessoas do clube poderão ver seu perfil de leitura, incluindo seu livro atual, sua meta diária e seu progresso."
          confirmLabel="Entrar no clube"
          onCancel={() => setPendingInviteCode("")}
          onConfirm={() => void confirmJoin()}
        />
      )}
      <div className="club-list-heading">
        <div>
          <h2>Seus clubes</h2>
          <p>Continue a conversa e acompanhe a leitura.</p>
        </div>
        <span className="club-list-count">
          {clubs.length} {clubs.length === 1 ? "clube" : "clubes"}
        </span>
      </div>
      <div className="book-library-grid">
        {clubs.map(({ club, members }) => {
          const mine = members.find((member) => member.user_id === userId);
          return (
            <Link
              className="book-library-card club-card-link"
              href={`/clubs/${club.id}`}
              key={club.id}
            >
              <div className="book-library-card-top">
                <span className="book-status-dot" />
                <span className="book-status">
                  {mine?.role === "admin" ? "Admin" : "Participante"}
                </span>
                <span className="club-list-role-icon">
                  {mine?.role === "admin" ? (
                    <Crown size={15} />
                  ) : (
                    <Users size={15} />
                  )}
                </span>
              </div>
              <h3>{club.name}</h3>
              <p>
                {club.book_title}
                {club.book_author ? ` · ${club.book_author}` : ""}
              </p>
              <div className="club-list-card-footer">
                <span>{members.length} participantes</span>
                <span className="club-card-open">
                  Abrir clube <ArrowUpRight size={16} />
                </span>
              </div>
              <span className="book-language-label">
                <Hash size={13} /> {club.invite_code}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
