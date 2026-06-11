# 現行 Keryx プロトタイプ Gap Analysis

調査日: 2026-06-11  
対象: `/Users/james/keryx`

## 1. 要約

現行版は、Keryx の価値仮説を短期間で確認するための有用な React/Supabase プロトタイプである。認証、説教 CRUD、シリーズ、カレンダー、Inbox、課金、AI アウトライン生成などの主要アイデアがコードとして存在する。

一方、本番プロダクトの土台として機能を積み増すには、データモデル、セキュリティ、型、テスト、画面接続に大きな不足がある。現行 UI と利用知見を参照資産として保持しつつ、Next.js/TypeScript モノレポへ段階移行することを推奨する。

## 2. 現行スタック

- Vite 7
- React 19
- JavaScript / JSX
- Tailwind CSS 4
- Supabase JS
- Supabase Auth / tables / Edge Functions を前提とした実装
- Stripe checkout / subscription を前提とした実装
- Anthropic API のクライアント直接呼び出し

## 3. 動作確認結果

### 成功

- `npm run build`: 成功
- 主要画面とサービスのソースコードを確認可能
- git 上の既存ユーザー変更は `.gitignore` の `.vercel` 追加のみ

### 未達

- `npm run lint`: 34 errors、1 warning
- test script: 存在しない
- typecheck script: 存在しない
- Supabase migration / RLS tests: リポジトリ内に存在しない
- README: Vite の初期テンプレートのまま

lint の主な内容は、未使用コード、未接続 UI、Hook の問題、Fast Refresh 境界である。仕様書追加によるエラーではない。

## 4. 資産評価

### 再利用する

| 資産                                        | 理由                                   |
| ------------------------------------------- | -------------------------------------- |
| ホーム、Inbox、カレンダー、アーカイブの導線 | 週次ワークフローの仮説が表現されている |
| mobile bottom nav / desktop sidebar         | responsive 方針の出発点になる          |
| 色・余白・カードの design tokens            | Keryx の落ち着いた人格に適合する       |
| Supabase Auth / Google OAuth の知見         | target stack と方向が一致する          |
| 課金フローの知見                            | 将来の Personal plan で参照可能        |
| Markdown export の方向性                    | データ可搬性の原則に合う               |
| シリーズ・教会暦プリセットの試作            | 用語・利用フロー検証に使える           |

### 移行して作り直す

| 領域          | 現状                                     | 移行先                                           |
| ------------- | ---------------------------------------- | ------------------------------------------------ |
| Sermon model  | date、church、固定 liturgy fields を混在 | Message / Gathering / Delivery / Service Element |
| Scripture     | free-text `scripture`                    | structured Passage + parser                      |
| Language      | JavaScript                               | TypeScript strict                                |
| Database      | 外部状態で migration 不在                | repository-managed migrations                    |
| Authorization | RLS 前提だが policy/test 不在            | explicit RLS + deny tests                        |
| UI state      | 一部 component が未接続・仮データ        | route 単位の完成した vertical slices             |
| Settings      | localStorage と user metadata が混在     | server-managed workspace/user settings           |
| Analytics     | 未実装                                   | SQL read models                                  |

### 廃止する

| 項目                                             | 理由                               |
| ------------------------------------------------ | ---------------------------------- |
| ブラウザから Anthropic API を直接呼ぶ実装        | key 漏えい、監査不能、費用制御不能 |
| `anthropic-dangerous-direct-browser-access`      | 本番セキュリティ要件に反する       |
| AI key を user metadata / browser へ保存する方式 | secret storage として不適切        |
| component 内の固定サンプル説教・会場・人物       | 実データと誤認しやすい             |
| Message に固定の招詞・応答賛美列を増やす方式     | 複数要素・式典順序を表現できない   |

## 5. 主要ギャップ

### Critical: セキュリティ

1. `src/services/ai.js` が Anthropic API をブラウザから直接呼び、dangerous browser access header を使用している。
2. API key の保存方針が localStorage と Supabase user metadata の間で一貫せず、secret 管理として不十分。
3. RLS を前提としているが、migration、policy、deny test がリポジトリにないため、安全性を再現・検証できない。
4. user ID 引数を受け取る service が多い一方、query で使わず RLS に全面依存している。RLS 不備時の影響が大きい。

### High: ドメインモデル

1. `sermons` が内容と実施機会を混在させている。
2. `call_to_worship` と `response_hymn` は一つずつしか持てず、式典・複数賛美・順序を表現できない。
3. 聖書箇所は free text で、正確な分析・重複検知・入力検証ができない。
4. 祈祷会奨励、礼拝、教会暦、シリーズの関係が正規化されていない。

### High: 品質と保守

1. TypeScript、validation schema、database generated types がない。
2. 自動テストと CI 品質ゲートがない。
3. lint が失敗しており、未使用・未接続コードが多数ある。
4. calendar component が複数存在し、どれが正本か分かりにくい。
5. Series UI など、実装済みでも main navigation に接続されていない領域がある。

### Medium: UX

1. 日本語と英語の文言・placeholder・サンプルが混在する。
2. 一覧・フィルターに固定の仮データがある。
3. ダッシュボードは次の説教表示が中心で、準備進捗・年間分析が未実装。
4. 聖書箇所入力支援がない。
5. Calendar からの作成・選択 callback に不整合がある可能性がある。

## 6. 推奨移行方針

同じリポジトリ内に target monorepo を構築し、現行 Vite app は一時的に `apps/legacy-web` として保持する。新しい `apps/web` で垂直スライスを完成させ、機能ごとに利用を切り替える。

### 理由

- 現行コードを参照・比較できる。
- 一括変換による機能消失を防げる。
- target architecture を妥協せず構築できる。
- Git 履歴と deploy 構成を一つの場所で管理できる。

### 注意

- 移動前に現行 deploy と環境変数を記録する。
- legacy app の挙動変更は原則バグ修正だけに限定する。
- target app で同等以上のフローが E2E 検証された後に legacy route/deploy を終了する。

## 7. 最初の技術作業

1. 現行状態を tag または release note で固定する。
2. `docs/adr/0001-nextjs-monorepo-migration.md` を承認する。
3. KX-001 と KX-002 を実装する。
4. KX-003 の RLS deny tests を最初の品質ゲートにする。
5. KX-005/KX-006 の Scripture package を作り、最初の共有 domain 資産にする。
6. KX-008 Message Inbox vertical slice を完成させる。
