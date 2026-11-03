import { NextResponse } from "next/server";

function cleanTranslations(values: unknown[], source: string) {
  return {
    source,
    translations: [
      ...new Set(
        values.filter(
          (item): item is string =>
            typeof item === "string" && item.trim().length > 0,
        ),
      ),
    ],
  };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text || text.length > 500)
    return NextResponse.json(
      { error: "Text of up to 500 characters is required." },
      { status: 400 },
    );
  try {
    const url = new URL("https://api.mymemory.translated.net/get");
    url.searchParams.set("q", text);
    url.searchParams.set("langpair", "en|pt");
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (response.ok) {
      const data = await response.json();
      const result = cleanTranslations(
        [
          data.responseData?.translatedText,
          ...(Array.isArray(data.matches)
            ? data.matches.map(
                (item: { translation?: string }) => item.translation,
              )
            : []),
        ],
        "mymemory",
      );
      if (result.translations.length)
        return NextResponse.json({
          translatedText: result.translations[0],
          ...result,
        });
    }
  } catch {
    // Continue with the fallback provider.
  }

  try {
    const url = new URL("https://translate.googleapis.com/translate_a/single");
    url.searchParams.set("client", "gtx");
    url.searchParams.set("sl", "en");
    url.searchParams.set("tl", "pt");
    url.searchParams.set("dt", "t");
    url.searchParams.set("q", text);
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (response.ok) {
      const data = await response.json();
      const result = cleanTranslations(
        Array.isArray(data)
          ? data[0]?.map((item: unknown[]) => item?.[0]) || []
          : [],
        "google",
      );
      if (result.translations.length)
        return NextResponse.json({
          translatedText: result.translations.join(" "),
          ...result,
        });
    }
  } catch {
    // Return a useful error below when both providers are unavailable.
  }

  return NextResponse.json(
    { error: "Os serviços de tradução estão indisponíveis no momento." },
    { status: 502 },
  );
}
