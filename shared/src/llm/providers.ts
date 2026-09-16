import OpenAI from 'openai';

// All three providers expose an OpenAI-compatible chat completions API, so
// one client class serves all of them — just a different baseURL/apiKey per
// provider. This is the "one interface, many models" abstraction the
// multi-provider migration is built around.
export type ProviderId = 'nvidia' | 'groq' | 'openrouter';

interface ProviderConfig {
  baseURL: string;
  apiKeyEnv: 'NVIDIA_API_KEY' | 'GROQ_API_KEY' | 'OPENROUTER_API_KEY';
  defaultHeaders?: Record<string, string>;
}

export const PROVIDERS: Record<ProviderId, ProviderConfig> = {
  nvidia: {
    baseURL: 'https://integrate.api.nvidia.com/v1',
    apiKeyEnv: 'NVIDIA_API_KEY',
  },
  groq: {
    baseURL: 'https://api.groq.com/openai/v1',
    apiKeyEnv: 'GROQ_API_KEY',
  },
  openrouter: {
    baseURL: 'https://openrouter.ai/api/v1',
    apiKeyEnv: 'OPENROUTER_API_KEY',
    // Optional but recommended by OpenRouter for attribution/rate-limit tiering.
    defaultHeaders: {
      'HTTP-Referer': 'https://github.com/kushagra486/BharatAi-office',
      'X-Title': 'Bharat AI Office',
    },
  },
};

const clients = new Map<ProviderId, OpenAI>();

export function isProviderConfigured(provider: ProviderId): boolean {
  return Boolean(process.env[PROVIDERS[provider].apiKeyEnv]);
}

/** Lazily constructs and memoizes one OpenAI client per provider. */
export function getClient(provider: ProviderId): OpenAI {
  const existing = clients.get(provider);
  if (existing) return existing;

  const config = PROVIDERS[provider];
  const apiKey = process.env[config.apiKeyEnv];
  if (!apiKey) {
    throw new Error(
      `LLM provider "${provider}" is not configured — set ${config.apiKeyEnv} in the environment.`
    );
  }

  const client = new OpenAI({ apiKey, baseURL: config.baseURL, defaultHeaders: config.defaultHeaders });
  clients.set(provider, client);
  return client;
}
