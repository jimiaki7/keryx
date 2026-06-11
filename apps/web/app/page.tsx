export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <p className="text-sm tracking-widest text-gold">ΚΗΡΥΞ</p>
      <h1 className="text-4xl font-semibold text-indigo-deep">Keryx</h1>
      <p className="text-base leading-relaxed text-ink-muted">
        計画を見渡し、準備を進め、説教の歩みを振り返る。
        <br />
        日本語ファーストの説教管理ワークスペース。
      </p>
      <p className="rounded-md border border-line bg-paper-raised px-4 py-2 text-sm text-ink-muted">
        Phase 0 開発基盤を構築中です（KX-001）
      </p>
    </main>
  );
}
