import { NextResponse } from "next/server";
import { fetchWithTimeout } from "@/lib/api/fetch-with-timeout";
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim().slice(0, 32) || "";
  if (query.length < 2 || !/^[a-z][a-z'-]*$/i.test(query))
    return NextResponse.json({ suggestions: [] });
  const url = new URL("https://api.datamuse.com/words");
  url.searchParams.set("sp", `${query}*`);
  url.searchParams.set("max", "8");
  const response = await fetchWithTimeout(url).catch(() => null);
  if (!response)
    return NextResponse.json({ error: "Suggestions request timed out." }, { status: 504 });
  if (!response.ok)
    return NextResponse.json(
      { error: "Suggestions API unavailable." },
      { status: 502 },
    );
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    return NextResponse.json({ error: "Suggestions API returned an invalid response." }, { status: 502 });
  }
  const suggestions = Array.isArray(data)
    ? data
        .map((item: { word?: string }) => item.word)
        .filter((word): word is string =>
          Boolean(word && /^[a-z][a-z'-]*$/i.test(word)),
        )
        .slice(0, 8)
    : [];
  return NextResponse.json({ suggestions });
}
