import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-xl font-semibold text-indigo-deep">ページが見つかりません</h1>
      <p className="text-sm leading-relaxed text-ink-muted">
        お探しのページは移動したか、存在しません。
      </p>
      <Link
        href="/"
        className="rounded-md bg-indigo-deep px-4 py-2 text-sm font-medium text-paper-raised hover:bg-indigo-soft"
      >
        ホームへ戻る
      </Link>
    </main>
  );
}
