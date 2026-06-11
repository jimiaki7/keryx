# Keryx

日本語ファーストの説教計画・礼拝準備・振り返りワークスペース。

正本仕様は [docs/product/00_HANDOFF_INDEX.md](docs/product/00_HANDOFF_INDEX.md) から参照。

## 構成

```
apps/web              Next.js App Router（本番ターゲット）
packages/scripture    書巻マスタ・Passage parser（共有ドメイン資産）
supabase/             migrations / RLS tests / config
docs/                 product spec / ADR / AI prompts
```

## 開発

```bash
pnpm install
pnpm dev          # apps/web 開発サーバー
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Supabase（ローカル）

Docker と Supabase CLI が必要。

```bash
supabase start    # ローカルスタック起動（migration 適用）
supabase test db  # pgTAP による RLS テスト（pnpm db:test）
pnpm db:types     # generated TypeScript types を更新（packages/database/src/types.gen.ts）
cp .env.example apps/web/.env.local  # 値を supabase start の出力で置換
```

Docker ランタイムは Colima を使用（`colima start --cpu 2 --memory 4 --disk 30`）。
`pnpm db:types` は CLI v2.40.7 を pin している（v2.106 以降の `gen types --local` は
`supabase login` を要求するため。ログイン済みなら brew 版 CLI でも生成可能）。

## 関連

- 旧プロトタイプ（参照実装・読み取り専用）: `/Users/james/keryx`
- ADR: [docs/adr/](docs/adr/)
