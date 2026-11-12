import { NextResponse } from "next/server";
import { fetchWithTimeout } from "@/lib/api/fetch-with-timeout";
import { parsePracticeCount } from "@/lib/api/request-validation";
type Entry = {
  shortdef?: string[];
  def?: unknown[];
  hwi?: { prs?: { mw?: string; sound?: { audio?: string } }[] };
};

function collectExamples(value: unknown, examples: string[] = []) {
  if (!Array.isArray(value)) {
    if (value && typeof value === "object")
      Object.values(value).forEach((item) => collectExamples(item, examples));
    return examples;
  }
  if (value[0] === "vis" && Array.isArray(value[1]))
    value[1].forEach((item) => {
      if (
        item &&
        typeof item === "object" &&
        typeof (item as { t?: unknown }).t === "string"
      )
        examples.push(
          (item as { t: string }).t.replaceAll(/{\/?(?:it|wi|phrase)}/g, ""),
        );
    });
  value.forEach((item) => collectExamples(item, examples));
  return examples;
}
export async function GET(request: Request) {
  const key = process.env.MERRIAM_WEBSTER_API_KEY;
  if (!key)
    return NextResponse.json(
      { error: "Merriam-Webster API key is not configured." },
      { status: 503 },
    );
  const count = parsePracticeCount(new URL(request.url).searchParams.get("count"));
  const random = await fetchWithTimeout(
    `https://random-word-api.herokuapp.com/word?number=${count * 2}`,
  ).catch(() => null);
  if (!random)
    return NextResponse.json({ error: "Random word request timed out." }, { status: 504 });
  if (!random.ok)
    return NextResponse.json(
      { error: "Random word API unavailable." },
      { status: 502 },
    );
  let randomWords: unknown;
  try {
    randomWords = await random.json();
  } catch {
    return NextResponse.json({ error: "Random word API returned an invalid response." }, { status: 502 });
  }
  const terms: string[] = Array.isArray(randomWords)
    ? [
        ...new Set(
          randomWords.filter(
            (word: unknown): word is string =>
              typeof word === "string" && /^[a-z]+(?:[-'][a-z]+)*$/i.test(word),
          ),
        ),
      ]
    : [];
  const boundedTerms = terms.slice(0, count);
  const words = [];
  for (let offset = 0; offset < boundedTerms.length; offset += 5) {
    const batch = await Promise.all(
      boundedTerms.slice(offset, offset + 5).map(async (term) => {
        const response = await fetchWithTimeout(
          `https://www.dictionaryapi.com/api/v3/references/collegiate/json/${encodeURIComponent(term)}?key=${encodeURIComponent(key)}`,
          { next: { revalidate: 86400 } },
        ).catch(() => null);
        if (!response?.ok) return null;
        let payload: unknown;
        try {
          payload = await response.json();
        } catch {
          return null;
        }
        if (!Array.isArray(payload)) return null;
        const entries = payload as Entry[];
        const entry = entries.find((item) => item.shortdef?.length);
        return {
          term,
          normalized: term.toLowerCase(),
          definition: entry?.shortdef?.[0] || "",
          examples: [...new Set(collectExamples(entry?.def))].slice(0, 2),
          phonetic: entry?.hwi?.prs?.find((item) => item.mw)?.mw,
          audio: entry?.hwi?.prs?.find((item) => item.sound?.audio)?.sound
            ?.audio,
          lookups: 0,
        };
      }),
    );
    words.push(...batch.filter((word): word is NonNullable<typeof word> => Boolean(word?.definition)));
  }
  return NextResponse.json({ words: words.slice(0, count) });
}
