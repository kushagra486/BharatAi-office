'use client';

import { useEffect, useState } from 'react';
import { getAuthStatus, login } from '@/lib/daemonApi';
import { setToken } from '@/lib/authToken';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);

  // No point showing a login screen if the daemon has no password
  // configured — just go straight in.
  useEffect(() => {
    getAuthStatus()
      .then((status) => {
        if (!status.authRequired) window.location.href = '/';
        else setCheckingStatus(false);
      })
      .catch(() => setCheckingStatus(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const token = await login(password);
      setToken(token);
      window.location.href = '/';
    } catch {
      setError('Incorrect password.');
      setSubmitting(false);
    }
  }

  if (checkingStatus) return null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-void px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-2xl border border-line bg-panel p-6">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-saffron" />
          <span className="h-2 w-2 rounded-full bg-[#E6EDF3]" />
          <span className="h-2 w-2 rounded-full bg-india-green" />
          <span className="ml-1 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[#E6EDF3]">
            Bharat AI Office
          </span>
        </div>
        <p className="mt-4 font-mono text-[10px] uppercase tracking-wide text-[#6B7686]">Password required</p>
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="mt-2 w-full rounded-lg border border-line bg-void px-3 py-2 font-mono text-sm text-[#E6EDF3] outline-none focus:border-cyan"
        />
        {error && <p className="mt-2 text-xs text-magenta">{error}</p>}
        <button
          type="submit"
          disabled={submitting || !password}
          className="mt-4 w-full rounded-lg border border-cyan px-3 py-2 font-mono text-xs uppercase tracking-wide text-cyan transition-all duration-200 hover:shadow-[0_0_10px_-2px_#2FE6D2] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}
