import { getJson } from "@/lib/api/client";
import { Word } from "@/types/domain";

export async function lookupWord(term: string): Promise<Partial<Word>> {
  const normalized = term.trim().toLowerCase();
  if (!normalized) throw new Error("Digite uma palavra.");
  return getJson<Partial<Word>>(
    `/api/dictionary/lookup?term=${encodeURIComponent(normalized)}`,
  );
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
