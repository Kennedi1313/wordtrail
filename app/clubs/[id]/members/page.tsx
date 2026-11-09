"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowUpRight, BookOpen, Clock3, Crown } from "lucide-react";
import { useWordtrail } from "@/hooks/use-wordtrail";
import {
  buildClubReadingProfile,
  Club,
  ClubMember,
  ClubReadingProfile,
  loadClubs,
} from "@/services/club-service";

export default function ClubMembersPage() {
  const { id } = useParams<{ id: string }>();
  const { userId, state, settings, displayName } = useWordtrail();
  const [club, setClub] = useState<Club | null>(null);
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [selected, setSelected] = useState<ClubMember | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id || !userId) return;
    void loadClubs(userId)
      .then((clubs) => {
        const view = clubs.find((item) => item.club.id === id);
        if (!view) throw new Error("Clube não encontrado.");
        setClub(view.club);
        setMembers(view.members);
      })
      .catch((reason) =>
        setError(
          reason instanceof Error
            ? reason.message
            : "Não foi possível carregar os participantes.",
        ),
      );
  }, [id, userId]);

  if (error)
    return (
      <section className="empty-state">
        <strong>{error}</strong>
      </section>
    );
  if (!club || !userId) return <main aria-busy="true" />;
  const ranking = [...members].sort((a, b) => b.pages_read - a.pages_read);
  const ownProfile = buildClubReadingProfile(state, settings, displayName);
  const profileFor = (member: ClubMember): ClubReadingProfile =>
    member.user_id === userId
      ? ownProfile
      : {
          displayName: "Participante",
          lastBookTitle: "",
          lastBookAuthor: "",
          lastReadAt: null,
          dailyGoalMinutes: 30,
          minutesReadToday: 0,
          totalPagesRead: member.pages_read,
          ...member.reading_profile,
        };
  const selectedProfile = selected ? profileFor(selected) : null;
  const selectedProgress = selectedProfile
    ? Math.min(
        100,
        Math.round(
          (selectedProfile.minutesReadToday /
            selectedProfile.dailyGoalMinutes) *
            100,
        ),
      )
    : 0;

  return (
    <section>
      <Link className="text-button club-back-link" href={`/clubs/${club.id}`}>
        ← Voltar ao clube
      </Link>
      <section className="page-intro">
        <span className="eyebrow">{club.name}</span>
        <h1>Participantes</h1>
        <p>Conheça quem está lendo “{club.book_title}” com você.</p>
      </section>
      <div className="club-member-grid">
        {ranking.map((member, index) => {
          const profile = profileFor(member);
          const progress = Math.min(
            100,
            Math.round(
              (profile.minutesReadToday / profile.dailyGoalMinutes) * 100,
            ),
          );
          return (
            <button
              className="panel club-member-card"
              key={member.user_id}
              type="button"
              onClick={() => setSelected(member)}
            >
              <div className={`club-member-avatar club-avatar-${index % 4}`}>
                {profile.displayName.slice(0, 1).toUpperCase()}
              </div>
              <div className="club-member-card-heading">
                <span className="eyebrow">
                  {member.role === "admin" ? (
                    <>
                      <Crown size={12} /> ADMIN ·
                    </>
                  ) : (
                    <>#{index + 1} NO RANKING ·</>
                  )}{" "}
                  {member.user_id === userId ? "VOCÊ" : "PARTICIPANTE"}
                </span>
                <h3>{profile.displayName}</h3>
              </div>
              <ArrowUpRight className="club-member-arrow" size={19} />
              <div className="club-member-card-details">
                <span className="club-member-last-book">
                  <BookOpen size={15} />
                  {profile.lastBookTitle || "Ainda sem livro registrado"}
                  {profile.lastBookAuthor ? ` · ${profile.lastBookAuthor}` : ""}
                </span>
                <div className="club-member-goal">
                  <div className="club-member-goal-caption">
                    <span>
                      <Clock3 size={14} /> Meta diária
                    </span>
                    <strong>
                      {profile.minutesReadToday}/{profile.dailyGoalMinutes} min
                    </strong>
                  </div>
                  <div
                    className="club-member-goal-track"
                    role="progressbar"
                    aria-label={`Meta diária de ${profile.displayName}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={progress}
                  >
                    <span style={{ width: `${progress}%` }} />
                  </div>
                </div>
                <span className="club-member-pages-total">
                  <strong>{profile.totalPagesRead}</strong> páginas lidas no
                  total
                </span>
              </div>
            </button>
          );
        })}
      </div>
      {selected && selectedProfile && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setSelected(null)}
        >
          <section
            className="modal club-member-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="club-member-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <span className="eyebrow">PERFIL DE LEITURA</span>
                <h2 id="club-member-title">{selectedProfile.displayName}</h2>
              </div>
              <button
                className="modal-close"
                type="button"
                onClick={() => setSelected(null)}
                aria-label="Fechar"
              >
                ×
              </button>
            </div>
            <div className="club-member-modal-summary">
              <div>
                <strong>{selectedProfile.totalPagesRead}</strong>
                <span>páginas lidas no total</span>
              </div>
              <div>
                <strong>{selectedProfile.minutesReadToday} min</strong>
                <span>lidos hoje</span>
              </div>
              <div>
                <strong>{selectedProfile.dailyGoalMinutes} min</strong>
                <span>meta diária</span>
              </div>
              <div>
                <strong>
                  {selected.role === "admin" ? "Admin" : "Membro"}
                </strong>
                <span>papel no clube</span>
              </div>
            </div>
            <div className="club-member-modal-book">
              <span className="club-profile-book-icon">
                <BookOpen size={21} />
              </span>
              <div>
                <span className="eyebrow">ÚLTIMO LIVRO LIDO</span>
                <strong>
                  {selectedProfile.lastBookTitle ||
                    "Ainda sem livro registrado"}
                </strong>
                {selectedProfile.lastBookAuthor && (
                  <small>{selectedProfile.lastBookAuthor}</small>
                )}
                {selectedProfile.lastReadAt && (
                  <small>
                    Leu por último em{" "}
                    {new Date(selectedProfile.lastReadAt).toLocaleDateString(
                      "pt-BR",
                      { day: "numeric", month: "long" },
                    )}
                  </small>
                )}
              </div>
            </div>
            <div className="club-member-modal-goal">
              <div className="club-member-goal-caption">
                <span>Meta de leitura de hoje</span>
                <strong>
                  {selectedProfile.minutesReadToday} de{" "}
                  {selectedProfile.dailyGoalMinutes} min · {selectedProgress}%
                </strong>
              </div>
              <div
                className="club-member-goal-track"
                role="progressbar"
                aria-label="Progresso da meta diária"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={selectedProgress}
              >
                <span style={{ width: `${selectedProgress}%` }} />
              </div>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
