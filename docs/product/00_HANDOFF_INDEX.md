# Keryx Next 開発引き継ぎパッケージ

更新日: 2026-06-11

## 目的

Keryx Next は、年間計画・礼拝準備・説教準備・振り返りを一つの流れに統合する、日本語ファーストの説教管理プロダクトである。

このパッケージは、現行の Google Spreadsheet 版 Keryx v1.3.1 と、Vite/React/Supabase 版プロトタイプを土台に、Claude Code または他の高性能コーディングエージェントが安全に開発を進めるための正本である。

## 最初に読む順序

1. [KERYX_PRODUCT_SPEC.md](./KERYX_PRODUCT_SPEC.md)
2. [TECHNICAL_ARCHITECTURE.md](./TECHNICAL_ARCHITECTURE.md)
3. [CURRENT_STATE_GAP_ANALYSIS.md](./CURRENT_STATE_GAP_ANALYSIS.md)
4. [../adr/0001-nextjs-monorepo-migration.md](../adr/0001-nextjs-monorepo-migration.md)
5. [ROADMAP.md](./ROADMAP.md)
6. [IMPLEMENTATION_BACKLOG.md](./IMPLEMENTATION_BACKLOG.md)
7. [../ai/CLAUDE_CODE_MASTER_PROMPT.md](../ai/CLAUDE_CODE_MASTER_PROMPT.md) または [../ai/ULTRACODE_MASTER_PROMPT.md](../ai/ULTRACODE_MASTER_PROMPT.md)

## 正本と優先順位

仕様が衝突した場合は、次の順に優先する。

1. Jimi の最新の明示的な指示
2. `KERYX_PRODUCT_SPEC.md` のプロダクト原則と受け入れ条件
3. `TECHNICAL_ARCHITECTURE.md` のデータ境界・セキュリティ原則
4. `ROADMAP.md` と `IMPLEMENTATION_BACKLOG.md`
5. 現行コードの挙動

## 現行資産

- Web プロトタイプ: `/Users/james/keryx`
- Spreadsheet 商品版コード: `/Users/james/sermon-planner-product`
- Spreadsheet v1.3.1: `/Users/james/outputs/sermon-planner-v1/年間説教プランナー_Keryx_v1.3.1.xlsx`
- Google Sheets: `https://docs.google.com/spreadsheets/d/1gBG-neterCcY9hik3z_laxwIA2HRoXxooJW4Jm2Bub0/edit`

## 重要な設計判断

- `message`（説教・奨励の内容）と `gathering`（いつ、どこで、誰が語るか）を分離する。
- 礼拝順序は固定列ではなく、並べ替え可能な `service_elements` として保持する。
- 聖書箇所は表示文字列だけでなく、検索・分析できる構造化データとして保持する。
- 最初から全データを `workspace_id` 配下に置き、個人利用から教会チーム利用へ拡張可能にする。
- まず高速で信頼できる週次ワークフローを完成させ、AI とネイティブ iOS はその後に進める。

## エージェントへの注意

- いきなり全体を書き直さない。最初に現行実装の資産・欠陥・移行方針を報告すること。
- 最初の実装は、認証から説教作成・礼拝予定・ダッシュボード表示までを通す小さな垂直スライスとする。
- Supabase の公開スキーマにある全テーブルで RLS を必須とする。
- 聖書本文の著作権に配慮し、初期版では聖書本文そのものではなく参照箇所を保存する。
- AI の生成結果を神学的権威として扱わない。必ずユーザー確認を経て保存する。
