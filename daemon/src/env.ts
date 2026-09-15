import 'dotenv/config';
import path from 'node:path';

function resolveFromRepoRoot(p: string): string {
  return path.isAbsolute(p) ? p : path.join(__dirname, '..', '..', p);
}

export const env = {
  GROQ_API_KEY: process.env.GROQ_API_KEY ?? '',
  NVIDIA_API_KEY: process.env.NVIDIA_API_KEY ?? '',
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY ?? '',
  DAEMON_PORT: Number(process.env.DAEMON_PORT ?? 4317),
  HIVE_DB_PATH: resolveFromRepoRoot(process.env.HIVE_DB_PATH ?? './daemon/data/hive.db'),
  PROJECT_WORKDIR: resolveFromRepoRoot(process.env.PROJECT_WORKDIR ?? './workdir'),
};
