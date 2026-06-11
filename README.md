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
supabase test db  # pgTAP による RLS テスト
cp .env.example apps/web/.env.local  # 値を supabase start の出力で置換
```

## 関連

- 旧プロトタイプ（参照実装・読み取り専用）: `/Users/james/keryx`
- ADR: [docs/adr/](docs/adr/)
