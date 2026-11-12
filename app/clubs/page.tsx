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
  const { userId, state, settings, displayName, ready } = useWordtrail();
  const [clubs, setClubs] = useState<ClubView[]>([]);
  const [clubsLoaded, setClubsLoaded] = useState(false);
  const [name, setName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [pendingInviteCode, setPendingInviteCode] = useState("");
  const [message, setMessage] = useState("");
  async function refresh() {
    if (!userId) return;
    setClubsLoaded(false);
    try {
      setClubs(await loadClubs(userId));
    } finally {
      setClubsLoaded(true);
    }
  }
  useEffect(() => {
    void refresh().catch((error) => setMessage(error.message));
  }, [userId]);
  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!userId) return setMessage("Faça login para criar um clube.");
    try {
      await createClub({ name });
      setName("");
      await refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível criar o clube.",
      );
      return;
    }
    try {
      await syncClubReadingProfile(userId, buildClubReadingProfile(state, settings, displayName));
      setMessage("Clube criado.");
    } catch {
      setMessage("Clube criado, mas não foi possível sincronizar seu perfil de leitura.");
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
      await joinClub(pendingInviteCode);
      setInviteCode("");
      setPendingInviteCode("");
      await refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível entrar no clube.",
      );
      return;
    }
    try {
      await syncClubReadingProfile(userId, buildClubReadingProfile(state, settings, displayName));
      setMessage("Você entrou no clube.");
    } catch {
      setMessage("Você entrou no clube, mas não foi possível sincronizar seu perfil de leitura.");
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
      {!ready || !clubsLoaded ? (
        <div className="server-data-loading" role="status">
          <span className="loading-spinner" aria-hidden="true" />
          <span>Carregando seus clubes…</span>
        </div>
      ) : (
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
                Clube de leitura
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
      )}
    </section>
  );
}
