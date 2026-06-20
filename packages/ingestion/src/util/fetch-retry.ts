const DEFAULT_RETRIES = 3;
const RETRY_DELAY_MS = 1500;

export async function fetchWithRetry(
  url: string | URL,
  init?: RequestInit,
  retries = DEFAULT_RETRIES,
): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const res = await fetch(url, init);
      return res;
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await sleep(RETRY_DELAY_MS * attempt);
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
