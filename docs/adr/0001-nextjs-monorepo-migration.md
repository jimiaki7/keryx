# ADR-0001: Next.js TypeScript モノレポへ段階移行する

- Status: Proposed
- Date: 2026-06-11
- Decision owner: Jimi

## Context

現行 Keryx は Vite/React/JavaScript/Supabase のプロトタイプであり、基本的な価値仮説と UI 導線を確認できる。一方、次期版では次が必要になる。

- Message / Gathering / Service Element の正規化モデル
- repository-managed Supabase migrations と RLS tests
- server-side AI、import、課金、複数テーブル transaction
- TypeScript strict と共有 domain packages
- 将来の Expo Router iOS client

現行 app をその場で全面変換すると、既存挙動を参照できなくなり、長期間動作しない中間状態になる危険がある。別 repository に完全分離すると、知見・issue・deploy・履歴が分断される。

## Decision

同じ repository を `pnpm` workspaces + Turborepo の target monorepo へ移行する。

- 現行 Vite app は一時的に `apps/legacy-web` として保持する。
- 新しい production target を `apps/web` の Next.js App Router app とする。
- 共有 domain、Scripture parser、validation、UI token を `packages/*` に置く。
- Supabase migration、seed、test、functions を `supabase/*` に置く。
- 機能ごとに小さな垂直スライスを完成させ、E2E 比較後に legacy の該当機能を終了する。
- legacy app は移行期間中、重大バグ修正以外の新機能開発を原則停止する。

## Alternatives

### A. 現行 Vite app をその場で Next.js/TypeScript 化する

**利点**

- ファイル移動が少なく見える。
- 既存 UI を直接変更できる。

**欠点**

- migration 中に動作可能な基準点を失う。
- routing、server boundary、domain model、TypeScript を同時に変更しやすい。
- 大量差分になり、agent による一括書き直しの危険が高い。

**判断:** 採用しない。

### B. 新しい repository を作る

**利点**

- target architecture を完全に独立して設計できる。

**欠点**

- 履歴、issue、deploy、環境設定、知識が分断される。
- 現行実装との比較がしにくい。

**判断:** 現時点では採用しない。

### C. Vite/Supabase のまま強化する

**利点**

- 短期の変更量が少ない。

**欠点**

- server-side AI/import/billing、共有 mobile domain、認証済み server rendering の境界が複雑になる。
- 長期目標に対して追加の独自基盤が必要になる。

**判断:** target architecture として採用しない。

## Consequences

### Positive

- 現行 prototype を動く参照として保持できる。
- target architecture を垂直スライスごとに検証できる。
- Web と将来 mobile の domain 資産を共有できる。
- migration、RLS、server boundary を最初から正本化できる。

### Negative

- 移行期間中は legacy と target の二つの app が存在する。
- deploy、環境変数、package scripts の整理が必要。
- 同じ機能を一時的に二重保守する可能性がある。

## Safety And Rollback

- 移行開始前に現行 deploy、環境変数名、Supabase project、Stripe/Edge Function 接続を文書化する。
- 現行 app の移動は Git 履歴を保持する方法で行う。
- target app の route は、データ移行と E2E が通るまで既定 production へ切り替えない。
- target app に問題がある場合、legacy deploy を継続する。
- DB migration は backward compatibility と rollback 方針を個別 ADR に記録する。

## Acceptance Required

この ADR は、monorepo へのファイル移動と package manager 変更を始める前に Jimi の承認を得る。
