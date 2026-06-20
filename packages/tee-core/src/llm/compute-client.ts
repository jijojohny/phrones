import { env } from "@phronesis/shared";
import { buildSystemPrompt, buildUserPrompt } from "./prompt.js";
import { parseLlmOpportunities } from "./parser.js";
import type { MarketEntry, StrategyConfig } from "@phronesis/shared";

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

export async function rankWithComputeLlm(
  markets: MarketEntry[],
  strategy: StrategyConfig,
): Promise<{ opportunities: ReturnType<typeof parseLlmOpportunities>; raw: string }> {
  const apiKey = env.ogComputeApiKey;
  if (!apiKey) {
    throw new Error("OG_COMPUTE_API_KEY not set — run: 0g-compute-cli inference get-secret --provider <ADDR> --duration 0");
  }

  const res = await fetch(env.ogComputeProxyUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: env.ogComputeModel,
      temperature: 0.1,
      messages: [
        { role: "system", content: buildSystemPrompt(strategy) },
        { role: "user", content: buildUserPrompt(markets) },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`0G Compute LLM error: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as ChatCompletionResponse;
  const raw = data.choices?.[0]?.message?.content ?? "";
  if (!raw) throw new Error("Empty LLM response");

  return { opportunities: parseLlmOpportunities(raw), raw };
}
