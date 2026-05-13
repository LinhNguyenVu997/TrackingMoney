'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? '/';
  const configured = isSupabaseConfigured();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);

  async function signInOAuth(provider: 'google' | 'github') {
    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    await supabase.auth.signInWithOAuth({ provider, options: { redirectTo } });
  }

  async function signInEmail(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setPending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    router.push(next);
    router.refresh();
  }

  async function signUpEmail() {
    if (!email || !password) {
      toast.error('Email and password required');
      return;
    }
    if (!email.toLowerCase().endsWith('@gmail.com')) {
      toast.error('Email must end with @gmail.com');
      return;
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setPending(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({ email, password });
    setPending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Account created. Sign in below.');
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <Card className="p-8 w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold">Sign in</h1>
        <p className="text-sm text-muted-foreground">Save your favorite tokens to a watchlist.</p>
        {!configured ? (
          <p className="text-sm text-red-500">
            Supabase not configured. Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
            <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in <code>.env.local</code>.
          </p>
        ) : (
          <>
            <form onSubmit={signInEmail} className="space-y-2">
              <Input
                type="email"
                placeholder="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Input
                type="password"
                placeholder="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? 'Signing in...' : 'Sign in with email'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={signUpEmail}
                disabled={pending}
              >
                Create account
              </Button>
            </form>
            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">or</span>
              </div>
            </div>
            <div className="space-y-2">
              <Button className="w-full" variant="outline" onClick={() => signInOAuth('google')}>
                Continue with Google
              </Button>
              <Button className="w-full" variant="outline" onClick={() => signInOAuth('github')}>
                Continue with GitHub
              </Button>
            </div>
          </>
        )}
      </Card>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
