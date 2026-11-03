import { NextResponse } from "next/server";
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() || "";
  if (query.length < 2 || !/^[a-z][a-z'-]*$/i.test(query))
    return NextResponse.json({ suggestions: [] });
  const url = new URL("https://api.datamuse.com/words");
  url.searchParams.set("sp", `${query}*`);
  url.searchParams.set("max", "8");
  const response = await fetch(url);
  if (!response.ok)
    return NextResponse.json(
      { error: "Suggestions API unavailable." },
      { status: 502 },
    );
  const data = await response.json();
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
