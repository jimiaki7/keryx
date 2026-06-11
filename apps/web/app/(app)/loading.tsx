export default function Loading() {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">読み込み中</span>
      <div aria-hidden className="animate-pulse">
        <div className="h-8 w-40 rounded-md bg-line" />
        <div className="mt-2 h-4 w-72 rounded-md bg-line" />
        <div className="mt-8 h-40 rounded-lg bg-line/60" />
      </div>
    </div>
  );
}
