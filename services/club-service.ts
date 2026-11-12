import { supabase } from "@/lib/supabase/client";
import { AppState, UserSettings } from "@/types/domain";

export type Club = {
  id: string;
  name: string;
  invite_code: string;
  book_title?: string | null;
  book_author?: string;
  created_by: string;
  created_at: string;
};
export type ClubMember = {
  club_id: string;
  user_id: string;
  role: "admin" | "member";
  pages_read: number;
  joined_at: string;
  reading_profile?: ClubReadingProfile;
};
export type ClubReadingProfile = {
  displayName: string;
  lastBookTitle: string;
  lastBookAuthor: string;
  lastReadAt: string | null;
  dailyGoalMinutes: number;
  minutesReadToday: number;
  totalPagesRead: number;
};
export type ClubPost = {
  id: string;
  club_id: string;
  author_id: string;
  title: string;
  body: string;
  created_at: string;
};
export type ClubReply = {
  id: string;
  post_id: string;
  author_id: string;
  body: string;
  created_at: string;
};

function requireClient() {
  if (!supabase) throw new Error("Supabase não está configurado.");
  return supabase;
}
function localDateKey(value: string | Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Fortaleza",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

export function buildClubReadingProfile(
  state: AppState,
  settings: UserSettings,
  displayName: string,
): ClubReadingProfile {
  const sessions = [...state.readingSessions].sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
  );
  const latestSession = sessions[0];
  const lastBook = latestSession?.bookId
    ? state.books.find((book) => book.id === latestSession.bookId)
    : undefined;
  const today = localDateKey(new Date());
  const minutesReadToday = Math.floor(
    sessions
      .filter((session) =>
        localDateKey(session.date || session.startedAt).startsWith(today),
      )
      .reduce(
        (total, session) =>
          total + (session.seconds || session.durationSeconds || 0),
        0,
      ) / 60,
  );
  return {
    displayName: displayName.trim() || "Leitor",
    lastBookTitle: lastBook?.title || latestSession?.title || "",
    lastBookAuthor: lastBook?.author || "",
    lastReadAt: latestSession?.startedAt || null,
    dailyGoalMinutes: Math.max(1, settings.dailyGoal || 30),
    minutesReadToday,
    totalPagesRead: sessions.reduce(
      (total, session) => total + Math.max(0, session.pages || 0),
      0,
    ),
  };
}

export async function syncClubReadingProfile(
  userId: string,
  profile: ClubReadingProfile,
) {
  const client = requireClient();
  const { data: memberships, error } = await client
    .from("wordtrail_club_members")
    .select("club_id, pages_read, reading_profile")
    .eq("user_id", userId);
  if (error) throw error;
  const profileJson = JSON.stringify(profile);
  const updates = (memberships || []).filter(
    (member) =>
      member.pages_read !== profile.totalPagesRead ||
      JSON.stringify(member.reading_profile || {}) !== profileJson,
  );
  const results = await Promise.all(
    updates.map((member) =>
      client
        .from("wordtrail_club_members")
        .update({
          pages_read: profile.totalPagesRead,
          reading_profile: profile,
        })
        .eq("club_id", member.club_id)
        .eq("user_id", userId),
    ),
  );
  const failed = results.find((result) => result.error);
  if (failed?.error) throw failed.error;
}
export async function createClub(input: { name: string }) {
  const client = requireClient();
  const name = input.name.trim();
  if (name.length < 1 || name.length > 80)
    throw new Error("O nome do clube deve ter entre 1 e 80 caracteres.");
  const { data, error } = await client.rpc("create_wordtrail_club", {
    club_name: name,
  });
  if (error) throw error;
  return data as { club: Club; member: ClubMember };
}
export async function joinClub(inviteCode: string) {
  const client = requireClient();
  const code = inviteCode.trim().toUpperCase();
  if (code.length < 6 || code.length > 16)
    throw new Error("Informe um código de convite válido.");
  const { data, error } = await client.rpc("join_wordtrail_club", {
    invite_token: code,
  });
  if (error) throw error;
  return data as { club: Club; member: ClubMember };
}
export async function loadClubs(userId: string) {
  const client = requireClient();
  const memberships = await client
    .from("wordtrail_club_members")
    .select()
    .eq("user_id", userId);
  if (memberships.error) throw memberships.error;
  const ids = memberships.data.map((item) => item.club_id);
  if (!ids.length) return [] as Array<{ club: Club; members: ClubMember[] }>;
  const [clubs, members] = await Promise.all([
    client.from("wordtrail_clubs").select().in("id", ids),
    client.from("wordtrail_club_members").select().in("club_id", ids),
  ]);
  if (clubs.error) throw clubs.error;
  if (members.error) throw members.error;
  return (clubs.data as Club[]).map((club) => ({
    club,
    members: members.data.filter(
      (member) => member.club_id === club.id,
    ) as ClubMember[],
  }));
}
export async function updateClubProgress(
  clubId: string,
  userId: string,
  pagesRead: number,
) {
  const result = await requireClient()
    .from("wordtrail_club_members")
    .update({ pages_read: Math.max(0, Math.floor(pagesRead)) })
    .eq("club_id", clubId)
    .eq("user_id", userId);
  if (result.error) throw result.error;
}

export async function deleteClub(clubId: string, userId: string) {
  const result = await requireClient()
    .from("wordtrail_clubs")
    .delete()
    .eq("id", clubId)
    .eq("created_by", userId);
  if (result.error) throw result.error;
}

export async function loadClubForum(clubId: string) {
  const client = requireClient();
  const [posts, replies] = await Promise.all([
    client
      .from("wordtrail_club_posts")
      .select()
      .eq("club_id", clubId)
      .order("created_at", { ascending: false }),
    client
      .from("wordtrail_club_replies")
      .select("*, wordtrail_club_posts!inner(club_id)")
      .eq("wordtrail_club_posts.club_id", clubId)
      .order("created_at"),
  ]);
  if (posts.error) throw posts.error;
  if (replies.error) throw replies.error;
  return {
    posts: posts.data as ClubPost[],
    replies: replies.data as ClubReply[],
  };
}

export async function loadClubThread(clubId: string, postId: string) {
  const client = requireClient();
  const [postResult, repliesResult] = await Promise.all([
    client
      .from("wordtrail_club_posts")
      .select()
      .eq("club_id", clubId)
      .eq("id", postId)
      .single(),
    client
      .from("wordtrail_club_replies")
      .select()
      .eq("post_id", postId)
      .order("created_at"),
  ]);
  if (postResult.error) throw postResult.error;
  if (repliesResult.error) throw repliesResult.error;
  return {
    post: postResult.data as ClubPost,
    replies: repliesResult.data as ClubReply[],
  };
}

export async function createClubPost(
  clubId: string,
  userId: string,
  title: string,
  body: string,
) {
  const normalizedTitle = title.trim();
  const normalizedBody = body.trim();
  if (!clubId || normalizedTitle.length < 1 || normalizedTitle.length > 120)
    throw new Error("O título deve ter entre 1 e 120 caracteres.");
  if (normalizedBody.length < 1 || normalizedBody.length > 5000)
    throw new Error("O texto deve ter entre 1 e 5000 caracteres.");
  const result = await requireClient()
    .from("wordtrail_club_posts")
    .insert({ club_id: clubId, author_id: userId, title: normalizedTitle, body: normalizedBody });
  if (result.error) throw result.error;
}

export async function createClubReply(
  postId: string,
  userId: string,
  body: string,
) {
  const normalizedBody = body.trim();
  if (!postId || normalizedBody.length < 1 || normalizedBody.length > 3000)
    throw new Error("A resposta deve ter entre 1 e 3000 caracteres.");
  const result = await requireClient()
    .from("wordtrail_club_replies")
    .insert({ post_id: postId, author_id: userId, body: normalizedBody });
  if (result.error) throw result.error;
}

export async function deleteClubPost(postId: string) {
  const result = await requireClient()
    .from("wordtrail_club_posts")
    .delete()
    .eq("id", postId);
  if (result.error) throw result.error;
}

export async function deleteClubReply(replyId: string) {
  const result = await requireClient()
    .from("wordtrail_club_replies")
    .delete()
    .eq("id", replyId);
  if (result.error) throw result.error;
}
