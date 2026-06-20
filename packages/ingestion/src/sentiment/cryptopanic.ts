export interface CryptoPanicPost {
  title: string;
  published_at: string;
  votes?: { positive?: number; negative?: number };
  currencies?: Array<{ code: string }>;
}

interface CryptoPanicResponse {
  results?: CryptoPanicPost[];
}

export async function fetchCryptoPanicPosts(
  apiKey: string,
  filter: "rising" | "hot" | "bullish" | "bearish" | "important" = "hot",
): Promise<CryptoPanicPost[]> {
  const url = new URL("https://cryptopanic.com/api/v1/posts/");
  url.searchParams.set("auth_token", apiKey);
  url.searchParams.set("filter", filter);
  url.searchParams.set("public", "true");

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`CryptoPanic API error: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as CryptoPanicResponse;
  return data.results ?? [];
}

export function postToScore(post: CryptoPanicPost): { score: number; confidence: number } {
  const pos = post.votes?.positive ?? 0;
  const neg = post.votes?.negative ?? 0;
  const total = pos + neg;

  if (total > 0) {
    const score = (pos - neg) / (total + 1);
    return { score: clamp(score, -1, 1), confidence: Math.min(1, 0.4 + total / 20) };
  }

  return { score: 0, confidence: 0.25 };
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
