'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Coffee, Loader2, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api, ApiError } from '@/lib/api-client';

const DEMO_ACCOUNTS = [
  { email: 'admin@beanespress.com', role: 'Admin' },
  { email: 'manager@beanespress.com', role: 'Manager' },
  { email: 'stockman@beanespress.com', role: 'Stock Manager' },
  { email: 'cashier@beanespress.com', role: 'Cashier' },
];

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@beanespress.com');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('/api/auth/login', { method: 'POST', body: { email, password } });
      router.replace('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-2xl border border-border bg-card shadow-warm md:grid-cols-[1.1fr_1fr]">
        {/* Brand panel */}
        <div className="relative hidden flex-col justify-between bg-sidebar p-10 text-sidebar-foreground md:flex">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
              <Coffee className="h-6 w-6" />
            </span>
            <span className="font-headline text-2xl font-semibold">ProStock</span>
          </div>
          <div>
            <h1 className="font-headline text-3xl font-semibold leading-snug">
              Your café&apos;s whole operation,
              <span className="text-sidebar-primary"> in one register.</span>
            </h1>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-sidebar-foreground/60">
              Point of sale, live inventory, kitchen tickets and waste tracking — built for
              specialty coffee teams.
            </p>
          </div>
          <p className="text-xs text-sidebar-foreground/40">Bean Espresso · ProStock Suite</p>
        </div>

        {/* Form panel */}
        <div className="p-8 md:p-10">
          <div className="mb-8 flex items-center gap-3 md:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Coffee className="h-5 w-5" />
            </span>
            <span className="font-headline text-xl font-semibold">ProStock</span>
          </div>
          <h2 className="font-headline text-2xl font-semibold tracking-tight">Welcome back</h2>
          <p className="mt-1 text-sm text-muted-foreground">Sign in to open the register.</p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@beanespress.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
            )}

            <Button type="submit" className="btn-press w-full" disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
              Sign in
            </Button>
          </form>

          <div className="mt-8 rounded-xl border border-border bg-muted/40 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Demo accounts · password123
            </p>
            <div className="mt-2.5 grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => {
                    setEmail(acc.email);
                    setPassword('password123');
                  }}
                  className="rounded-lg border border-border bg-card px-2.5 py-2 text-left text-xs transition-colors hover:border-primary/40 hover:bg-primary/5"
                >
                  <span className="block font-semibold text-primary">{acc.role}</span>
                  <span className="block truncate text-muted-foreground">{acc.email}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
