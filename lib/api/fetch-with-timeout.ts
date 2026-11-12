const DEFAULT_TIMEOUT_MS = 5_000;

export function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
) {
  return fetch(input, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
  });
}
