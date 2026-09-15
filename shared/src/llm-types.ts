// Mirrors the per-agent usage record daemon/src/llm/router.ts keeps in
// memory and serves at GET /api/llm/usage — the "token control" surface.
export interface LlmUsageStats {
  provider: string;
  model: string;
  calls: number;
  approxTokens: number;
  lastCallAt: string | null;
}

export type LlmUsageByAgent = Record<string, LlmUsageStats>;
