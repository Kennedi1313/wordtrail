import { NextResponse } from "next/server";
import { fetchWithTimeout } from "@/lib/api/fetch-with-timeout";
import { isDictionaryTerm } from "@/lib/api/request-validation";

type MerriamEntry = {
  hwi?: { hw?: string; prs?: { mw?: string; sound?: { audio?: string } }[] };
  fl?: string;
  shortdef?: string[];
  def?: unknown[];
  meta?: { id?: string; stems?: string[] };
  et?: unknown[][];
  uros?: { ure?: string; fl?: string }[];
};

function collectDictionaryDetails(
  value: unknown,
  details = { examples: [] as string[], labels: [] as string[] },
) {
  if (!Array.isArray(value)) {
    if (value && typeof value === "object")
      Object.values(value).forEach((item) =>
        collectDictionaryDetails(item, details),
      );
    return details;
  }
  if (value[0] === "vis" && Array.isArray(value[1])) {
    for (const example of value[1])
      if (
        example &&
        typeof example === "object" &&
        typeof (example as { t?: unknown }).t === "string"
      )
        details.examples.push(
          (example as { t: string }).t.replaceAll(/{\/?(?:it|wi|phrase)}/g, ""),
        );
  }
  if (value[0] === "sls" && Array.isArray(value[1]))
    details.labels.push(
      ...value[1].filter((item): item is string => typeof item === "string"),
    );
  value.forEach((item) => collectDictionaryDetails(item, details));
  return details;
}

function audioUrl(audio?: string) {
  if (!audio) return undefined;
  const first = audio[0];
  const subdirectory =
    first === "b" || first === "p" || first === "g"
      ? first
      : first === "a"
        ? "a"
        : `c/${audio.slice(0, 2)}`;
  return `https://media.merriam-webster.com/audio/prons/en/us/mp3/${subdirectory}/${audio}.mp3`;
}

export async function GET(request: Request) {
  const key = process.env.MERRIAM_WEBSTER_API_KEY;
  const term = new URL(request.url).searchParams.get("term")?.trim();
  if (!key)
    return NextResponse.json(
      { error: "Merriam-Webster API key is not configured." },
      { status: 503 },
    );
  if (!term)
    return NextResponse.json({ error: "A word is required." }, { status: 400 });
  if (!isDictionaryTerm(term))
    return NextResponse.json({ error: "Invalid word." }, { status: 400 });

  const response = await fetchWithTimeout(
    `https://www.dictionaryapi.com/api/v3/references/collegiate/json/${encodeURIComponent(term)}?key=${encodeURIComponent(key)}`,
    { next: { revalidate: 86400 } },
  ).catch(() => null);
  if (!response)
    return NextResponse.json({ error: "Dictionary request timed out." }, { status: 504 });
  if (!response.ok)
    return NextResponse.json(
      { error: "Dictionary unavailable." },
      { status: 502 },
    );
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return NextResponse.json({ error: "Dictionary returned an invalid response." }, { status: 502 });
  }
  if (!Array.isArray(payload))
    return NextResponse.json({ error: "Dictionary returned an invalid response." }, { status: 502 });
  const entries = payload as MerriamEntry[];
  const entry = entries.find(
    (item) => item && typeof item === "object" && (item.shortdef || item.def),
  );
  if (!entry)
    return NextResponse.json({ error: "Word not found." }, { status: 404 });
  const pronunciation = entry.hwi?.prs?.find(
    (item) => item.mw || item.sound?.audio,
  );
  const details = entries.reduce(
    (result, current) => collectDictionaryDetails(current.def, result),
    { examples: [] as string[], labels: [] as string[] },
  );
  const relatedWords = [
    ...new Set(entries.flatMap((current) => current.meta?.stems || [])),
  ].slice(0, 30);
  return NextResponse.json({
    term: entry.meta?.id?.split(":")[0] || term,
    normalized: term.toLowerCase(),
    phonetic: pronunciation?.mw,
    audio: audioUrl(pronunciation?.sound?.audio),
    partOfSpeech: entry.fl,
    definition: (entry.shortdef || [])
      .slice(0, 5)
      .map((definition, index) => `${index + 1}. ${definition}`)
      .join("\n"),
    definitionSource: "Merriam-Webster Collegiate",
    examples: [...new Set(details.examples)].slice(0, 4),
    usageLabels: [...new Set(details.labels)].slice(0, 5),
    etymology:
      entry.et
        ?.flat()
        .filter((part): part is string => typeof part === "string")
        .join(" ") || undefined,
    inflections: entry.uros
      ?.map((item) => item.ure)
      .filter((item): item is string => Boolean(item))
      .slice(0, 8),
    relatedWords,
  });
}
