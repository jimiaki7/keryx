# ADR-0003: 準備管理をタスク方式から単一の準備段階へ簡素化する

- Status: Accepted（Jimi の明示指示による）
- Date: 2026-06-12
- Decision owner: Jimi

## Context

KERYX_PRODUCT_SPEC §6.7 P0 と KX-015 は、Message ごとにテンプレート化された準備タスク
（説教=釈義12工程、各タスクに状態・期限・メモ・順序）を定めており、その通りに実装した。

実装を確認した Jimi から「準備タスクの機能はもっとシンプルでいい。未着手、釈義、
アウトライン、原稿、完了くらいのプロセスが分かればそれで十分」とのフィードバックを受けた。
これはロードマップ §11 が警告していた「データモデル過剰設計」の兆候そのものであり、
正本優先順位（00_HANDOFF_INDEX）の第1位「Jimi の最新の明示的な指示」に従う。

## Decision

- `preparation_tasks` テーブル・タスクUI・進捗%計算・期限/メモ/並べ替えを廃止する。
- `messages.preparation_stage` を追加する:
  `not_started（未着手）→ exegesis（釈義）→ outline（アウトライン）→ manuscript（原稿）→ completed（完了）`
- Message 詳細ではワンクリックのステージ切替、ホームでは次の説教のステージを表示する。
- Spreadsheet インポートの「準備段階」8値は5ステージへマッピングする
  （KX-019_SPREADSHEET_IMPORT_MAPPING.md §4.5 を改訂）。
- `messages.status`（inbox/planned/…/archived）はワークフロー軸として従来どおり維持し、
  preparation_stage は準備の進み具合の軸として独立させる。

## Consequences

- 入力負荷が大きく下がり、「毎週迷わず使えること」（第一ペルソナの価値）に適合する。
- タスク単位の期限・期限超過アラート（ホームの要確認）は失われる。
  必要性が実利用で再確認された場合は、ステージに期限を1つ持たせる等の最小拡張から検討する。
- 仕様 §6.7 P0 のうちテンプレートタスク関連項目は本 ADR により上書きされる。
  Workspace ごとの準備テンプレート（P1）も前提を失うため凍結する。
