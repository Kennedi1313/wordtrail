export function parsePracticeCount(value: string | null) {
  if (value === null) return 20;
  const requested = Number(value);
  return Number.isFinite(requested)
    ? Math.min(20, Math.max(1, Math.floor(requested)))
    : 20;
}

export function isDictionaryTerm(value: string) {
  return value.length <= 64 && /^[a-z][a-z'-]*$/i.test(value);
}
