import { getJson } from "@/lib/api/client";
import { Word } from "@/types/domain";

type DictionaryEntry = {
  word?: string;
  phonetic?: string;
  phonetics?: { text?: string; audio?: string }[];
  meanings?: {
    partOfSpeech?: string;
    definitions?: { definition?: string }[];
  }[];
};

export async function lookupWord(term: string): Promise<Partial<Word>> {
  const normalized = term.trim().toLowerCase();
  if (!normalized) throw new Error("Digite uma palavra.");
  const entries = await getJson<DictionaryEntry[]>(
    `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(normalized)}`,
  );
  const entry = entries[0];
  const phonetic =
    entry?.phonetic || entry?.phonetics?.find((item) => item.text)?.text;
  const audio = entry?.phonetics?.find((item) => item.audio)?.audio;
  const definitions: string[] = [];
  const partsOfSpeech: string[] = [];
  for (const meaning of entry?.meanings || []) {
    if (meaning.partOfSpeech && !partsOfSpeech.includes(meaning.partOfSpeech))
      partsOfSpeech.push(meaning.partOfSpeech);
    for (const item of meaning.definitions || []) {
      if (item.definition && !definitions.includes(item.definition))
        definitions.push(item.definition);
      if (definitions.length === 3) break;
    }
    if (definitions.length === 3) break;
  }
  return {
    term: entry?.word || normalized,
    normalized,
    phonetic: phonetic?.replace(/^\/|\/$/g, ""),
    audio,
    definition: definitions
      .map((item, index) => `${index + 1}. ${item}`)
      .join("\n"),
    partOfSpeech: partsOfSpeech.join(", "),
    definitionSource: definitions.length ? "dictionaryapi.dev" : "",
  };
}

export async function translateWordOptions(
  term: string,
): Promise<{ translation: string; options: string[] }> {
  const response = await getJson<{
    translatedText?: string;
    translations?: string[];
  }>("/api/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: term }),
  });
  const options = response.translations || [];
  return {
    translation: response.translatedText || options[0] || "",
    options,
  };
}

export async function translateWord(term: string): Promise<string> {
  const result = await translateWordOptions(term);
  return result.translation;
}

export async function suggestWords(query: string): Promise<string[]> {
  const data = await getJson<{ suggestions?: string[] }>(
    `/api/dictionary/suggest?q=${encodeURIComponent(query)}`,
  );
  return data.suggestions || [];
}
