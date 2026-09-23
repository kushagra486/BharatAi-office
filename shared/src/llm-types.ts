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

// One row per (agent, provider, model) combination that's ever been
// called, from the llm_usage_by_model table — unlike LlmUsageByAgent
// (one row per agent, overwritten whenever that agent's model changes),
// this keeps every model's own running total intact even as agents move
// between models under dynamic routing.
export interface ModelUsageStats {
  agentId: string;
  provider: string;
  model: string;
  calls: number;
  approxTokens: number;
  lastCallAt: string;
}
