# ADR-0002: 新リポジトリ `/Users/james/syncthing/keryx` で次期版を開発する

- Status: Accepted（Jimi の明示指示による）
- Date: 2026-06-11
- Decision owner: Jimi

## Context

ADR-0001 は「同一リポジトリ内での段階移行」を提案し、新リポジトリ案（Alternative B）を「現時点では採用しない」としていた。しかし Jimi は 2026-06-11、`/Users/james/syncthing` 配下に新しい keryx プロジェクトディレクトリを作成して開発を進めるよう明示的に指示した。正本優先順位（00_HANDOFF_INDEX §正本と優先順位）により、Jimi の最新の明示的な指示が最優先される。

syncthing 配下は Jimi の複数マシン間で同期されるため、開発環境の可搬性という利点もある。

## Decision

- 次期版（Keryx Next）は新リポジトリ `/Users/james/syncthing/keryx` で開発する。
- pnpm workspaces + Turborepo のモノレポとし、`apps/web`（Next.js App Router）を本番ターゲットとする。
- 現行 Vite プロトタイプ `/Users/james/keryx` は**読み取り専用の参照実装**として保持し、`apps/legacy-web` への取り込みは行わない。重大バグ修正以外の変更は加えない。
- `docs/` は旧リポジトリからコピーし、以後は本リポジトリ側を正本として更新する。
- ADR-0001 の段階移行原則（小さな垂直スライス、一括リライト禁止、E2E 検証後の機能切替）は本リポジトリでも維持する。

## Consequences

### Positive

- target architecture をゼロから正しく構築できる（TypeScript strict、migration 正本、RLS テスト）。
- 旧プロトタイプを汚染せず、いつでも参照・比較できる。
- syncthing によりマシン間で開発環境が同期される。

### Negative

- 旧リポジトリの Git 履歴・deploy 設定とは分断される（ADR-0001 が指摘した欠点）。
- 旧 Supabase プロジェクト・Vercel deploy の環境変数は移行時に別途文書化が必要。

## Safety

- 旧リポジトリ・旧 Supabase プロジェクト・本番データには一切変更を加えていない。
- データ移行（Spreadsheet v1.3.1 / 旧 Supabase）は KX-019 以降で Dry Run 付きで実施する。
