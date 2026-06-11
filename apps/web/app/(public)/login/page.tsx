import type { Metadata } from 'next';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'ログイン' };

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col items-center justify-center gap-8 px-6 py-16 text-center">
      <div>
        <p className="text-sm tracking-widest text-gold">ΚΗΡΥΞ</p>
        <h1 className="mt-1 text-3xl font-semibold text-indigo-deep">Keryx</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-muted">
          計画を見渡し、準備を進め、説教の歩みを振り返る。
        </p>
      </div>
      <LoginForm />
    </main>
  );
}
