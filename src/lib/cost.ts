// Anthropic pricing per million tokens (USD). Update if Anthropic changes rates.
// Cache reads are 10% of base input rate; cache creation is 1.25x base input rate.
// Source: https://docs.anthropic.com/en/docs/about-claude/pricing
const PRICING_PER_MTOK: Record<
  string,
  { input: number; output: number; cacheRead: number; cacheCreation: number }
> = {
  'claude-opus-4-7': { input: 15, output: 75, cacheRead: 1.5, cacheCreation: 18.75 },
  'claude-opus-4-6': { input: 15, output: 75, cacheRead: 1.5, cacheCreation: 18.75 },
  'claude-sonnet-4-6': { input: 3, output: 15, cacheRead: 0.3, cacheCreation: 3.75 },
  'claude-sonnet-4-5': { input: 3, output: 15, cacheRead: 0.3, cacheCreation: 3.75 },
  'claude-haiku-4-5': { input: 1, output: 5, cacheRead: 0.1, cacheCreation: 1.25 },
};

const FALLBACK = PRICING_PER_MTOK['claude-sonnet-4-6'];

export interface AnthropicUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}

export function computeCost(model: string, usage: AnthropicUsage): number {
  // Strip date suffix if present (e.g. claude-haiku-4-5-20251001 -> claude-haiku-4-5)
  const key = model.replace(/-\d{8}$/, '');
  const p = PRICING_PER_MTOK[key] ?? FALLBACK;
  const cost =
    (usage.input_tokens * p.input +
      usage.output_tokens * p.output +
      (usage.cache_read_input_tokens ?? 0) * p.cacheRead +
      (usage.cache_creation_input_tokens ?? 0) * p.cacheCreation) /
    1_000_000;
  return Math.round(cost * 1_000_000) / 1_000_000;
}
