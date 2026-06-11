'use client';

export default function AppError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-line bg-paper-raised px-6 py-14 text-center"
    >
      <h2 className="font-medium text-ink">問題が発生しました</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-muted">
        ページの表示中にエラーが発生しました。再試行しても解決しない場合は、時間をおいてもう一度お試しください。データは失われていません。
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-5 rounded-md bg-indigo-deep px-4 py-2 text-sm font-medium text-paper-raised hover:bg-indigo-soft"
      >
        再試行
      </button>
    </div>
  );
}
