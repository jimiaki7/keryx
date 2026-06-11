# Keryx Next 実装バックログ

更新日: 2026-06-11

## 1. バックログ運用

- `P0`: Web MVP に必須。
- `P1`: Beta に必須。
- `P2`: 検証後に実装。
- 各ストーリーは、小さな垂直スライスに分解して実装する。
- UI だけ、DB だけを長期間先行させず、保存・認可・表示・テストまで通す。

## 2. Epic 一覧

| Epic                     | 優先度 | 成果                         |
| ------------------------ | ------ | ---------------------------- |
| E01 Foundation           | P0     | 再現可能な開発基盤           |
| E02 Identity & Workspace | P0     | 安全な個人 Workspace         |
| E03 Scripture            | P0     | 日本語に強い構造化 Passage   |
| E04 Messages             | P0     | 説教・奨励の管理             |
| E05 Gatherings & Liturgy | P0     | 柔軟な礼拝計画               |
| E06 Preparation          | P0     | 準備進捗の可視化             |
| E07 Dashboard & Calendar | P0     | 次の予定と年間概観           |
| E08 Import & Export      | P0/P1  | Spreadsheet からの安全な移行 |
| E09 Search & Analytics   | P1     | 説教の振り返り               |
| E10 Collaboration        | P2     | 教会チーム共有               |
| E11 Billing              | P2     | 持続可能な課金               |
| E12 AI Assistance        | P2     | 承認型のAI支援               |
| E13 Mobile               | P3     | iOS クライアント             |

## 3. 最初に作成する Issue

### KX-001 Repository foundation

**優先度:** P0  
**目的:** Next.js/Supabase モノレポを再現可能に起動できる。

**受け入れ条件**

- `pnpm install` 後に web、lint、test、build が実行できる。
- TypeScript strict が有効。
- `.env.example` に必要項目と説明があり、秘密値は commit されない。
- CI が lint、typecheck、test、build を実行する。
- 現行 Vite prototype の扱いが ADR に記録される。

### KX-002 Supabase local and migration baseline

**優先度:** P0

**受け入れ条件**

- local Supabase を一つのコマンドで開始できる。
- migration から DB を再構築できる。
- generated TypeScript types を更新できる。
- seed data に秘密情報を含めない。

### KX-003 Workspace and membership RLS

**優先度:** P0

**受け入れ条件**

- 初回ログインで個人 Workspace を作成できる。
- Workspace A/B の相互アクセスが拒否される。
- membership の追加・削除で権限が反映される。
- RLS の許可・拒否テストが CI で通る。

### KX-004 App shell and navigation

**優先度:** P0

**受け入れ条件**

- ホーム、カレンダー、Messages、シリーズ、Inbox、設定へ移動できる。
- desktop と mobile で適切な navigation を表示する。
- loading、error、empty の共通 UI がある。
- キーボードフォーカスが見える。

### KX-005 Japanese Bible book master

**優先度:** P0

**受け入れ条件**

- 全66巻の canonical order、testament、genre、日本語名、略称、英語名を持つ。
- 新約ジャンルに `公同書簡` を使用する。
- alias はデータとして追加できる。
- fixture validation が通る。

### KX-006 Passage parser v1

**優先度:** P0

**受け入れ条件**

- 合意済み日本語・英語入力例を解析できる。
- 無効な章節、逆転範囲、曖昧な書名を説明付きで拒否する。
- DB/UI に依存しない純粋関数である。
- unit test が境界値を含む。

### KX-007 Message schema and policies

**優先度:** P0

**受け入れ条件**

- Message type/status/display ID/soft delete を保存できる。
- Message に date、venue、speaker、固定 hymn 列を持たせない。
- Workspace RLS が適用される。
- audit event を記録する。

### KX-008 Create Message to Inbox

**優先度:** P0

**受け入れ条件**

- タイトルまたは Passage だけで Message を保存できる。
- Message type を選べる。
- 日付未定なら Inbox に表示される。
- 日本語 IME の変換確定で誤送信しない。
- 作成フローの E2E が通る。

### KX-009 Message detail and structured Passages

**優先度:** P0

**受け入れ条件**

- primary/supporting Passage を複数追加、編集、削除、並べ替えできる。
- title、central message、summary、outline、notes を編集できる。
- 保存状態とエラーが明確。
- 競合更新を黙って上書きしない。

### KX-010 Series minimal CRUD

**優先度:** P0

**受け入れ条件**

- シリーズを作成・編集・アーカイブできる。
- Message をシリーズへ追加し、順序を変更できる。
- シリーズを削除しても Message は削除されない。

### KX-011 Gathering and Venue schema

**優先度:** P0

**受け入れ条件**

- Gathering に日時、timezone、kind、venue、status を保存できる。
- Venue は Workspace 内で再利用できる。
- Gathering と Message を Delivery で関連付ける。
- 同じ Message を複数 Gathering に関連付けられる。

### KX-012 Gathering planner

**優先度:** P0

**受け入れ条件**

- 日時、Venue、説教者、関連 Message を一画面で編集できる。
- Message 未定の Gathering も保存できる。
- Message 詳細から「語る機会を追加」できる。

### KX-013 Flexible Service Elements

**優先度:** P0

**受け入れ条件**

- 標準タイプと custom 要素を追加できる。
- 要素を追加・削除・複製・並べ替えできる。
- 複数 hymns と複数 ceremonies を登録できる。
- ceremony の前後に hymn を配置できる。
- キーボードでも並べ替えられる。

### KX-014 Service templates

**優先度:** P0

**受け入れ条件**

- 主日礼拝と祈祷会の初期テンプレートがある。
- テンプレート適用後も要素を自由に編集できる。
- 適用で既存要素を上書きする場合は確認する。

### KX-015 Preparation template and tasks

**優先度:** P0

**受け入れ条件**

- Message 作成時に type 対応の準備タスクを生成できる。
- task 状態、期限、メモ、順序を変更できる。
- skipped を進捗率の分母から除外する。
- 進捗計算の unit test がある。

### KX-016 Home dashboard v1

**優先度:** P0

**受け入れ条件**

- 次の Gathering、Message、Passage、Venue、残り日数を表示する。
- 準備進捗と期限超過タスクを表示する。
- 今後4週間を表示する。
- ホームから Quick Add できる。

### KX-017 Monthly calendar v1

**優先度:** P0

**受け入れ条件**

- Gathering を月間表示する。
- 日付から Gathering を作成できる。
- Gathering を選んで編集できる。
- timezone による日付ずれを防ぐテストがある。

### KX-018 Export v1

**優先度:** P0

**受け入れ条件**

- Workspace データを JSON と CSV で出力できる。
- Message を Markdown 出力できる。
- export に他 Workspace のデータが混入しない。
- 無料プランでもユーザー自身のデータを出力できる。

### KX-019 Spreadsheet import discovery

**優先度:** P0

**受け入れ条件**

- v1.3.1 の列一覧、型、例外、重複規則を文書化する。
- 1行から Message/Gathering/Service Elements への変換表がある。
- 移行できない値の保存方針がある。

### KX-020 Spreadsheet import dry run

**優先度:** P1

**受け入れ条件**

- XLSX/CSV を解析し、列マッピングを確認できる。
- 保存前に作成予定件数、warning、error、duplicate を表示する。
- dry run は DB 正本を変更しない。
- 再実行用 fingerprint を生成する。

## 4. Beta 前の追加 Story

### KX-021 Transactional Spreadsheet import

- 行単位の結果と移行レポート。
- 再実行安全性。
- rollback または batch soft delete。

### KX-022 Search and saved filters

- title、Passage、series、theme、venue、speaker、date。
- URL 共有可能な filter。

### KX-023 Basic analytics

- OT/NT、book、genre、公同書簡、theme。
- Message/Delivery 単位を明示。

### KX-024 Observances and liturgical presets

- Workspace ごとの有効化・名称変更・独自追加。
- series と分離。

### KX-025 Audit history and restore

- 重要変更の履歴。
- soft-deleted entity の復元。

### KX-026 PWA and resilience

- installability。
- read cache。
- network failure 時の明確な状態。

## 5. リリース前チェックリスト

- [ ] P0 受け入れ条件を満たす
- [ ] RLS の許可・拒否テストが通る
- [ ] migration を空 DB と既存 DB の両方で検証する
- [ ] 代表的 Spreadsheet の dry run/import/export を検証する
- [ ] 主要 E2E が通る
- [ ] axe とキーボード操作を確認する
- [ ] 本文・token・API key がログへ出ない
- [ ] backup/restore 手順を確認する
- [ ] error monitoring と運用通知が有効
- [ ] Jimi の実利用による受け入れ確認を行う
