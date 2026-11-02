import { isSupabaseConfigured, supabase } from "./supabase.js";

const STORAGE_KEY = "wordtrail-data-v1";
const SETTINGS_KEY = "wordtrail-settings-v1";
const SYNC_TABLE = "wordtrail_user_data";
const DAY = 24 * 60 * 60 * 1000;
const DEFAULT_STATE = { words: [], readingSessions: [], reviews: [], activeReadingSession: null };
const DEFAULT_SETTINGS = { dailyGoal: 30 };

const view = document.querySelector("#view");
const toastElement = document.querySelector("#toast");
let state = loadState();
let settings = loadSettings();
let currentPage = state.activeReadingSession ? "reading" : "home";
let searchResult = null;
let searchBusy = false;
let searchToken = 0;
let suggestionToken = 0;
let suggestionTimeout;
let activeSuggestionIndex = -1;
let toastTimeout;
let practiceMode = "flashcard";
let practiceSource = "vocabulary";
let practiceSession = null;
let practiceLoading = false;
let practiceSummary = null;
let practiceTimer;
let readingTimer;
let wordsFilter = "";
let pendingDeleteReadingSessionId = null;
let sessionUser = null;
let authReady = !isSupabaseConfigured;
let syncTimeout;
let syncQueue = Promise.resolve();
let activeAccountLoad = 0;

function loadState() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!stored || !Array.isArray(stored.words) || !Array.isArray(stored.readingSessions) || !Array.isArray(stored.reviews)) return structuredClone(DEFAULT_STATE);
    return { ...DEFAULT_STATE, ...stored };
  } catch (error) {
    console.error("Could not read saved Wordtrail data.", error);
    return structuredClone(DEFAULT_STATE);
  }
}

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    return { dailyGoal: saved.dailyGoal ?? DEFAULT_SETTINGS.dailyGoal };
  } catch (error) {
    console.error("Could not read Wordtrail settings.", error);
    return { ...DEFAULT_SETTINGS };
  }
}

function persist() {
  try {
    const key = sessionUser ? `${STORAGE_KEY}:${sessionUser.id}` : STORAGE_KEY;
    localStorage.setItem(key, JSON.stringify(state));
    scheduleCloudSync();
    return true;
  } catch (error) {
    console.error("Could not save Wordtrail data.", error);
    showToast("Não consegui salvar no armazenamento deste navegador. Confira o espaço disponível.", true);
    return false;
  }
}

function persistSettings() {
  try {
    const key = sessionUser ? `${SETTINGS_KEY}:${sessionUser.id}` : SETTINGS_KEY;
    localStorage.setItem(key, JSON.stringify(settings));
    scheduleCloudSync();
    return true;
  } catch (error) {
    console.error("Could not save Wordtrail settings.", error);
    showToast("Não consegui salvar as configurações neste navegador.", true);
    return false;
  }
}

function readLocalState(key) {
  try {
    const stored = JSON.parse(localStorage.getItem(key) || "null");
    if (!stored || !Array.isArray(stored.words) || !Array.isArray(stored.readingSessions) || !Array.isArray(stored.reviews)) return structuredClone(DEFAULT_STATE);
    return { ...structuredClone(DEFAULT_STATE), ...stored };
  } catch (error) {
    console.error("Could not read local Wordtrail data for account migration.", error);
    return structuredClone(DEFAULT_STATE);
  }
}

function readLocalSettings(key) {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || "{}");
    return { dailyGoal: saved.dailyGoal ?? DEFAULT_SETTINGS.dailyGoal };
  } catch (error) {
    console.error("Could not read local Wordtrail settings for account migration.", error);
    return { ...DEFAULT_SETTINGS };
  }
}

function mergeAccountData(primaryState, secondaryState) {
  const words = new Map((primaryState.words || []).map((word) => [word.normalized, { ...word }]));
  for (const word of secondaryState.words || []) {
    const primary = words.get(word.normalized);
    if (!primary) {
      words.set(word.normalized, { ...word });
      continue;
    }
    words.set(word.normalized, {
      ...word,
      ...primary,
      lookups: Math.max(primary.lookups || 0, word.lookups || 0),
      firstSearchedAt: [primary.firstSearchedAt, word.firstSearchedAt].filter(Boolean).sort()[0],
      lastSearchedAt: [primary.lastSearchedAt, word.lastSearchedAt].filter(Boolean).sort().at(-1),
      definition: primary.definition || word.definition,
      translation: primary.translation || word.translation,
      translationOptions: primary.translationOptions?.length ? primary.translationOptions : word.translationOptions,
      phonetic: primary.phonetic || word.phonetic,
      audio: primary.audio || word.audio
    });
  }
  const sessions = new Map();
  for (const session of [...(secondaryState.readingSessions || []), ...(primaryState.readingSessions || [])]) {
    sessions.set(session.id || session.createdAt, session);
  }
  const reviews = new Map();
  for (const review of [...(secondaryState.reviews || []), ...(primaryState.reviews || [])]) {
    reviews.set(`${review.at}|${review.term}|${review.mode}|${review.correct}`, review);
  }
  return {
    ...structuredClone(DEFAULT_STATE),
    ...secondaryState,
    ...primaryState,
    words: [...words.values()],
    readingSessions: [...sessions.values()],
    reviews: [...reviews.values()],
    activeReadingSession: primaryState.activeReadingSession || secondaryState.activeReadingSession || null
  };
}

function updateAuthGate(message = "") {
  const gate = document.querySelector("#auth-gate");
  if (!gate) return;
  const visible = isSupabaseConfigured && (!authReady || !sessionUser);
  gate.hidden = !visible;
  document.body.classList.toggle("auth-blocked", visible);
  const status = document.querySelector("#auth-status");
  const retry = document.querySelector("#retry-cloud-load");
  if (status) {
    status.textContent = message || (authReady ? "Entre com Google para sincronizar suas palavras, leituras e revisões entre dispositivos." : "Conectando com segurança à sua conta…");
  }
  if (retry) retry.hidden = !message.startsWith("Não consegui carregar");
  const signIn = document.querySelector("#google-sign-in");
  if (signIn) signIn.disabled = !authReady || Boolean(sessionUser);
}

function updateAccountControls() {
  const controls = document.querySelector("#account-controls");
  if (!controls) return;
  if (!isSupabaseConfigured) {
    controls.innerHTML = `<span class="account-local-note">Sincronização não configurada</span>`;
    return;
  }
  controls.innerHTML = sessionUser
    ? `<span class="account-email">${escapeHtml(sessionUser.email || "Conta Google")}</span><button class="button outline small" data-action="sign-out">Sair</button>`
    : `<button class="button outline small" data-action="sign-in">Entrar com Google</button>`;
}

async function loadSignedInAccount(user) {
  const loadId = ++activeAccountLoad;
  sessionUser = user;
  authReady = false;
  updateAccountControls();
  updateAuthGate();
  const stateKey = `${STORAGE_KEY}:${user.id}`;
  const settingsKey = `${SETTINGS_KEY}:${user.id}`;
  const migrationKey = `wordtrail-migrated-v1:${user.id}`;
  const alreadyMigrated = localStorage.getItem(migrationKey) === "true";
  const localState = readLocalState(stateKey);
  const localSettings = readLocalSettings(settingsKey);
  const anonymousState = alreadyMigrated ? structuredClone(DEFAULT_STATE) : readLocalState(STORAGE_KEY);
  const anonymousSettings = alreadyMigrated ? { ...DEFAULT_SETTINGS } : readLocalSettings(SETTINGS_KEY);
  try {
    const { data: row, error } = await supabase
      .from(SYNC_TABLE)
      .select("data")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw error;
    if (loadId !== activeAccountLoad) return;
    const remoteState = row?.data?.state || structuredClone(DEFAULT_STATE);
    const remoteSettings = row?.data?.settings || { ...DEFAULT_SETTINGS };
    const secondaryState = alreadyMigrated ? localState : mergeAccountData(localState, anonymousState);
    state = row ? mergeAccountData(remoteState, secondaryState) : secondaryState;
    settings = row
      ? { ...localSettings, ...anonymousSettings, ...remoteSettings }
      : { ...localSettings, ...anonymousSettings };
    await saveCloudAccountData(user.id, state, settings);
    if (loadId !== activeAccountLoad) return;
    localStorage.setItem(stateKey, JSON.stringify(state));
    localStorage.setItem(settingsKey, JSON.stringify(settings));
    localStorage.setItem(migrationKey, "true");
    authReady = true;
    updateAuthGate();
    updateAccountControls();
    render();
  } catch (error) {
    if (loadId !== activeAccountLoad) return;
    console.error("Could not load or migrate Wordtrail cloud data.", error);
    updateAuthGate("Não consegui carregar os dados sincronizados. Confira sua conexão e tente novamente.");
  }
}

async function saveCloudAccountData(userId, accountState, accountSettings) {
  const { error } = await supabase.from(SYNC_TABLE).upsert({
    user_id: userId,
    data: { state: accountState, settings: accountSettings },
    updated_at: new Date().toISOString()
  });
  if (error) throw error;
}

function scheduleCloudSync() {
  if (!supabase || !sessionUser || !authReady) return;
  clearTimeout(syncTimeout);
  syncTimeout = setTimeout(() => { void queueCloudSync(); }, 600);
}

function queueCloudSync() {
  if (!supabase || !sessionUser || !authReady) return syncQueue;
  const userId = sessionUser.id;
  const accountState = structuredClone(state);
  const accountSettings = { ...settings };
  syncQueue = syncQueue.then(() => saveCloudAccountData(userId, accountState, accountSettings)).catch((error) => {
    console.error("Could not sync Wordtrail data to Supabase.", error);
    showToast("Não consegui sincronizar. Seus dados continuam salvos neste navegador; confira a conexão.", true);
  });
  return syncQueue;
}

async function signInWithGoogle() {
  if (!supabase) return;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin }
  });
  if (error) {
    console.error("Google sign-in failed.", error);
    showToast("Não consegui iniciar o login com Google. Confira a configuração do Supabase.", true);
  }
}

async function signOut() {
  clearTimeout(syncTimeout);
  await queueCloudSync();
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error("Could not sign out from Supabase.", error);
    showToast("Não consegui encerrar a sessão. Tente novamente.", true);
  }
}

function initializeAuth() {
  if (!supabase) {
    updateAccountControls();
    updateAuthGate();
    return;
  }
  updateAccountControls();
  updateAuthGate();
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
      if (session?.user && (sessionUser?.id !== session.user.id || !authReady)) {
        setTimeout(() => loadSignedInAccount(session.user), 0);
      } else if (!session?.user) {
        sessionUser = null;
        authReady = true;
        state = loadState();
        settings = loadSettings();
        currentPage = "home";
        updateAccountControls();
        updateAuthGate();
        render();
      }
    } else if (event === "SIGNED_OUT") {
      activeAccountLoad += 1;
      sessionUser = null;
      authReady = true;
      state = loadState();
      settings = loadSettings();
      currentPage = "home";
      updateAccountControls();
      updateAuthGate();
      render();
    }
  });
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function dateKey(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function formatDate(date) {
  return new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long" }).format(date);
}

function daysRead() {
  return [...new Set(state.readingSessions.map((session) => session.date))].sort().reverse();
}

function currentStreak() {
  const dates = new Set(daysRead());
  const today = new Date();
  let cursor = dateKey(today);
  if (!dates.has(cursor)) {
    today.setDate(today.getDate() - 1);
    cursor = dateKey(today);
    if (!dates.has(cursor)) return 0;
  }
  let streak = 0;
  const day = new Date(`${cursor}T12:00:00`);
  while (dates.has(dateKey(day))) {
    streak += 1;
    day.setDate(day.getDate() - 1);
  }
  return streak;
}

function todaySessions() {
  return state.readingSessions.filter((session) => session.date === dateKey());
}

function todayMinutes() {
  return todaySessions().reduce((total, session) => total + session.minutes, 0);
}

function dueWords() {
  const now = Date.now();
  return state.words.filter((word) => !word.dueAt || new Date(word.dueAt).getTime() <= now);
}

function sortedWords(words = state.words) {
  return [...words].sort((a, b) => b.lookups - a.lookups || a.term.localeCompare(b.term));
}

function recentActivity() {
  const entries = [
    ...state.words.map((word) => ({ kind: "word", at: word.lastSearchedAt, text: `Você pesquisou <strong>${escapeHtml(word.term)}</strong>`, meta: `${word.translation || "Tradução pendente"} · ${word.lookups} ${word.lookups === 1 ? "consulta" : "consultas"}` })),
    ...state.readingSessions.map((session) => ({ kind: "reading", at: session.createdAt, text: [session.minutes ? `<strong>${session.minutes} min</strong>` : "", session.pages ? `<strong>${session.pages} ${session.pages === 1 ? "página" : "páginas"}</strong>` : ""].filter(Boolean).join(" · ") + " de leitura", meta: formatDate(new Date(`${session.date}T12:00:00`)) })),
    ...state.reviews.filter((review) => review.term).map((review) => ({ kind: "review", at: review.at, text: `Revisou <strong>${escapeHtml(review.term)}</strong>`, meta: review.correct ? "Lembrou da resposta" : "Vai aparecer de novo em breve" }))
  ];
  return entries.sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 5);
}

function showToast(message, isError = false) {
  toastElement.textContent = message;
  toastElement.classList.toggle("error", isError);
  toastElement.classList.add("show");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toastElement.classList.remove("show"), 3200);
}

function setPage(page) {
  if (practiceSession && page !== "practice") finishPractice();
  currentPage = page;
  document.querySelectorAll(".nav-link").forEach((item) => item.classList.toggle("active", item.dataset.page === page));
  document.querySelector(".sidebar")?.classList.remove("open");
  render();
}

function updateChrome() {
  document.querySelector("#today-label").textContent = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
  updateAccountControls();
  const activePage = currentPage === "lookup" ? "reading" : currentPage;
  document.querySelectorAll(".nav-link").forEach((item) => item.classList.toggle("active", item.dataset.page === activePage));
  const streak = currentStreak();
  document.querySelector("#top-streak").textContent = streak;
  document.querySelector("#top-streak-label").textContent = streak === 1 ? "dia lendo" : "dias lendo";
  document.querySelector("#due-count").textContent = dueWords().length;
  const progress = Math.min(100, Math.round((todayMinutes() / Math.max(1, settings.dailyGoal)) * 100));
  document.querySelector("#sidebar-progress").style.width = `${progress}%`;
  document.querySelector("#sidebar-progress-label").textContent = `${todayMinutes()} / ${settings.dailyGoal} min hoje`;
}

function render() {
  clearInterval(readingTimer);
  readingTimer = null;
  updateChrome();
  const pages = { home: renderHome, lookup: renderReading, practice: renderPractice, words: renderWords, reading: renderReading };
  (pages[currentPage] || renderHome)();
}

function renderHome() {
  const words = sortedWords();
  const activity = recentActivity();
  const top = words.slice(0, 5);
  const readPages = todaySessions().reduce((sum, session) => sum + (session.pages || 0), 0);
  const goalProgress = Math.min(100, Math.round(todayMinutes() / Math.max(1, settings.dailyGoal) * 100));
  view.innerHTML = `
    <section class="page-intro"><span class="eyebrow">SEU DIÁRIO DE LEITURA</span><h1>Oi, que bom te ver por aqui <span aria-hidden="true">✿</span></h1><p>Um cantinho pra acompanhar suas leituras e guardar cada palavra nova.</p></section>
    <section class="home-grid">
      <div class="hero-card"><div class="hero-copy"><span class="eyebrow">UM PASSINHO DE CADA VEZ</span><h2>${state.activeReadingSession ? "Sua leitura está acontecendo." : "Pronta pra começar a leitura?"}</h2><p>${state.activeReadingSession ? "Pesquise palavras por aqui e volte pro seu livro. O cronômetro continua contando." : "Inicie uma sessão, leia no seu ritmo e pesquise palavras sem perder o fio."}</p><button class="button" data-action="${state.activeReadingSession ? "resume-reading" : "start-reading"}">${state.activeReadingSession ? "Continuar sessão →" : "▶ &nbsp; Iniciar leitura"}</button></div><div class="hero-illustration" aria-hidden="true">📖</div></div>
      <div class="goal-card"><div class="goal-head"><div><h3>Sua meta de leitura</h3><p>cada minuto conta</p></div><span class="goal-icon">◷</span></div><div class="goal-meter"><div class="ring" style="--progress:${goalProgress}%"><span>${goalProgress}%</span></div><div class="goal-copy"><strong>${todayMinutes()} <small>min</small></strong><small>de ${settings.dailyGoal} min hoje</small></div></div><div class="goal-bottom"><span>${readPages ? `${readPages} páginas registradas` : "Vai no seu ritmo ✿"}</span><button class="text-button" data-page="reading">Registrar +</button></div></div>
    </section>
    <section class="stats-row">
      <div class="stat-card"><span class="stat-icon">▧</span><div><strong>${state.words.length}</strong><small>palavras guardadas</small></div></div>
      <div class="stat-card"><span class="stat-icon">⌕</span><div><strong>${state.words.reduce((sum, word) => sum + word.lookups, 0)}</strong><small>pesquisas feitas</small></div></div>
      <div class="stat-card"><span class="stat-icon">🔥</span><div><strong>${currentStreak()}</strong><small>${currentStreak() === 1 ? "dia lendo em sequência" : "dias lendo em sequência"}</small></div></div>
      <div class="stat-card"><span class="stat-icon">✳</span><div><strong>${state.reviews.length}</strong><small>revisões concluídas</small></div></div>
    </section>
    <section class="lower-grid">
      <div><div class="section-heading"><div><h2>Palavras que mais aparecem</h2><p>As suas descobertas mais frequentes</p></div><button class="text-button" data-page="words">Ver tudo →</button></div><div class="panel">${top.length ? `<div class="word-list">${top.map(wordRow).join("")}</div>` : emptyState("🌱", "Sua primeira palavra começa aqui", "Pesquise algo que encontrou no livro e seu vocabulário vai crescendo.")}</div></div>
      <div><div class="section-heading"><div><h2>Seu caminho recente</h2><p>Pequenas conquistas do dia a dia</p></div></div><div class="panel">${activity.length ? `<div class="activity-list">${activity.map((item) => `<div class="activity-item"><span class="activity-dot"></span><div><p>${item.text}</p><small>${item.meta}</small></div></div>`).join("")}</div>` : emptyState("☀️", "Tudo começa na próxima página", "Sua atividade vai aparecer aqui assim que você começar.")}</div></div>
    </section>
    <section class="section-heading"><div><h2>Uma pausa de cinco minutinhos?</h2><p>Relembre palavras enquanto elas ainda estão fresquinhas.</p></div><button class="button small" data-page="practice">Começar jogo →</button></section>`;
}

function emptyState(emoji, title, description) {
  return `<div class="empty-state"><div class="empty-emoji">${emoji}</div><strong>${title}</strong>${description}</div>`;
}

function wordRow(word) {
  return `<div class="word-row"><span class="word-letter">${escapeHtml(word.term[0])}</span><div class="word-meta"><strong>${escapeHtml(word.term)}</strong><small>${escapeHtml(word.translation || "Tradução não encontrada")}</small></div><span class="word-count">${word.lookups}× pesquisada</span></div>`;
}

function renderSearchResult(result) {
  const word = result.word;
  const statusText = result.notice || "Salva no seu vocabulário. Você pode praticar essa palavra no seu próximo jogo.";
  const definitionSource = word.definitionSource ? "online" : "";
  const translationOptions = [...new Set([...(word.translationOptions || []), word.translation].filter(Boolean))];
  const translationView = translationOptions.length > 1
    ? `<div class="translation-options" aria-label="Opções de tradução">${translationOptions.map((option) => `<button class="translation-option ${option === word.translation ? "selected" : ""}" type="button" data-translation-choice="${escapeHtml(option)}" aria-pressed="${option === word.translation}">${escapeHtml(option)}</button>`).join("")}</div><small class="translation-help">Escolha a tradução que combina melhor com o contexto.</small>`
    : `<div class="translation-text">${escapeHtml(word.translation || "Tradução indisponível")}</div>`;
  const pronunciation = word.phonetic ? `/${escapeHtml(word.phonetic)}/` : "Pronúncia indisponível";
  const audioAction = word.audio
    ? `<button class="button outline small" data-audio="${escapeHtml(word.audio)}" aria-label="Ouvir pronúncia de ${escapeHtml(word.term)}">▶ Ouvir</button>`
    : `<span class="audio-unavailable">Áudio indisponível</span>`;
  return `<article class="result-card"><div class="result-top"><div><div class="result-word">${escapeHtml(word.term)}</div><div class="pronunciation">${pronunciation}</div></div><div class="result-word-actions">${audioAction}${word.partOfSpeech ? `<span class="pos-tag">${escapeHtml(word.partOfSpeech)}</span>` : ""}</div></div><div class="result-divider"></div><div class="result-label">Traduções em português</div>${translationView}<div class="result-divider"></div><div class="result-label">Definition in English${definitionSource ? ` · ${definitionSource}` : ""}</div><div class="definition-text">${escapeHtml(word.definition || "Não foi possível carregar a definição agora.")}</div>${result.notice ? `<div class="result-status">${escapeHtml(statusText)}</div>` : ""}</article>`;
}

async function lookupWord(term) {
  const inputTerm = term.trim().replace(/\s+/g, " ");
  if (!inputTerm) return;
  const token = ++searchToken;
  searchBusy = true;
  searchResult = null;
  renderReading();
  const normalized = inputTerm.toLocaleLowerCase("en-US");
  const existing = state.words.find((word) => word.normalized === normalized);
  const session = state.activeReadingSession;
  const now = new Date().toISOString();
  if (session && !session.endedAt && !Object.hasOwn(session.wordSnapshots || {}, normalized)) {
    session.wordSnapshots ||= {};
    session.wordSnapshots[normalized] = existing ? { ...existing } : null;
  }
  const dictionaryRequest = getDictionaryEntry(inputTerm);
  const previousTranslation = existing?.translation && !isSameTranslation(inputTerm, existing.translation) ? existing.translation : "";
  const translationRequest = getTranslation(inputTerm);
  const [dictionaryOutcome, translationOutcome] = await Promise.allSettled([dictionaryRequest, translationRequest]);
  if (token !== searchToken) return;
  const dictionary = dictionaryOutcome.status === "fulfilled" ? dictionaryOutcome.value : null;
  const translationResult = translationOutcome.status === "fulfilled" ? translationOutcome.value : null;
  const translation = translationResult?.translation || "";
  const definitionUnavailable = dictionaryOutcome.status === "fulfilled" && !dictionary?.definition;
  const translationUnavailable = !translation && !previousTranslation;
  const wordData = {
    term: dictionary?.word || inputTerm,
    normalized,
    translation: translation || previousTranslation,
    translationOptions: translationResult?.options || (previousTranslation ? existing?.translationOptions || [previousTranslation] : []),
    translationSource: translationResult?.source || (previousTranslation ? existing?.translationSource || "" : ""),
    definition: dictionary?.definition || "",
    definitionSource: dictionary?.definitionSource || "",
    partOfSpeech: dictionary?.partOfSpeech || "",
    phonetic: dictionary?.phonetic || "",
    audio: dictionary?.audio || "",
    lookups: (existing?.lookups || 0) + 1,
    firstSearchedAt: existing?.firstSearchedAt || now,
    lastSearchedAt: now,
    dueAt: existing?.dueAt || now,
    intervalDays: existing?.intervalDays || 0,
    correctStreak: existing?.correctStreak || 0
  };
  if (existing) Object.assign(existing, wordData);
  else state.words.push(wordData);
  trackSessionLookup(session, wordData, wordData.lookups, now);
  searchBusy = false;
  const notices = [];
  if (dictionaryOutcome.status === "rejected") notices.push(dictionaryOutcome.reason.message);
  else if (definitionUnavailable) notices.push("A API de dicionário não encontrou essa palavra.");
  if (translationOutcome.status === "rejected") notices.push(translationOutcome.reason.message);
  else if (translationUnavailable) notices.push("Não foi possível carregar a tradução agora.");
  searchResult = { word: wordData, notice: notices.join(" ") };
  persist();
  renderReading();
  document.querySelector("#lookup-input")?.focus();
  if (!notices.length) showToast(existing ? `“${wordData.term}” atualizada — ${wordData.lookups} consultas até agora.` : `“${wordData.term}” salva no seu vocabulário!`);
}

async function getDictionaryEntry(term) {
  const url = new URL("/api/dictionary", window.location.origin);
  url.searchParams.set("word", term);
  const response = await fetch(url);
  if (response.ok) return response.json();
  if (response.status === 404) return null;
  const error = await response.json().catch(() => null);
  throw new Error(error?.error || `A API de dicionário respondeu com erro (${response.status}).`);
}

function trackSessionLookup(session, word, lookupNumber, at) {
  if (!session || session.endedAt) return;
  session.lookups.push({
    normalized: word.normalized,
    term: word.term,
    at,
    wasKnown: session.knownWords?.includes(word.normalized) || false,
    lookupNumber,
    translation: word.translation
  });
}

async function getTranslation(term) {
  let response;
  try {
    response = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: term })
    });
  } catch (error) {
    throw new Error("Não consegui acessar a API pública de tradução. Confira sua conexão.");
  }
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.error || `A API de tradução respondeu com erro (${response.status}).`);
  }
  const data = await response.json();
  if (!data.translatedText?.trim()) throw new Error("A API de tradução não retornou um resultado.");
  return {
    translation: data.translatedText.trim(),
    options: Array.isArray(data.translations) ? data.translations : [data.translatedText.trim()],
    source: data.source
  };
}

function isSameTranslation(source, translation) {
  const normalize = (value) => String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toLocaleLowerCase();
  return normalize(source) === normalize(translation);
}

function renderWords() {
  const words = sortedWords(state.words.filter((word) => `${word.term} ${word.translation} ${word.definition}`.toLowerCase().includes(wordsFilter.toLowerCase())));
  view.innerHTML = `
    <section class="page-intro"><span class="eyebrow">SEU VOCABULÁRIO PESSOAL</span><h1>Palavras que você encontrou</h1><p>Cada pesquisa vira uma descoberta guardada pra depois.</p></section>
    <div class="stats-row"><div class="stat-card"><span class="stat-icon">▧</span><div><strong>${state.words.length}</strong><small>palavras diferentes</small></div></div><div class="stat-card"><span class="stat-icon">⌕</span><div><strong>${state.words.reduce((sum, word) => sum + word.lookups, 0)}</strong><small>pesquisas no total</small></div></div><div class="stat-card"><span class="stat-icon">✳</span><div><strong>${dueWords().length}</strong><small>prontas pra revisar</small></div></div><div class="stat-card"><span class="stat-icon">🔥</span><div><strong>${currentStreak()}</strong><small>dias lendo em sequência</small></div></div></div>
    <div class="words-controls"><input class="field" id="words-filter" type="search" placeholder="Filtrar por palavra ou tradução..." value="${escapeHtml(wordsFilter)}" /><button class="button small" data-page="lookup">+ Pesquisar</button></div>
    <div class="word-table">${words.length ? words.map((word) => `<div class="word-row"><span class="word-letter">${escapeHtml(word.term[0])}</span><div class="table-detail"><strong>${escapeHtml(word.term)}</strong><small>${escapeHtml(word.translation || "Tradução indisponível")} · ${escapeHtml(word.definition || "Definição indisponível")}</small></div><span class="table-stat">${word.lookups}× consulta${word.lookups === 1 ? "" : "s"}</span><button class="delete-word" data-delete-word="${escapeHtml(word.normalized)}" title="Remover palavra" aria-label="Remover ${escapeHtml(word.term)}">×</button></div>`).join("") : emptyState(state.words.length ? "🔎" : "🌱", state.words.length ? "Nenhuma palavra encontrada" : "Seu vocabulário começa com uma curiosidade", state.words.length ? "Tente outra palavra ou tradução." : "Pesquise uma palavra durante a leitura pra começar.")}</div>`;
}

function renderReading() {
  clearInterval(readingTimer);
  readingTimer = null;
  const active = state.activeReadingSession;
  if (active) {
    if (active.endedAt) renderFinishReading(active);
    else renderActiveReading(active);
    return;
  }

  const sessions = [...state.readingSessions].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const totalMinutes = state.readingSessions.reduce((sum, session) => sum + session.minutes, 0);
  view.innerHTML = `
    <section class="page-intro"><span class="eyebrow">SEU TEMPO COM OS LIVROS</span><h1>Uma leitura de cada vez</h1><p>Comece uma sessão, deixe o cronômetro cuidar do tempo e pesquise palavras quando precisar.</p></section>
    <div class="reading-start-card"><div class="reading-start-copy"><span class="goal-icon">◷</span><h2>Pronta pra abrir o livro?</h2><p>O cronômetro começa junto com a sessão. Suas pesquisas ficam ligadas a ela.</p><button class="button" data-action="start-reading">▶ &nbsp; Iniciar leitura</button></div><div class="reading-start-time"><strong>${settings.dailyGoal}</strong><small>min de meta diária</small></div></div>
    <div class="section-heading"><div><h2>Histórico de leitura</h2><p>${sessions.length} ${sessions.length === 1 ? "sessão" : "sessões"} · ${totalMinutes} min lidos</p></div></div>
    <div class="session-history">${sessions.length ? sessions.map(renderReadingHistoryItem).join("") : emptyState("📖", "Seu histórico começa aqui", "Depois da primeira sessão, o resumo e as palavras pesquisadas ficam salvos aqui.")}</div>`;
}

function renderActiveReading(session) {
  const words = [...new Set(session.lookups.map((lookup) => lookup.normalized))]
    .map((normalized) => state.words.find((word) => word.normalized === normalized))
    .filter(Boolean);
  const elapsed = Math.max(0, Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000));
  view.innerHTML = `
    <section class="reading-session-head"><div><span class="eyebrow">SESSÃO DE LEITURA EM ANDAMENTO</span><h1>Vai no seu ritmo ✿</h1><p>Deixa essa tela do lado do seu livro. O cronômetro continua enquanto você lê.</p></div><div class="reading-session-controls"><div class="live-timer"><span class="timer-pulse" aria-label="Gravando leitura"></span><span class="live-timer-copy"><strong id="reading-timer">${formatElapsed(elapsed)}</strong><small>tempo de leitura</small></span></div><button class="button stop-reading-button" data-action="finish-reading" aria-label="Finalizar sessão de leitura" ${searchBusy ? "disabled" : ""}><span class="stop-icon" aria-hidden="true"></span><span>Finalizar</span></button></div></section>
    <section class="reading-live-layout">
      <div class="reading-search-column"><div class="search-autocomplete"><form id="lookup-form" class="search-box" role="search"><input id="lookup-input" type="search" autocomplete="off" placeholder="Qual palavra te parou?" aria-label="Palavra em inglês" role="combobox" aria-autocomplete="list" aria-haspopup="listbox" aria-controls="lookup-suggestions" aria-expanded="false" required /><button class="button" type="submit" ${searchBusy ? "disabled" : ""}>${searchBusy ? "Buscando..." : "Pesquisar ↗"}</button></form><div id="lookup-suggestions" class="suggestion-list" role="listbox" aria-label="Sugestões de palavras" hidden></div></div><p class="lookup-hint">Definições, tradução, sugestões e áudio vêm de APIs públicas. Suas palavras continuam salvas neste navegador.</p>
        <div id="search-result">${searchResult ? renderSearchResult(searchResult) : `<div class="empty-large empty-state" style="margin-top:16px"><div class="empty-emoji">🔎</div><strong>Seu próximo achado tá esperando</strong>Digite a palavra que encontrou e volte pro livro.</div>`}</div>
      </div>
      <aside class="reading-session-sidebar"><div class="panel"><div class="side-panel-title"><h3>Palavras desta sessão</h3><span class="word-count">${session.lookups.length} pesquisa${session.lookups.length === 1 ? "" : "s"}</span></div>${words.length ? `<div class="word-list">${[...words].reverse().map((word) => {
    const count = session.lookups.filter((lookup) => lookup.normalized === word.normalized).length;
    return `<div class="word-row"><span class="word-letter">${escapeHtml(word.term[0])}</span><div class="word-meta"><strong>${escapeHtml(word.term)}</strong><small>${escapeHtml(word.translation || "Tradução indisponível")}</small></div>${count > 1 ? `<span class="word-count">${count}×</span>` : ""}</div>`;
  }).join("")}</div>` : emptyState("🌱", "Ainda sem pesquisas", "As palavras que você consultar durante esta leitura aparecem aqui.")}</div>
      </aside>
    </section>`;
  readingTimer = setInterval(() => {
    if (!state.activeReadingSession || state.activeReadingSession.endedAt) return;
    const timer = document.querySelector("#reading-timer");
    if (timer) timer.textContent = formatElapsed(Math.floor((Date.now() - new Date(state.activeReadingSession.startedAt).getTime()) / 1000));
  }, 1000);
}

async function updateWordSuggestions(query) {
  const token = ++suggestionToken;
  const list = document.querySelector("#lookup-suggestions");
  const input = document.querySelector("#lookup-input");
  if (!list || !input) return;
  const normalized = query.trim().toLocaleLowerCase("en-US");
  if (normalized.length < 2 || /\s/.test(normalized)) {
    hideWordSuggestions();
    return;
  }
  try {
    const url = new URL("/api/dictionary/suggest", window.location.origin);
    url.searchParams.set("q", normalized);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`A API pública de sugestões respondeu com erro (${response.status}).`);
    const data = await response.json();
    if (token !== suggestionToken || input.value.trim().toLocaleLowerCase("en-US") !== normalized) return;
    const suggestions = Array.isArray(data.suggestions) ? data.suggestions : [];
    if (!suggestions.length) {
      hideWordSuggestions();
      return;
    }
    activeSuggestionIndex = -1;
    list.innerHTML = suggestions.map((word, index) => `<button type="button" id="lookup-suggestion-${index}" class="suggestion-option" role="option" aria-selected="false" data-suggestion="${escapeHtml(word)}">${escapeHtml(word)}</button>`).join("");
    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
    input.removeAttribute("aria-activedescendant");
  } catch (error) {
    if (token !== suggestionToken) return;
    console.error("Could not load online word suggestions.", error);
    list.innerHTML = `<div class="suggestion-message" role="status">Não foi possível carregar sugestões online.</div>`;
    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
    input.removeAttribute("aria-activedescendant");
  }
}

function hideWordSuggestions() {
  suggestionToken += 1;
  activeSuggestionIndex = -1;
  const list = document.querySelector("#lookup-suggestions");
  const input = document.querySelector("#lookup-input");
  if (list) {
    list.hidden = true;
    list.replaceChildren();
  }
  input?.setAttribute("aria-expanded", "false");
  input?.removeAttribute("aria-activedescendant");
}

function moveActiveSuggestion(direction) {
  const list = document.querySelector("#lookup-suggestions");
  const input = document.querySelector("#lookup-input");
  const options = list?.querySelectorAll(".suggestion-option");
  if (!list || list.hidden || !input || !options?.length) return false;
  activeSuggestionIndex = (activeSuggestionIndex + direction + options.length) % options.length;
  options.forEach((option, index) => {
    const active = index === activeSuggestionIndex;
    option.classList.toggle("active", active);
    option.setAttribute("aria-selected", String(active));
  });
  input.setAttribute("aria-activedescendant", options[activeSuggestionIndex].id);
  return true;
}

function renderFinishReading(session) {
  clearInterval(readingTimer);
  const summary = summarizeReadingSession(session);
  view.innerHTML = `
    <section class="page-intro"><span class="eyebrow">SESSÃO FINALIZADA</span><h1>Olha só o que você fez ✨</h1><p>Seu tempo já está registrado. Se quiser, anote também quantas páginas leu.</p></section>
    <section class="reading-summary-card"><div class="reading-summary-top"><div><span class="eyebrow">TEMPO DE LEITURA</span><strong>${formatDuration(session.durationSeconds)}</strong></div><div><span class="eyebrow">PESQUISAS</span><strong>${summary.totalLookups}</strong></div><div><span class="eyebrow">PALAVRAS DIFERENTES</span><strong>${summary.uniqueWords}</strong></div></div>
      <div class="summary-stats"><div><strong>${summary.repeatWords.length}</strong><small>${summary.repeatWords.length === 1 ? "palavra pesquisada mais de uma vez" : "palavras repetidas nesta sessão"}</small></div><div><strong>${summary.previousWords.length}</strong><small>${summary.previousWords.length === 1 ? "palavra já conhecida" : "palavras já pesquisadas antes"}</small></div></div>
      ${summary.uniqueWords ? `<div class="session-word-summary"><h3>Palavras que apareceram</h3>${summary.wordSummaries.map((item) => `<div class="summary-word-row"><span><strong>${escapeHtml(item.term)}</strong><small>${escapeHtml(item.translation || "Tradução indisponível")}</small></span><span class="word-count">${item.count}× ${item.wasKnown ? "já conhecida" : "nova"}</span></div>`).join("")}</div>` : `<div class="empty-state">Nenhuma palavra pesquisada nesta sessão — e tudo bem, você leu do seu jeito.</div>`}
      <form id="finish-reading-form" class="finish-reading-form"><label><span class="input-label">Quantas páginas você leu? (opcional)</span><input class="field" id="reading-pages" type="number" min="1" max="10000" placeholder="ex.: 18" /></label><label><span class="input-label">Livro ou anotação (opcional)</span><input class="field" id="reading-note" maxlength="80" placeholder="ex.: Mistborn — capítulo 4" /></label><div class="form-actions"><button type="button" class="button discard-finished-button" data-action="discard-reading">Sair sem salvar</button><button type="button" class="button outline" data-action="resume-reading">Continuar lendo</button><button type="submit" class="button">Salvar sessão</button></div></form>
    </section>`;
}

function summarizeReadingSession(session) {
  const lookups = session.lookups || [];
  const grouped = new Map();
  for (const lookup of lookups) {
    const group = grouped.get(lookup.normalized) || { term: lookup.term, translation: lookup.translation, count: 0, wasKnown: false, events: [] };
    group.count += 1;
    group.wasKnown ||= lookup.wasKnown;
    group.events.push(lookup);
    grouped.set(lookup.normalized, group);
  }
  const wordSummaries = [...grouped.values()].sort((a, b) => a.term.localeCompare(b.term));
  return {
    totalLookups: lookups.length,
    uniqueWords: grouped.size,
    repeatWords: wordSummaries.filter((word) => word.count > 1),
    previousWords: wordSummaries.filter((word) => word.wasKnown),
    wordSummaries
  };
}

function renderReadingHistoryItem(session) {
  const summary = summarizeReadingSession(session);
  const dateTime = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(session.createdAt));
  const list = (session.lookups || []).length ? `<div class="history-lookups">${session.lookups.map((lookup, index) => {
    const repeatedHere = session.lookups.slice(0, index).some((item) => item.normalized === lookup.normalized);
    const label = lookup.wasKnown ? "já estava no vocabulário" : repeatedHere ? "repetida nesta sessão" : "primeira pesquisa";
    return `<div class="history-lookup-row"><span class="history-time">${new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(lookup.at))}</span><strong>${escapeHtml(lookup.term)}</strong><span>${escapeHtml(lookup.translation || "Tradução indisponível")}</span><small>${label}</small></div>`;
  }).join("")}</div>` : `<p class="history-empty">Nenhuma palavra pesquisada nesta sessão.</p>`;
  const duration = session.durationSeconds === undefined ? `${session.minutes} min` : formatDuration(session.durationSeconds);
  const sessionId = session.id || session.createdAt;
  return `<details class="history-card"><summary><span class="history-date"><strong>${dateTime}</strong><small>${session.note ? escapeHtml(session.note) : "Sessão de leitura"}</small></span><span class="history-metric"><strong>${duration}</strong><small>${session.pages ? `${session.pages} pág.` : "leitura"}</small></span><span class="history-metric history-lookup-metric"><strong>${summary.totalLookups}</strong><small>${summary.totalLookups === 1 ? "pesquisa" : "pesquisas"}</small></span><span class="history-metric"><strong>${summary.uniqueWords}</strong><small>${summary.uniqueWords === 1 ? "palavra" : "palavras"}</small></span><button type="button" class="delete-session-button" data-delete-session="${escapeHtml(sessionId)}" aria-label="Apagar sessão de leitura de ${escapeHtml(dateTime)}" title="Apagar sessão"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v7m6-7v7" /></svg></button><span class="history-chevron" aria-hidden="true">⌄</span></summary>${summary.totalLookups ? `<div class="history-insights">${summary.repeatWords.length ? `↻ ${summary.repeatWords.map((word) => escapeHtml(word.term)).join(", ")} pesquisada${summary.repeatWords.length > 1 ? "s" : ""} mais de uma vez` : "✳ Nenhuma palavra repetida nesta sessão"}<br />${summary.previousWords.length ? `↗ ${summary.previousWords.map((word) => escapeHtml(word.term)).join(", ")} já estava${summary.previousWords.length > 1 ? "m" : ""} no vocabulário` : "🌱 Todas as palavras eram novas"}</div>` : ""}${list}</details>`;
}

function formatElapsed(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}` : `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatDuration(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (!minutes) return `${seconds} seg`;
  if (seconds < 10) return `${minutes} min`;
  return `${minutes} min ${seconds} seg`;
}

function startReadingSession() {
  if (state.activeReadingSession) {
    currentPage = "reading";
    render();
    return;
  }
  const now = new Date().toISOString();
  state.activeReadingSession = { id: crypto.randomUUID(), startedAt: now, date: dateKey(), knownWords: state.words.map((word) => word.normalized), lookups: [] };
  searchResult = null;
  currentPage = "reading";
  persist();
  render();
  document.querySelector("#lookup-input")?.focus();
}

function requestFinishReading() {
  const session = state.activeReadingSession;
  if (!session || session.endedAt) return;
  session.endedAt = new Date().toISOString();
  session.durationSeconds = Math.max(0, Math.floor((new Date(session.endedAt) - new Date(session.startedAt)) / 1000));
  session.minutes = Math.floor(session.durationSeconds / 60);
  persist();
  renderReading();
}

function confirmDiscardReadingSession() {
  const modalRoot = document.querySelector("#modal-root");
  modalRoot.innerHTML = `<div class="modal-backdrop" data-close-modal><section class="modal discard-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="discard-reading-title" aria-describedby="discard-reading-description"><div class="modal-header"><div><span class="eyebrow">SESSÃO DE LEITURA</span><h2 id="discard-reading-title">Sair sem salvar?</h2></div><button class="modal-close" data-close-modal aria-label="Fechar">×</button></div><p id="discard-reading-description">Esta sessão e o tempo de leitura não serão salvos. As palavras adicionadas somente nesta sessão também serão removidas do vocabulário.</p><div class="discard-confirm-actions"><button type="button" class="button outline" data-close-modal>Continuar sessão</button><button type="button" class="button discard-confirm-button" data-action="confirm-discard-reading">Sair sem salvar</button></div></section></div>`;
  modalRoot.querySelector(".modal-close").focus();
}

function discardReadingSession() {
  const session = state.activeReadingSession;
  if (!session) return;
  searchToken += 1;
  searchBusy = false;
  for (const [normalized, snapshot] of Object.entries(session.wordSnapshots || {})) {
    state.words = state.words.filter((word) => word.normalized !== normalized);
    if (snapshot) state.words.push(snapshot);
  }
  state.activeReadingSession = null;
  searchResult = null;
  searchBusy = false;
  currentPage = "reading";
  persist();
  render();
  showToast("Sessão descartada sem salvar.");
}

function confirmDeleteReadingSession(sessionId) {
  const session = state.readingSessions.find((item) => (item.id || item.createdAt) === sessionId);
  if (!session) return;
  pendingDeleteReadingSessionId = sessionId;
  const dateTime = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(session.createdAt));
  document.querySelector("#modal-root").innerHTML = `<div class="modal-backdrop" data-close-modal><section class="modal discard-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="delete-session-title" aria-describedby="delete-session-description"><div class="modal-header"><div><span class="eyebrow">HISTÓRICO DE LEITURA</span><h2 id="delete-session-title">Apagar esta sessão?</h2></div><button class="modal-close" data-close-modal aria-label="Fechar">×</button></div><p id="delete-session-description">A sessão de ${escapeHtml(dateTime)} será removida do histórico e das suas estatísticas. As palavras pesquisadas continuam no seu vocabulário.</p><div class="discard-confirm-actions"><button type="button" class="button outline" data-close-modal>Manter sessão</button><button type="button" class="button discard-confirm-button" data-action="confirm-delete-session">Apagar sessão</button></div></section></div>`;
  document.querySelector("#modal-root .modal-close").focus();
}

function deleteReadingSession() {
  if (!pendingDeleteReadingSessionId) return;
  const sessionId = pendingDeleteReadingSessionId;
  const previousSessions = state.readingSessions;
  state.readingSessions = state.readingSessions.filter((session) => (session.id || session.createdAt) !== sessionId);
  if (state.readingSessions.length === previousSessions.length) return false;
  if (!persist()) {
    state.readingSessions = previousSessions;
    return false;
  }
  pendingDeleteReadingSessionId = null;
  renderReading();
  showToast("Sessão removida do histórico.");
  return true;
}

function resumeReadingSession() {
  const session = state.activeReadingSession;
  if (!session) return;
  delete session.endedAt;
  delete session.minutes;
  persist();
  currentPage = "reading";
  render();
}

function saveReadingSession(pages, note) {
  const session = state.activeReadingSession;
  if (!session?.endedAt) return;
  const completed = {
    ...session,
    knownWords: undefined,
    wordSnapshots: undefined,
    pages,
    note,
    minutes: session.minutes,
    createdAt: session.startedAt,
    date: dateKey(new Date(session.startedAt))
  };
  state.readingSessions.push(completed);
  state.activeReadingSession = null;
  persist();
  searchResult = null;
  currentPage = "reading";
  render();
  showToast(todayMinutes() >= settings.dailyGoal ? "Meta de leitura batida! Que orgulho de você ✨" : "Sessão salva. Cada página conta! ✿");
}

function renderPractice() {
  if (practiceSession) {
    renderPracticeSession();
    return;
  }
  if (practiceSummary) {
    view.innerHTML = `
      <section class="page-intro"><span class="eyebrow">PAUSA PRA FIXAR</span><h1>Hora do jogo! <span aria-hidden="true">✳</span></h1><p>Uma pausa curtinha também é progresso.</p></section>
      <section class="session-card practice-complete"><div class="finish-emoji">🎉</div><span class="eyebrow">RODADA CONCLUÍDA</span><h2>Mandou bem nessa pausa!</h2><p>${escapeHtml(practiceSummary.message)}</p><div class="practice-complete-stats"><div><strong>${practiceSummary.correct}</strong><small>lembradas</small></div><div><strong>${practiceSummary.answered}</strong><small>respondidas</small></div><div><strong>${escapeHtml(practiceSummary.duration)}</strong><small>de prática</small></div></div><button class="button" data-action="dismiss-summary">Voltar aos jogos →</button></section>`;
    return;
  }
  const practiceWords = getPracticeWords();
  const due = practiceWords.filter((word) => !word.dueAt || new Date(word.dueAt).getTime() <= Date.now()).length;
  const distinctTranslations = new Set(getQuizPracticeWords().map((word) => word.translation.trim().toLocaleLowerCase()).filter(Boolean));
  const quizDisabled = distinctTranslations.size < 2 && practiceSource === "vocabulary";
  const canStart = practiceSource === "dictionary" || (practiceMode === "quiz" ? distinctTranslations.size >= 2 : practiceWords.length > 0);
  const description = practiceSource === "dictionary"
    ? "Palavras aleatórias de uma API externa, com definições em inglês."
    : practiceWords.length
      ? `${due} ${due === 1 ? "palavra pronta" : "palavras prontas"} pra revisar. Palavras antigas também entram no jogo.`
      : state.words.length
        ? "Suas palavras ainda não têm definição salva para praticar."
        : "Pesquise algumas palavras durante a leitura pra começar a jogar.";
  view.innerHTML = `
    <section class="page-intro"><span class="eyebrow">PAUSA PRA FIXAR</span><h1>Hora do jogo! <span aria-hidden="true">✳</span></h1><p>Cinco minutinhos pra trazer de volta as palavras que você encontrou lendo.</p></section>
    <div class="form-card practice-start-card"><div class="side-panel-title"><div><h2>Uma rodada rapidinha</h2><p class="practice-description">${description}</p></div><span class="goal-icon">⏱</span></div>
    <div class="practice-config"><span class="practice-config-label">Palavras de</span><div class="segmented"><button data-source="vocabulary" class="${practiceSource === "vocabulary" ? "selected" : ""}">Meu vocabulário</button><button data-source="dictionary" class="${practiceSource === "dictionary" ? "selected" : ""}">Palavras aleatórias online</button></div></div>
    <div class="practice-config"><span class="practice-config-label">Escolha como jogar</span><div class="segmented"><button data-mode="flashcard" class="${practiceMode === "flashcard" ? "selected" : ""}">Flashcards</button><button data-mode="quiz" class="${practiceMode === "quiz" ? "selected" : ""}" ${quizDisabled ? "disabled title='Pesquise pelo menos duas palavras com traduções diferentes'" : ""}>Múltipla escolha</button></div></div>
    <div class="panel practice-tip"><div class="word-row"><span class="word-letter">✿</span><div class="word-meta"><strong>Uma sessão de 5 minutos</strong><small>${practiceSource === "dictionary" ? "Palavras e definições carregadas de APIs públicas." : "Flashcards mostram a definição; na múltipla escolha, você associa a palavra à tradução."}</small></div></div></div>
      <button class="button" data-action="start-practice" ${canStart ? "" : "disabled"}>Começar a jogar →</button>
    </div>
    <section class="section-heading"><div><h2>Seu progresso nas revisões</h2><p>Aprender também é tentar, errar e tentar de novo.</p></div></section><div class="stats-row"><div class="stat-card"><span class="stat-icon">▤</span><div><strong>${state.reviews.length}</strong><small>respostas tentadas</small></div></div><div class="stat-card"><span class="stat-icon">✳</span><div><strong>${state.reviews.filter((review) => review.correct).length}</strong><small>lembradas de primeira</small></div></div><div class="stat-card"><span class="stat-icon">◷</span><div><strong>${due}</strong><small>palavras prontas agora</small></div></div><div class="stat-card"><span class="stat-icon">▧</span><div><strong>${practiceWords.length}</strong><small>palavras no vocabulário</small></div></div></div>`;
}

function getPracticeWords() {
  return state.words.filter((word) => word.definition?.trim());
}

function getQuizPracticeWords() {
  return getPracticeWords().filter((word) => word.translation?.trim());
}

async function beginPractice() {
  if (practiceLoading || practiceSession) return;
  const source = practiceSource;
  const mode = practiceMode;
  let words = getPracticeWords();
  let dictionaryWords;
  if (source === "dictionary") {
    practiceLoading = true;
    document.querySelectorAll("[data-source], [data-mode], [data-action='start-practice']").forEach((button) => { button.disabled = true; });
    document.querySelector("[data-action='start-practice']").textContent = "Carregando palavras…";
    try {
      const response = await fetch("/api/dictionary/practice?count=20");
      const result = await response.json();
      if (!response.ok || !Array.isArray(result.words) || result.words.length === 0) {
        throw new Error(result.error || "As APIs públicas não retornaram palavras para praticar.");
      }
      dictionaryWords = result.words;
    } catch (error) {
      practiceLoading = false;
      console.error("Could not load words for dictionary practice.", error);
      renderPractice();
      showToast(error.message || "Não consegui carregar palavras online. Tente novamente.", true);
      return;
    }
    practiceLoading = false;
  } else if (mode === "quiz") {
    words = getQuizPracticeWords();
  }
  if (source === "vocabulary" && !words.length) {
    showToast("Salve palavras com definição no seu vocabulário antes de jogar.", true);
    return;
  }
  if (mode === "quiz" && source === "vocabulary" && new Set(words.map((word) => word.translation.trim().toLocaleLowerCase())).size < 2) {
    showToast("A múltipla escolha precisa de pelo menos duas traduções diferentes.", true);
    return;
  }
  const now = Date.now();
  const sorted = dictionaryWords || [...words].sort((a, b) => {
    const aDue = !a.dueAt || new Date(a.dueAt).getTime() <= now;
    const bDue = !b.dueAt || new Date(b.dueAt).getTime() <= now;
    return Number(bDue) - Number(aDue) || (a.correctStreak || 0) - (b.correctStreak || 0) || a.term.localeCompare(b.term);
  });
  practiceSummary = null;
  const startedAt = Date.now();
  practiceSession = { source, queue: sorted.slice(0, Math.min(20, sorted.length)).map((word) => source === "dictionary" ? word : word.normalized), index: 0, round: 1, correct: 0, answeredCount: 0, answered: false, selected: null, answerDraft: "", quizOptions: null, startedAt, endsAt: startedAt + 5 * 60 * 1000, secondsLeft: 300, mode };
  practiceTimer = setInterval(() => {
    if (!practiceSession) return;
    practiceSession.secondsLeft = Math.max(0, Math.ceil((practiceSession.endsAt - Date.now()) / 1000));
    if (practiceSession.secondsLeft <= 0) finishPractice();
    else {
      const timer = document.querySelector("#practice-timer");
      if (timer) timer.textContent = formatTimer(practiceSession.secondsLeft);
    }
  }, 1000);
  render();
}

function stopPracticeTimer() {
  clearInterval(practiceTimer);
  practiceTimer = null;
}

function finishPractice() {
  stopPracticeTimer();
  const session = practiceSession;
  practiceSession = null;
  if (!session) return;
  const elapsedSeconds = Math.min(300, Math.max(0, Math.floor((Date.now() - session.startedAt) / 1000)));
  persist();
  currentPage = "practice";
  practiceSummary = {
    message: session.answeredCount
      ? `Você lembrou ${session.correct} de ${session.answeredCount} ${session.answeredCount === 1 ? "palavra" : "palavras"}. Volta pro seu livro com mais uma vitória no bolso.`
      : "Rodada encerrada. Quando quiser, você pode tentar de novo.",
    duration: elapsedSeconds < 60 ? "Menos de 1 min" : formatDuration(elapsedSeconds),
    correct: session.correct,
    answered: session.answeredCount
  };
  render();
}

function formatTimer(seconds) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function renderPracticeSession() {
  const session = practiceSession;
  const word = session.source === "dictionary"
    ? session.queue[session.index]
    : state.words.find((item) => item.normalized === session.queue[session.index]);
  if (!word) {
    session.index += 1;
    if (session.index >= session.queue.length) {
      finishPractice();
      return;
    }
    renderPracticeSession();
    return;
  }
  const progress = Math.round(((session.index + (session.answered ? 1 : 0)) / session.queue.length) * 100);
  let main = "";
  if (session.mode === "quiz") {
    session.quizOptions ||= session.source === "dictionary" ? createDictionaryQuizOptions(word, session.queue) : createQuizOptions(word);
    const options = session.quizOptions;
    const dictionaryQuestion = session.source === "dictionary";
    const prompt = dictionaryQuestion
      ? `<div class="prompt-label">Qual palavra corresponde à definição?</div>${word.definition ? `<p class="prompt-definition">${escapeHtml(word.definition)}</p>` : ""}`
      : `<div class="prompt-label">O que significa esta palavra?</div><div class="prompt-word">${escapeHtml(word.term)}</div>${word.definition ? `<p class="prompt-definition">${escapeHtml(word.definition)}</p>` : ""}`;
    const correctAnswer = dictionaryQuestion ? word.term : word.translation;
    main = `${prompt}<div class="quiz-options">${options.map((option) => `<button class="quiz-option ${session.answered && option.correct ? "correct" : ""} ${session.answered && session.selected === option.value && !option.correct ? "wrong" : ""}" data-quiz-option="${escapeHtml(option.value)}" ${session.answered ? "disabled" : ""}>${escapeHtml(option.value)}</button>`).join("")}</div>${session.answered ? `<div class="answer-box ${session.selected === correctAnswer ? "answer-correct" : "answer-wrong"}">${session.selected === correctAnswer ? "Isso! ✨" : `Quase! A resposta era: ${escapeHtml(correctAnswer)}`}</div><div class="rating-actions"><button class="button" data-action="next-word">Próxima palavra →</button></div>` : ""}`;
  } else {
    const letters = [...word.term].filter((character) => /[a-z]/i.test(character)).length;
    const slots = renderAnswerSlots(word.term, session.answerDraft);
    main = `<div class="prompt-label">Leia a definição e digite a palavra</div><p class="prompt-definition">${escapeHtml(word.definition || "Definição indisponível.")}</p>${session.answered ? `<div class="answer-box ${session.correctAnswer ? "answer-correct" : "answer-wrong"}">${session.correctAnswer ? "Isso! Palavra correta. ✨" : `Quase! A palavra era: ${escapeHtml(word.term)}`}</div><div class="rating-actions"><button class="button" data-action="next-word">Próxima palavra →</button></div>` : `<form id="flashcard-answer-form" class="flashcard-answer-form"><label class="letter-slots-label" for="word-answer">Sua resposta · ${letters} ${letters === 1 ? "letra" : "letras"}</label><div class="letter-input-wrap"><div class="letter-slots" aria-hidden="true">${slots}</div><input id="word-answer" class="letter-answer-input" type="text" value="${escapeHtml(session.answerDraft)}" maxlength="${word.term.length}" autocomplete="off" autocapitalize="none" spellcheck="false" aria-label="Digite a palavra correspondente à definição" /></div><button class="button" type="submit" ${session.answerDraft.trim() ? "" : "disabled"}>Conferir resposta</button></form>`}`;
  }
  view.innerHTML = `<div class="practice-screen"><section class="page-intro"><span class="eyebrow">SUA PAUSA DE CINCO MINUTOS</span><h1>Você consegue ✿</h1><p>${session.mode === "flashcard" ? "Leia a definição, digite a palavra e confira sua resposta." : "Pense um pouquinho antes de escolher a resposta."}</p></section>
    <div class="session-card"><div class="session-top"><span>Volta ${session.round} · Palavra ${session.index + 1} de ${session.queue.length}</span><span class="timer" id="practice-timer" role="timer">${formatTimer(session.secondsLeft)}</span></div><div class="session-progress" role="progressbar" aria-label="Progresso desta volta" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress}"><span style="width:${progress}%"></span></div>${main}</div><div class="practice-end"><button class="text-button" data-action="end-practice">Encerrar sessão</button></div></div>`;
}

function renderAnswerSlots(term, value) {
  const typedLetters = [...value.toLocaleLowerCase()].filter((character) => /[a-z]/i.test(character));
  let letterIndex = 0;
  return [...term].map((character) => {
    if (!/[a-z]/i.test(character)) return `<span class="letter-slot-separator">${escapeHtml(character)}</span>`;
    const letter = typedLetters[letterIndex] || "";
    letterIndex += 1;
    return `<span class="letter-slot">${escapeHtml(letter)}</span>`;
  }).join("");
}

function createQuizOptions(word) {
  const correctTranslation = word.translation.trim();
  const distractors = sortedWords(getQuizPracticeWords().filter((item) => item.normalized !== word.normalized && item.translation.trim().toLocaleLowerCase() !== correctTranslation.toLocaleLowerCase())).map((item) => item.translation.trim());
  const uniqueDistractors = [...new Map(distractors.map((value) => [value.toLocaleLowerCase(), value])).values()].slice(0, 3);
  const options = [{ value: correctTranslation, correct: true }, ...uniqueDistractors.map((value) => ({ value, correct: false }))];
  return shuffle(options);
}

function createDictionaryQuizOptions(word, words) {
  const distractors = shuffle(words.filter((item) => item.term !== word.term)).slice(0, 3);
  return shuffle([
    { value: word.term, correct: true },
    ...distractors.map((item) => ({ value: item.term, correct: false }))
  ]);
}

function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function answerPractice(correct, selected = null) {
  const session = practiceSession;
  if (!session || session.answered) return;
  const word = session.source === "dictionary"
    ? session.queue[session.index]
    : state.words.find((item) => item.normalized === session.queue[session.index]);
  if (!word) return;
  session.answered = true;
  session.answeredCount += 1;
  session.selected = selected;
  session.correctAnswer = Boolean(correct);
  const gotIt = Boolean(correct);
  session.correct += gotIt ? 1 : 0;
  if (session.source === "vocabulary") {
    word.correctStreak = gotIt ? (word.correctStreak || 0) + 1 : 0;
    if (gotIt) {
      const nextInterval = word.intervalDays ? Math.min(60, Math.round(word.intervalDays * 2)) : 1;
      word.intervalDays = nextInterval;
      word.dueAt = new Date(Date.now() + nextInterval * DAY).toISOString();
    } else {
      word.intervalDays = 0;
      word.dueAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    }
  }
  state.reviews.push({ at: new Date().toISOString(), term: word.term, correct: gotIt, mode: session.mode });
  persist();
  renderPracticeSession();
}

function checkFlashcardAnswer() {
  const session = practiceSession;
  if (!session || session.answered || session.mode !== "flashcard") return;
  const word = session.source === "dictionary"
    ? session.queue[session.index]
    : state.words.find((item) => item.normalized === session.queue[session.index]);
  if (!word) return;
  const answer = session.answerDraft.trim().toLocaleLowerCase("en-US").replace(/\s+/g, " ");
  answerPractice(answer === word.term.trim().toLocaleLowerCase("en-US"), session.answerDraft);
}

function nextPracticeWord() {
  if (!practiceSession) return;
  if (practiceSession.index + 1 >= practiceSession.queue.length) {
    practiceSession.index = 0;
    practiceSession.round += 1;
  } else {
    practiceSession.index += 1;
  }
  practiceSession.answered = false;
  practiceSession.selected = null;
  practiceSession.answerDraft = "";
  practiceSession.correctAnswer = false;
  practiceSession.quizOptions = null;
  renderPracticeSession();
}

function openSettings() {
  const dataStorageNote = sessionUser
    ? "Sua conta Google sincroniza palavras e progresso com o Supabase. Os resultados de dicionário, tradução, sugestões e áudio vêm de APIs públicas."
    : isSupabaseConfigured
      ? "Entre com Google para salvar e sincronizar seus dados no Supabase."
      : "Por enquanto, palavras e progresso ficam salvos neste navegador. Configure o Supabase para sincronizar entre dispositivos.";
  document.querySelector("#modal-root").innerHTML = `<div class="modal-backdrop" data-close-modal><section class="modal" role="dialog" aria-modal="true" aria-labelledby="settings-title"><div class="modal-header"><div><span class="eyebrow">SEU CANTINHO</span><h2 id="settings-title">Configurações</h2></div><button class="modal-close" data-close-modal aria-label="Fechar">×</button></div>
    <form id="settings-form"><label class="input-label">Meta diária de leitura (minutos)</label><input class="field" type="number" min="1" max="1440" name="dailyGoal" value="${settings.dailyGoal}" required />
    <p class="modal-note">${dataStorageNote} APIs públicas podem ter limites ou indisponibilidade.</p><div class="form-actions"><button class="button" type="submit">Salvar configurações</button></div></form></section></div>`;
}

document.addEventListener("click", async (event) => {
  const target = event.target.closest("button, a, [data-close-modal]");
  if (!target) return;
  if (target.dataset.action === "sign-in") {
    await signInWithGoogle();
    return;
  }
  if (target.dataset.action === "sign-out") {
    await signOut();
    return;
  }
  if (target.dataset.action === "retry-cloud-load") {
    if (sessionUser) await loadSignedInAccount(sessionUser);
    return;
  }
  if (target.matches("[data-page]")) {
    event.preventDefault();
    setPage(target.dataset.page);
    return;
  }
  if (target.id === "open-settings") {
    openSettings();
    return;
  }
  if (target.hasAttribute("data-delete-session")) {
    event.preventDefault();
    confirmDeleteReadingSession(target.dataset.deleteSession);
    return;
  }
  if (target.hasAttribute("data-suggestion")) {
    const input = document.querySelector("#lookup-input");
    const word = target.dataset.suggestion;
    if (input) input.value = word;
    hideWordSuggestions();
    lookupWord(word);
    return;
  }
  if (target.dataset.action === "confirm-delete-session") {
    if (deleteReadingSession()) document.querySelector("#modal-root").innerHTML = "";
    return;
  }
  if (target.id === "mobile-menu") {
    document.querySelector(".sidebar").classList.toggle("open");
    return;
  }
  if (target.dataset.action === "start-reading") {
    startReadingSession();
    return;
  }
  if (target.dataset.action === "resume-reading") {
    resumeReadingSession();
    return;
  }
  if (target.dataset.action === "finish-reading") {
    requestFinishReading();
    return;
  }
  if (target.dataset.action === "discard-reading") {
    confirmDiscardReadingSession();
    return;
  }
  if (target.dataset.action === "confirm-discard-reading") {
    discardReadingSession();
    document.querySelector("#modal-root").innerHTML = "";
    return;
  }
  if (target.hasAttribute("data-close-modal")) {
    if (target.classList.contains("modal-backdrop") && event.target !== target) return;
    pendingDeleteReadingSessionId = null;
    document.querySelector("#modal-root").innerHTML = "";
    return;
  }
  if (target.dataset.audio) {
    new Audio(target.dataset.audio.startsWith("//") ? `https:${target.dataset.audio}` : target.dataset.audio).play().catch(() => showToast("Não consegui reproduzir este áudio.", true));
    return;
  }
  if (target.dataset.source) {
    if (practiceLoading) return;
    practiceSource = target.dataset.source;
    renderPractice();
    return;
  }
  if (target.dataset.mode) {
    if (practiceLoading) return;
    practiceMode = target.dataset.mode;
    renderPractice();
    return;
  }
  if (target.dataset.action === "start-practice") {
    beginPractice();
    return;
  }
  if (target.dataset.action === "next-word") {
    nextPracticeWord();
    return;
  }
  if (target.dataset.action === "end-practice") {
    finishPractice();
    return;
  }
  if (target.dataset.action === "dismiss-summary") {
    practiceSummary = null;
    renderPractice();
    return;
  }
  if (target.hasAttribute("data-quiz-option")) {
    const value = target.dataset.quizOption;
    const word = practiceSession.source === "dictionary"
      ? practiceSession.queue[practiceSession.index]
      : state.words.find((item) => item.normalized === practiceSession.queue[practiceSession.index]);
    answerPractice(value === (practiceSession.source === "dictionary" ? word.term : word.translation), value);
    return;
  }
  if (target.hasAttribute("data-delete-word")) {
    const term = state.words.find((word) => word.normalized === target.dataset.deleteWord)?.term;
    if (!window.confirm(`Remover “${term}” do seu vocabulário?`)) return;
    state.words = state.words.filter((word) => word.normalized !== target.dataset.deleteWord);
    persist();
    renderWords();
    return;
  }
  if (target.hasAttribute("data-translation-choice")) {
    const resultWord = searchResult?.word;
    const translation = target.dataset.translationChoice;
    if (!resultWord || !resultWord.translationOptions?.includes(translation)) return;
    const word = state.words.find((item) => item.normalized === resultWord.normalized);
    if (!word) return;
    word.translation = translation;
    resultWord.translation = translation;
    if (state.activeReadingSession && !state.activeReadingSession.endedAt) {
      state.activeReadingSession.lookups.forEach((lookup) => {
        if (lookup.normalized === word.normalized) lookup.translation = translation;
      });
    }
    persist();
    renderReading();
  }
});

document.addEventListener("submit", (event) => {
  if (event.target.id === "flashcard-answer-form") {
    event.preventDefault();
    checkFlashcardAnswer();
    return;
  }
  if (event.target.id === "lookup-form") {
    event.preventDefault();
    const input = document.querySelector("#lookup-input");
    hideWordSuggestions();
    lookupWord(input.value);
  }
  if (event.target.id === "finish-reading-form") {
    event.preventDefault();
    const pagesValue = document.querySelector("#reading-pages").value.trim();
    const pages = pagesValue ? Number(pagesValue) : 0;
    const note = document.querySelector("#reading-note").value.trim();
    if (pagesValue && (!Number.isInteger(pages) || pages < 1 || pages > 10000)) {
      showToast("Informe um número de páginas inteiro entre 1 e 10000.", true);
      return;
    }
    saveReadingSession(pages, note);
  }
  if (event.target.id === "settings-form") {
    event.preventDefault();
    const formData = new FormData(event.target);
    const goal = Number(formData.get("dailyGoal"));
    if (!Number.isInteger(goal) || goal < 1 || goal > 1440) {
      showToast("A meta diária deve ser de 1 a 1440 minutos.", true);
      return;
    }
    settings = { dailyGoal: goal };
    if (persistSettings()) {
      document.querySelector("#modal-root").innerHTML = "";
      render();
      showToast("Configurações salvas!");
    }
  }
});

document.addEventListener("input", (event) => {
  if (event.target.id === "word-answer" && practiceSession) {
    practiceSession.answerDraft = event.target.value;
    const word = practiceSession.source === "dictionary"
      ? practiceSession.queue[practiceSession.index]
      : state.words.find((item) => item.normalized === practiceSession.queue[practiceSession.index]);
    const slots = document.querySelector(".letter-slots");
    const submitButton = document.querySelector("#flashcard-answer-form button[type='submit']");
    if (word && slots) slots.innerHTML = renderAnswerSlots(word.term, practiceSession.answerDraft);
    if (submitButton) submitButton.disabled = !practiceSession.answerDraft.trim();
  }
  if (event.target.id === "lookup-input") {
    clearTimeout(suggestionTimeout);
    const query = event.target.value;
    suggestionTimeout = setTimeout(() => updateWordSuggestions(query), 120);
  }
  if (event.target.id === "words-filter") {
    wordsFilter = event.target.value;
    const cursor = event.target.selectionStart;
    renderWords();
    const input = document.querySelector("#words-filter");
    input.focus();
    input.setSelectionRange(cursor, cursor);
  }
});

document.addEventListener("keydown", (event) => {
  if (event.target.id !== "lookup-input") return;
  if (event.key === "ArrowDown") {
    if (moveActiveSuggestion(1)) event.preventDefault();
    return;
  }
  if (event.key === "ArrowUp") {
    if (moveActiveSuggestion(-1)) event.preventDefault();
    return;
  }
  if (event.key === "Escape") {
    hideWordSuggestions();
    return;
  }
  if (event.key === "Enter" && activeSuggestionIndex >= 0) {
    const option = document.querySelectorAll("#lookup-suggestions .suggestion-option")[activeSuggestionIndex];
    if (option) {
      event.preventDefault();
      const word = option.dataset.suggestion;
      event.target.value = word;
      hideWordSuggestions();
      lookupWord(word);
    }
  }
});

initializeAuth();
render();
