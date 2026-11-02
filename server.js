import { createServer } from "node:http";
import { createReadStream, statSync } from "node:fs";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)));
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "127.0.0.1";
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  createServer((request, response) => {
    handleRequest(request, response).catch((error) => {
      console.error("Request failed.", error);
      if (!response.headersSent) {
        sendJson(response, 500, { error: "Internal server error." });
      } else {
        response.destroy(error);
      }
    });
  }).listen(port, host, () => {
    console.log(`Wordtrail API and local preview running at http://${host}:${port}`);
  });
}

export async function handleRequest(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const pathname = url.pathname;
  if (pathname === "/api/translate") {
    if (request.method !== "POST") {
      sendJson(response, 405, { error: "Method not allowed." }, { Allow: "POST" });
      return;
    }
    let body;
    try {
      body = await readJsonBody(request, 5_000);
    } catch (error) {
      sendJson(response, error.statusCode || 400, { error: error.message });
      return;
    }
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text || text.length > 500) {
      sendJson(response, 400, { error: "Text of up to 500 characters is required." });
      return;
    }
    const translationUrl = new URL("https://api.mymemory.translated.net/get");
    translationUrl.searchParams.set("q", text);
    translationUrl.searchParams.set("langpair", "en|pt");
    let translationData;
    try {
      translationData = await fetchJson(translationUrl, "MyMemory");
    } catch (error) {
      console.error("MyMemory is unavailable.", error);
      sendJson(response, 502, { error: "A API pública de tradução está indisponível. Tente novamente." });
      return;
    }
    if (translationData.responseStatus !== 200 || translationData.quotaFinished) {
      console.error("MyMemory returned an unsuccessful response.", translationData);
      sendJson(response, 502, { error: translationData.responseDetails || "A API pública de tradução não conseguiu traduzir este texto." });
      return;
    }
    const translations = [...new Set([
      translationData.responseData?.translatedText,
      ...(Array.isArray(translationData.matches) ? translationData.matches.map((match) => match.translation) : [])
    ].filter((translation) => typeof translation === "string" && translation.trim() && !sameText(text, translation)))];
    if (!translations.length) {
      sendJson(response, 502, { error: "A API não retornou uma tradução diferente do termo em inglês." });
      return;
    }
    sendJson(response, 200, { translatedText: translations[0], translations, source: "mymemory" }, { "Cache-Control": "no-store" });
    return;
  }

  if (pathname === "/api/dictionary/practice") {
    if (request.method !== "GET") {
      sendJson(response, 405, { error: "Method not allowed." }, { Allow: "GET" });
      return;
    }
    const requestedCount = Number(url.searchParams.get("count") || 20);
    const count = Number.isInteger(requestedCount) ? Math.min(20, Math.max(1, requestedCount)) : 20;
    let randomWords;
    try {
      randomWords = await fetchJson(`https://random-word-api.herokuapp.com/word?number=${Math.min(40, count * 2)}`, "Random Word API");
    } catch (error) {
      console.error("Random Word API is unavailable.", error);
      sendJson(response, 502, { error: "A API de palavras aleatórias está indisponível. Tente novamente." });
      return;
    }
    if (!Array.isArray(randomWords)) {
      sendJson(response, 502, { error: "A API de palavras aleatórias retornou dados inválidos." });
      return;
    }
    const terms = [...new Set(randomWords.filter((word) => typeof word === "string" && /^[a-z]+(?:[-'][a-z]+)*$/i.test(word)))];
    const words = [];
    const failures = [];
    for (let start = 0; start < terms.length && words.length < count; start += 8) {
      const outcomes = await Promise.allSettled(terms.slice(start, start + 8).map(async (term) => {
        const entry = await fetchDictionaryEntry(term);
        return toPracticeWord(entry);
      }));
      words.push(...outcomes
        .filter((outcome) => outcome.status === "fulfilled" && outcome.value)
        .map((outcome) => outcome.value));
      failures.push(...outcomes.filter((outcome) => outcome.status === "rejected").map((outcome) => outcome.reason));
    }
    if (!words.length && failures.length) {
      console.error("Dictionary API failed while loading online practice words.", failures);
      sendJson(response, 502, { error: "A API de dicionário não conseguiu carregar palavras para o jogo." });
      return;
    }
    sendJson(response, 200, { words: words.slice(0, count) }, { "Cache-Control": "no-store" });
    return;
  }

  if (pathname === "/api/dictionary/suggest") {
    if (request.method !== "GET") {
      sendJson(response, 405, { error: "Method not allowed." }, { Allow: "GET" });
      return;
    }
    const query = url.searchParams.get("q")?.trim().toLocaleLowerCase("en-US") || "";
    if (query.length < 2 || query.length > 100 || !/^[a-z][a-z'-]*$/i.test(query)) {
      sendJson(response, 200, { suggestions: [] }, { "Cache-Control": "public, max-age=60" });
      return;
    }
    const suggestionsUrl = new URL("https://api.datamuse.com/words");
    suggestionsUrl.searchParams.set("sp", `${query}*`);
    suggestionsUrl.searchParams.set("max", "8");
    try {
      const suggestionsData = await fetchJson(suggestionsUrl, "Datamuse");
      const suggestions = Array.isArray(suggestionsData)
        ? suggestionsData.map((item) => item.word).filter((word) => typeof word === "string" && /^[a-z][a-z'-]*$/i.test(word)).slice(0, 8)
        : [];
      sendJson(response, 200, { suggestions }, { "Cache-Control": "public, max-age=300" });
    } catch (error) {
      console.error("Datamuse suggestions are unavailable.", error);
      sendJson(response, 502, { error: "A API pública de sugestões está indisponível." });
    }
    return;
  }

  if (pathname === "/api/dictionary") {
    if (request.method !== "GET") {
      sendJson(response, 405, { error: "Method not allowed." }, { Allow: "GET" });
      return;
    }
    const word = url.searchParams.get("word")?.trim();
    if (!word || word.length > 100 || !/^[a-zA-Z][a-zA-Z' -]*$/.test(word)) {
      sendJson(response, 400, { error: "A word or short phrase in English is required." });
      return;
    }
    try {
      const entries = await fetchDictionaryEntry(word);
      if (!entries) {
        sendJson(response, 404, { error: "The online dictionary did not find this word." });
        return;
      }
      sendJson(response, 200, entries, { "Cache-Control": "public, max-age=86400" });
    } catch (error) {
      console.error("Dictionary API is unavailable.", error);
      sendJson(response, 502, { error: "A API pública de dicionário está indisponível. Tente novamente." });
    }
    return;
  }

  const requestedPath = pathname === "/" ? "/index.html" : decodeURIComponent(pathname);
  const filePath = resolve(root, `.${requestedPath}`);

  if (!filePath.startsWith(`${root}${sep}`) || !statExists(filePath)) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", "X-Content-Type-Options": "nosniff" });
    response.end("Not found");
    return;
  }

  response.writeHead(200, { "Content-Type": contentTypes[extname(filePath)] || "application/octet-stream", "X-Content-Type-Options": "nosniff" });
  createReadStream(filePath).pipe(response);
}

async function fetchJson(url, serviceName) {
  let response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  } catch (error) {
    throw new Error(`${serviceName} request failed.`, { cause: error });
  }
  let data;
  try {
    data = await response.json();
  } catch (error) {
    throw new Error(`${serviceName} returned invalid JSON.`, { cause: error });
  }
  if (!response.ok) {
    if (response.status === 404 && serviceName === "Free Dictionary API") return null;
    throw new Error(`${serviceName} returned HTTP ${response.status}.`);
  }
  return data;
}

async function fetchDictionaryEntry(word) {
  const entries = await fetchJson(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, "Free Dictionary API");
  if (!Array.isArray(entries) || !entries.length) return null;
  const entry = entries[0];
  const definitions = [];
  const partsOfSpeech = [];
  for (const meaning of entry.meanings || []) {
    if (meaning.partOfSpeech && !partsOfSpeech.includes(meaning.partOfSpeech)) partsOfSpeech.push(meaning.partOfSpeech);
    for (const item of meaning.definitions || []) {
      if (item.definition && !definitions.includes(item.definition)) definitions.push(item.definition);
      if (definitions.length === 3) break;
    }
    if (definitions.length === 3) break;
  }
  const phonetics = Array.isArray(entry.phonetics) ? entry.phonetics : [];
  const phonetic = (entry.phonetic || phonetics.find((item) => item.text)?.text || "").replace(/^\/|\/$/g, "");
  const audio = phonetics.find((item) => /^https:\/\//i.test(item.audio || ""))?.audio || "";
  return {
    word: entry.word || word,
    definition: definitions.map((definition, index) => `${index + 1}. ${definition}`).join("\n"),
    partOfSpeech: partsOfSpeech.join(", "),
    phonetic,
    audio,
    definitionSource: "dictionaryapi.dev"
  };
}

function toPracticeWord(entry) {
  if (!entry?.definition) return null;
  return { term: entry.word, definition: entry.definition, partOfSpeech: entry.partOfSpeech };
}

function sameText(left, right) {
  const normalize = (value) => String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toLocaleLowerCase();
  return normalize(left) === normalize(right);
}

function sendJson(response, status, data, headers = {}) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
    ...headers
  });
  response.end(JSON.stringify(data));
}

async function readJsonBody(request, maxBytes) {
  let body = "";
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > maxBytes) {
      const error = new Error("Request body is too large.");
      error.statusCode = 413;
      throw error;
    }
    body += chunk;
  }
  try {
    return JSON.parse(body);
  } catch {
    throw new Error("A valid JSON request body is required.");
  }
}

function statExists(path) {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}
