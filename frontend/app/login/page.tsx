'use client';

import { useEffect, useState } from 'react';
import { getAuthStatus, login } from '@/lib/daemonApi';
import { setToken } from '@/lib/authToken';
import { Button } from '@/components/ui/Button';

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
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-2xl border border-line bg-surface p-7 shadow-elevated">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-saffron" />
          <span className="h-2 w-2 rounded-full bg-ink" />
          <span className="h-2 w-2 rounded-full bg-india-green" />
          <span className="ml-1 text-sm font-semibold tracking-tight text-ink">Bharat AI Office</span>
        </div>
        <p className="mt-1 text-sm text-ink-muted">Your AI team is waiting — sign in to open the floor.</p>
        <label htmlFor="login-password" className="sr-only">
          Password
        </label>
        <input
          id="login-password"
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="mt-5 w-full rounded-xl border border-line bg-void px-3.5 py-3 text-sm text-ink outline-none transition-colors focus:border-violet/60 focus:ring-2 focus:ring-violet/20"
        />
        {error && <p className="mt-2 text-xs text-magenta">{error}</p>}
        <Button type="submit" variant="primary" tone="violet" disabled={submitting || !password} className="mt-4 w-full">
          {submitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </main>
  );
}
