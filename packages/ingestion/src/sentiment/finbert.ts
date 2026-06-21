import { env } from "@phronesis/shared";

export interface FinbertScore {
  score: number;
  confidence: number;
  label: string;
}

type SentimentPipeline = (
  text: string,
  options?: { topk?: number },
) => Promise<Array<{ label: string; score: number }>>;

let pipeline: SentimentPipeline | null = null;
let initFailed = false;

export async function scoreWithFinbert(text: string): Promise<FinbertScore | null> {
  if (!env.finbertEnabled || initFailed) return null;

  try {
    if (!pipeline) {
      const { pipeline: createPipeline, env: hfEnv } = await import("@xenova/transformers");
      hfEnv.cacheDir = ".cache/transformers";
      hfEnv.allowLocalModels = true;
      console.log(`[finbert] loading model ${env.finbertModel}...`);
      pipeline = (await createPipeline("sentiment-analysis", env.finbertModel)) as SentimentPipeline;
      console.log("[finbert] model ready");
    }

    const results = await pipeline(text.slice(0, 512), { topk: 1 });
    const top = results[0];
    if (!top) return null;

    const label = top.label.toUpperCase();
    const raw = top.score;
    let score = 0;
    if (label.includes("POS") || label.includes("BULL")) score = raw;
    else if (label.includes("NEG") || label.includes("BEAR")) score = -raw;
    else score = (raw - 0.5) * 2;

    return { score, confidence: raw, label: top.label };
  } catch (err) {
    initFailed = true;
    console.warn(
      "[finbert] unavailable, falling back to lexicon:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

export function isFinbertReady(): boolean {
  return pipeline !== null && !initFailed;
}
