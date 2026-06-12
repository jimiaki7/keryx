-- KX-015（簡素化版）: 準備段階
-- 当初はテンプレート式の準備タスク（preparation_tasks）を実装したが、
-- Jimi のフィードバック（2026-06-12「未着手、釈義、アウトライン、原稿、完了くらいの
-- プロセスが分かればそれで十分」）により、Message ごとの単一ステージへ置き換えた。
-- 経緯と判断は docs/adr/0003-preparation-stage-simplification.md を参照。

alter table public.messages
  add column preparation_stage text not null default 'not_started'
    check (preparation_stage in ('not_started', 'exegesis', 'outline', 'manuscript', 'completed'));

-- ステージ変更は既存の messages_audit トリガー（changed_fields）で監査される
