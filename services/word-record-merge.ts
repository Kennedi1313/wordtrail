import { Word } from "@/types/domain";

export type WordCloudRecord = { record_id: string; data: Word };

export function mergeWordRecords(rows: WordCloudRecord[]): Word[] {
  const grouped = new Map<string, WordCloudRecord[]>();
  for (const row of rows) {
    const key = (row.data.normalized || row.data.term).trim().toLowerCase();
    grouped.set(key, [...(grouped.get(key) || []), row]);
  }

  return [...grouped.entries()].map(([key, duplicates]) => {
    const canonical = duplicates.find((row) => row.record_id === key)?.data;
    if (canonical?.lookupAggregateVersion === 1) return canonical;

    const words = duplicates.map(({ data }) => data);
    const richest = [...words].sort(
      (a, b) => (b.definition?.length || 0) - (a.definition?.length || 0),
    )[0];
    return words.reduce(
      (merged, word) => ({
        ...merged,
        ...word,
        definition: word.definition || merged.definition,
        lookups: (merged.lookups || 0) + (word.lookups || 0),
        lookupAggregateVersion: 1,
        firstSearchedAt:
          !merged.firstSearchedAt ||
          (word.firstSearchedAt && word.firstSearchedAt < merged.firstSearchedAt)
            ? word.firstSearchedAt
            : merged.firstSearchedAt,
        lastSearchedAt:
          (word.lastSearchedAt || "") > (merged.lastSearchedAt || "")
            ? word.lastSearchedAt
            : merged.lastSearchedAt,
      }),
      { ...richest, lookups: 0, lookupAggregateVersion: 1 as const },
    );
  });
}
