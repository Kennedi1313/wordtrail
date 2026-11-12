import { getJson } from "@/lib/api/client";
import { Word } from "@/types/domain";

export async function lookupWord(term: string): Promise<Partial<Word>> {
  const normalized = term.trim().toLowerCase();
  if (!normalized) throw new Error("Digite uma palavra.");
  return getJson<Partial<Word>>(
    `/api/dictionary/lookup?term=${encodeURIComponent(normalized)}`,
  );
}

export async function suggestWords(query: string): Promise<string[]> {
  const data = await getJson<{ suggestions?: string[] }>(
    `/api/dictionary/suggest?q=${encodeURIComponent(query)}`,
  );
  return data.suggestions || [];
}
