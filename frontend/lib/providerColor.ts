// Distinct color per LLM provider so the 3D office floor can show, at a
// glance across the whole room, which provider each agent's current model
// call is routed through — without cluttering the scene with per-agent
// text (full provider/model/tokens detail is one click away in the side
// panel). Provider ids match shared/src/llm/providers.ts's ProviderId
// (kept as plain strings here since that type lives in the server-only
// barrel, and this is client-safe UI).
const PROVIDER_COLOR: Record<string, string> = {
  groq: '#F97316', // orange
  nvidia: '#22C55E', // green (NVIDIA brand green)
  openrouter: '#A855F7', // purple
};

const UNKNOWN_COLOR = '#4B5563'; // neutral gray — no usage recorded yet

export function providerColorHex(provider: string | undefined): string {
  if (!provider) return UNKNOWN_COLOR;
  return PROVIDER_COLOR[provider] ?? UNKNOWN_COLOR;
}
