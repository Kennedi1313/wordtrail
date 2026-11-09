import { NextResponse } from "next/server";
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
  const count = Math.min(
    20,
    Math.max(1, Number(new URL(request.url).searchParams.get("count") || 20)),
  );
  const random = await fetch(
    `https://random-word-api.herokuapp.com/word?number=${count * 2}`,
  );
  if (!random.ok)
    return NextResponse.json(
      { error: "Random word API unavailable." },
      { status: 502 },
    );
  const randomWords: unknown = await random.json();
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
  const words = (
    await Promise.all(
      terms.map(async (term) => {
        const response = await fetch(
          `https://www.dictionaryapi.com/api/v3/references/collegiate/json/${encodeURIComponent(term)}?key=${encodeURIComponent(key)}`,
          { next: { revalidate: 86400 } },
        );
        if (!response.ok) return null;
        const entries = (await response.json()) as Entry[];
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
    )
  ).filter((word): word is NonNullable<typeof word> =>
    Boolean(word?.definition),
  );
  return NextResponse.json({ words: words.slice(0, count) });
}
