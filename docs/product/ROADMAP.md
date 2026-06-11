# Keryx Next 開発ロードマップ

更新日: 2026-06-11

## 1. ロードマップ原則

- 機能数ではなく、牧師の週次ワークフローが端から端まで成立したかで進捗を判断する。
- 各フェーズは、受け入れ条件、テスト、移行手順、観測可能性を満たしてから次へ進む。
- AI とネイティブ iOS は、コアデータモデルと日常利用が安定してから実装する。
- 現行ユーザーのデータを失わない。移行機能を後回しにしない。
- 早期に少人数の牧師へ試用してもらい、画面の好みではなく実際の利用行動で判断する。

## 2. 推奨リリース戦略

| 段階                 | 対象             | 目的                                 |
| -------------------- | ---------------- | ------------------------------------ |
| Internal Alpha       | Jimi の実データ  | 基本モデルと週次利用の検証           |
| Private Beta         | 5〜10人の牧師    | 用語、入力速度、移行、継続利用の検証 |
| Paid Beta            | 20〜50 Workspace | 課金、運用、サポート、信頼性の検証   |
| General Availability | 一般公開         | 安定運用と成長                       |

## 3. Phase 0: 発見・基盤・移行判断

目標: 現行資産を理解し、次期版の基盤と最初の垂直スライスを安全に開始できる状態にする。

### 実施内容

- 現行 Vite/React/Supabase 実装の gap analysis。
- Spreadsheet v1.3.1 の列・入力規則・代表データ分析。
- Message / Gathering / Service Element モデルの ADR 作成。
- モノレポ、Next.js、Supabase local development、CI の構築。
- TypeScript strict、lint、format、unit、E2E の最小構成。
- Workspace、membership、RLS の最小 schema。
- 日本語書巻マスタと Passage parser の設計・テスト。
- UI design tokens と主要画面の低忠実度プロトタイプ。

### 出口条件

- `pnpm lint && pnpm test && pnpm build` が CI で通る。
- local Supabase を migration から再構築できる。
- Workspace A/B 分離の RLS テストが通る。
- Passage parser が合意した日本語入力例を処理できる。
- 現行資産の「再利用・移行・廃止」一覧が文書化されている。
- Jimi が Message / Gathering 分離と主要画面フローを承認している。

## 4. Phase 1: Web MVP 垂直スライス

目標: ログインから次の主日の計画・準備状況確認までを、実データで毎週使えるようにする。

### 実施内容

- 認証、Workspace 作成、個人 Workspace。
- Message CRUD、Inbox、状態管理。
- 構造化 Passage、シリーズ、テーマ。
- Gathering CRUD、Venue、説教者、Message Delivery。
- Service Element の追加・削除・並べ替え。
- 主日礼拝と祈祷会のテンプレート。
- 準備タスク生成、進捗、期限。
- 次の Gathering と今後の予定を表示するホーム。
- 月間カレンダー。
- CSV/JSON/Markdown 基本エクスポート。
- ソフトデリートと復元。

### 出口条件

- Jimi が4週連続で Spreadsheet と併用せず、次の主日の計画を Keryx Next で更新できる。
- 新規 Message + Gathering を2分以内に作成できる。
- 同じ Message を2つの Gathering に割り当てられる。
- 式典の前後に複数の賛美を配置できる。
- 主な E2E と RLS テストが CI で通る。
- 保存失敗がユーザーへ明確に通知され、データを失わない。

## 5. Phase 2: 移行・ワークフロー完成

目標: Spreadsheet ユーザーが安心して移行し、日々の入力と礼拝準備を高速に行えるようにする。

### 実施内容

- XLSX/CSV import wizard。
- 列マッピング、validation、dry run、重複検出、再実行安全性。
- Quick Add と Command Palette。
- 保存済みフィルター、高速検索。
- 礼拝テンプレート管理。
- Message 種別ごとの準備テンプレート。
- 添付・外部リンク。
- 変更履歴、監査イベント、バックアップ導線。
- PWA install と基本 offline/read cache の検証。

### 出口条件

- Spreadsheet v1.3.1 の代表ファイルを、データ欠落なく移行できる。
- インポートエラーを行単位で説明・修正できる。
- Quick Add の中央値が30秒以内。
- 主要操作がキーボードだけで完了する。
- 既存ユーザー向け移行ガイドとロールバック手順がある。

## 6. Phase 3: 年間計画・分析・教会暦

目標: Keryx を単なる記録アプリではなく、年間の説教計画と振り返りの道具にする。

### 実施内容

- 年間カレンダーと週表示。
- 教会暦プリセット、独自 Observance、教派設定。
- アドベント、クリスマス、年末・年始、受難週、イースター、召天者記念、ペンテコステ、伝道礼拝。
- 旧約/新約、書巻、ジャンル、公同書簡、テーマ分析。
- Passage coverage map と過去使用履歴。
- シリーズ計画対実績。
- 分析から Message 一覧への drill-down。
- iCal export / subscription。

### 出口条件

- すべてのグラフに期間・フィルター・母数が表示される。
- Message 単位と Delivery 単位の集計が明確に区別される。
- 年間計画画面から日程・Message を編集できる。
- 教会暦は Workspace ごとに有効化・名称変更・独自追加できる。
- 分析の集計値が fixture データと一致する自動テストがある。

## 7. Phase 4: チーム・課金・選択的AI

目標: 教会チームで安全に共有でき、持続可能な有料プロダクトとして運用できるようにする。

### 実施内容

- メンバー招待、role、権限。
- 礼拝計画共有と Message private notes の分離。
- コメント、確認依頼、担当者。
- 課金、プラン制限、請求状態、猶予期間。
- AI gateway、利用上限、監査、提案承認フロー。
- AI テーマ候補、要約、偏り・重複分析。
- 運用ダッシュボード、サポート導線、ステータスページ。

### 出口条件

- 全 role の許可・拒否ケースを RLS/E2E で検証している。
- 課金失敗時にもデータ閲覧・エクスポートが可能である。
- AI の提案はユーザー承認なしに正本を変更しない。
- AI API key がクライアントへ露出しない。
- Private Beta の継続率と支払い意向が事前に定めた基準を満たす。

## 8. Phase 5: iOS

目標: 移動中・礼拝直前・会議中の軽量操作に優れた iOS 体験を提供する。

### iOS 初期スコープ

- ログインと Workspace 切替。
- 次の Gathering と準備進捗。
- Quick Add。
- Message / Gathering の閲覧と軽量編集。
- 通知と deep link。
- offline queue と同期状態表示。

### 初期非目標

- Web と同等の高度な年間分析。
- 複雑な礼拝順序テンプレート編集。
- フル機能の長文原稿エディタ。

### 出口条件

- Web と同じ domain package、validation、Passage parser を利用する。
- offline 操作の競合と失敗をユーザーへ説明できる。
- TestFlight で主要フローが安定している。
- iOS 固有機能が必要な利用行動データが確認できている。

## 9. 最初の3スプリント

スプリント期間はチームの速度に合わせる。下記は順序を示す。

### Sprint 1: Foundation

- monorepo と Next.js app。
- Supabase local + migration + generated types。
- Workspace / membership / profile。
- RLS テスト。
- design tokens と app shell。
- Passage book master と parser の最初の対応範囲。

成果: ログインしたユーザーが自分の空の Workspace を安全に開ける。

### Sprint 2: Message Vertical Slice

- Message schema / repository / validation。
- Inbox と Message list/detail/create。
- Passage picker。
- Series の最小 CRUD。
- ソフトデリート、監査イベント。
- unit/integration/E2E。

成果: 説教アイデアを記録し、構造化 Passage とともに保存・再編集できる。

### Sprint 3: Gathering Vertical Slice

- Gathering、Venue、Message Delivery。
- Service Element と並べ替え。
- 主日礼拝テンプレート。
- Preparation task と進捗。
- ホームの「次の Gathering」。
- 月間カレンダー。

成果: 次の主日の礼拝計画と説教準備状況をホームから確認・更新できる。

## 10. 継続判断ゲート

### Gate A: モデル妥当性

Jimi の実データ20件以上を入れ、Message / Gathering 分離が不自然でないことを確認する。

### Gate B: 週次利用

4週間の実利用で、記録漏れ・二重入力・操作停滞を観察する。問題が残る場合、分析・AIへ進まない。

### Gate C: 他ユーザー適合

5人以上の牧師が自力で最初の計画と移行を完了できることを確認する。

### Gate D: 有料化

データ信頼性、バックアップ、課金失敗時の扱い、サポート手順が完成してから有料化する。

### Gate E: iOS

PWA では満たせない具体的な利用ニーズが確認できてからネイティブ実装へ進む。

## 11. 主なリスクと対策

| リスク                         | 兆候                               | 対策                                |
| ------------------------------ | ---------------------------------- | ----------------------------------- |
| 機能過多                       | 日常の登録が遅くなる               | Quick Add と段階的詳細入力を最優先  |
| データモデル過剰設計           | 単純入力に多数の必須項目           | 必須項目を最小化し、詳細は任意      |
| Spreadsheet 移行失敗           | ユーザーが元データを手直しし続ける | Dry Run、列マッピング、移行レポート |
| AI が中心になる                | コア管理機能が未完成               | AI は Phase 4 まで本番スコープ外    |
| 権限漏えい                     | Workspace 間データ参照             | RLS test と server authorization    |
| iOS の重複実装                 | Web/mobile で挙動が違う            | domain/validation/scripture を共有  |
| 聖書本文の権利問題             | 本文を無断保存・配布               | 初期版は参照箇所のみ                |
| エージェントによる一括書き直し | 大量差分、テスト不足               | 小さな垂直スライス、ADR、品質ゲート |

## 12. Definition of Done

すべてのチケットは次を満たす。

- 受け入れ条件を満たす。
- 型、validation、認可境界が明示されている。
- 必要な unit/integration/E2E/RLS test がある。
- loading、empty、error、success 状態が設計されている。
- キーボードと主要アクセシビリティを確認している。
- ユーザー向け文言が日本語で統一されている。
- migration / rollback / data impact が必要なら文書化されている。
- lint、test、build が通る。
- 関連仕様・ADR・変更履歴が更新されている。
