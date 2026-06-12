# ADR-0004: Inbox 状態を廃止し、UI 表記を「メッセージ」に統一する

- Status: Accepted（Jimi の明示指示による）
- Date: 2026-06-12
- Decision owner: Jimi

## Context

仕様（KERYX_PRODUCT_SPEC §6.2 / KX-008）は「日付未定の Message は Inbox に入る」という
専用状態を定めていた。ナビ簡素化で Inbox ページを Messages のフィルタに統合した後、
Jimi から「フィルターの Inbox に必要を感じない。Quick Add から作成したら、状態は
計画中でも良い」「Messages を『メッセージ』に」とのフィードバックを受けた。

実際、日付未定かどうかは Gathering の有無で分かるため、専用の状態を持つ必要はない。

## Decision

- `messages.status` から `inbox` を削除し、既定値を `planned`（計画中）にする。
  状態は `planned → preparing → ready → completed`（+ `archived`）の5値。
- Quick Add で作成したメッセージは「計画中」で始まる。
- 旧 `/inbox` URL は `/messages` へリダイレクトする。
- UI の英語残り（Messages / Message / Inbox）を「メッセージ」に統一する
  （日本語ファースト原則 §4.4 の徹底。ナビ・タブ・見出し・空状態・フォーム文言）。
- Spreadsheet インポート（KX-019 §4.5）は従来どおり 未着手→planned で変更なし。

## Consequences

- 状態のリストが1つ減り、Quick Add 後の流れが「計画中→準備を進める」と直感的になる。
- 「日付未定のものだけを見る」ビューは失われる。必要になれば
  「Gathering 未割当」フィルタ（データから導出）として復活できる（新しい状態は作らない）。
