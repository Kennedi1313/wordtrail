import { NextResponse } from "next/server";
type Entry = {
  word?: string;
  phonetic?: string;
  phonetics?: { text?: string; audio?: string }[];
  meanings?: { definitions?: { definition?: string }[] }[];
};
export async function GET(request: Request) {
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
          `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(term)}`,
        );
        if (!response.ok) return null;
        const entries = (await response.json()) as Entry[];
        const entry = entries[0];
        return {
          term,
          normalized: term.toLowerCase(),
          definition:
            entry?.meanings
              ?.flatMap((meaning) => meaning.definitions || [])
              .find((item) => item.definition)?.definition || "",
          phonetic:
            entry?.phonetic ||
            entry?.phonetics?.find((item) => item.text)?.text,
          audio: entry?.phonetics?.find((item) => item.audio)?.audio,
          lookups: 0,
        };
      }),
    )
  ).filter((word): word is NonNullable<typeof word> =>
    Boolean(word?.definition),
  );
  return NextResponse.json({ words: words.slice(0, count) });
}
