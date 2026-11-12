"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { GoalCard } from "@/components/shared/goal-card";
import { StartCard } from "@/components/shared/start-card";
import { StatCards } from "@/components/shared/stat-cards";
import { Club, ClubMember, deleteClub, loadClubs } from "@/services/club-service";
import { useWordtrail } from "@/hooks/use-wordtrail";
import { ClubForum } from "@/components/clubs/club-forum";
import { ArrowRight, Check, Copy, Hash, Trash2, Users } from "lucide-react";
import { ConfirmModal } from "@/components/shared/confirm-modal";

function getProfilePagesRead(
  member: ClubMember | undefined,
  sessions: ReturnType<typeof useWordtrail>["state"]["readingSessions"],
) {
  if (!member) return 0;
  return sessions.length
    ? sessions.reduce(
        (total, session) => total + Math.max(0, session.pages || 0),
        0,
      )
    : member.pages_read;
}

export default function ClubDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { userId, state, settings, ready } = useWordtrail();
  const [club, setClub] = useState<Club | null>(null);
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [error, setError] = useState("");
  const [copyStatus, setCopyStatus] = useState<"copied" | "failed" | null>(
    null,
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function copyInviteCode() {
    try {
      await navigator.clipboard.writeText(club?.invite_code || "");
      setCopyStatus("copied");
      window.setTimeout(() => setCopyStatus(null), 2000);
    } catch {
      setCopyStatus("failed");
      window.setTimeout(() => setCopyStatus(null), 3000);
    }
  }

  useEffect(() => {
    if (!userId || !id) return;
    void loadClubs(userId)
      .then((clubs) => {
        const found = clubs.find((item) => item.club.id === id);
        if (!found) throw new Error("Clube não encontrado.");
        setClub(found.club);
        setMembers(found.members);
      })
      .catch((reason) =>
        setError(
          reason instanceof Error
            ? reason.message
            : "Não foi possível carregar o clube.",
        ),
      );
  }, [id, userId]);

  if (error)
    return (
      <section className="empty-state">
        <strong>{error}</strong>
        <Link className="text-button" href="/clubs">
          Voltar para clubes
        </Link>
      </section>
    );
  if (!club || !userId) return <main aria-busy="true" />;

  const currentMember = members.find((member) => member.user_id === userId);
  const isAdmin = currentMember?.role === "admin";
  const currentPagesRead = getProfilePagesRead(
    currentMember,
    state.readingSessions,
  );
  const pagesByMember = new Map(
    members.map((member) => [
      member.user_id,
      member.user_id === userId ? currentPagesRead : member.pages_read,
    ]),
  );
  const ranking = [...members].sort(
    (a, b) =>
      (pagesByMember.get(b.user_id) || 0) - (pagesByMember.get(a.user_id) || 0),
  );
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Fortaleza",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const todaySessions = ready
    ? state.readingSessions.filter((session) => {
        const sessionDate =
          session.date || session.createdAt || session.startedAt;
        return (
          new Intl.DateTimeFormat("en-CA", {
            timeZone: "America/Fortaleza",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }).format(new Date(sessionDate)) === today
        );
      })
    : [];
  const minutesRead = Math.floor(
    todaySessions.reduce(
      (total, session) =>
        total + (session.seconds || session.durationSeconds || 0),
      0,
    ) / 60,
  );
  const currentRank =
    ranking.findIndex((member) => member.user_id === userId) + 1;
  const totalPagesRead = members.reduce(
    (total, member) => total + (pagesByMember.get(member.user_id) || 0),
    0,
  );

  return (
    <section>
      <Link className="text-button club-back-link" href="/clubs">
        ← Todos os clubes
      </Link>
      <section className="home-grid club-home-grid">
        <StartCard
          className="club-identity-card"
          eyebrow="CLUBE DE LEITURA"
          title={club.name}
          description="Converse, acompanhe o ranking e mantenha o grupo por perto."
          children={
            <div className="club-identity-meta">
              <span><Users aria-hidden="true" /> <strong>{members.length}</strong> participantes</span>
              <span><Hash aria-hidden="true" /> código <strong>{club.invite_code}</strong></span>
            </div>
          }
          action={
            <div className="club-identity-actions">
              <button
                className="button club-invite-action"
                type="button"
                onClick={() => void copyInviteCode()}
              >
                {copyStatus === "copied" ? <Check size={17} /> : <Copy size={17} />}
                {copyStatus === "copied"
                  ? "Convite copiado!"
                  : copyStatus === "failed"
                    ? "Tente copiar novamente"
                    : "Copiar convite"}
              </button>
              {isAdmin && (
                <button
                  className="club-delete-button"
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  disabled={deleting}
                >
                  <Trash2 size={15} aria-hidden="true" />
                  Excluir clube
                </button>
              )}
            </div>
          }
        />
        <GoalCard
          title="Sua meta de leitura"
          value={minutesRead}
          total={settings.dailyGoal}
          unit="minutos lidos"
          caption={`de ${settings.dailyGoal} minutos hoje`}
          action={
            <Link className="text-button" href="/reading">
              Ler agora +
            </Link>
          }
        />
      </section>
      <StatCards
        className="club-status-row"
        items={[
          { value: members.length, label: "participantes" },
          { value: totalPagesRead, label: "páginas lidas pelo clube" },
          {
            value: currentPagesRead,
            label: "suas páginas lidas no total",
          },
          { value: currentRank || "—", label: "sua posição no ranking" },
        ]}
      />
      <Link
        className="panel club-participants-card"
        href={`/clubs/${club.id}/members`}
      >
        <span className="club-participants-icon">
          <Users size={21} />
        </span>
        <span className="club-participants-copy">
          <span className="eyebrow">COMUNIDADE</span>
          <strong>Participantes</strong>
          <small>
            {members.length} {members.length === 1 ? "pessoa" : "pessoas"} lendo
            com você
          </small>
        </span>
        <span className="club-participants-action">
          Ver lista <ArrowRight size={17} />
        </span>
      </Link>
      <div id="club-forum">
        <ClubForum clubId={club.id} userId={userId} members={members} />
      </div>
      {confirmDelete && (
        <ConfirmModal
          title="Excluir clube?"
          message="O clube, participantes, tópicos e respostas serão removidos permanentemente."
          confirmLabel={deleting ? "Excluindo…" : "Excluir clube"}
          onCancel={() => {
            if (!deleting) setConfirmDelete(false);
          }}
          onConfirm={() => {
            if (deleting) return;
            setDeleting(true);
            void deleteClub(club.id, userId)
              .then(() => router.replace("/clubs"))
              .catch((reason) => {
                setDeleting(false);
                setError(
                  reason instanceof Error
                    ? reason.message
                    : "Não foi possível excluir o clube.",
                );
                setConfirmDelete(false);
              });
          }}
        />
      )}
    </section>
  );
}
