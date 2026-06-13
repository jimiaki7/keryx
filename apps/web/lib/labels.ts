// ユーザー向け日本語ラベル。コンポーネントへ直書きしない（将来の英語化に備える）

export const MESSAGE_TYPE_LABELS: Record<string, string> = {
  sermon: '説教',
  prayer_meeting_exhortation: '祈祷会奨励',
  devotional: 'ディボーション',
  lecture: '講演',
  other: 'その他',
};

export const SERIES_STATUS_LABELS: Record<string, string> = {
  planned: '計画中',
  active: '進行中',
  paused: '休止中',
  completed: '完了',
  archived: 'アーカイブ',
};

export const MESSAGE_STATUS_LABELS: Record<string, string> = {
  planned: '計画中',
  preparing: '準備中',
  ready: '準備完了',
  completed: '完了',
  archived: 'アーカイブ',
};

export const PREPARATION_STAGE_LABELS: Record<string, string> = {
  not_started: '未着手',
  exegesis: '釈義',
  outline: 'アウトライン',
  manuscript: '原稿',
  completed: '完了',
};

export const GATHERING_KIND_LABELS: Record<string, string> = {
  sunday_worship: '主日礼拝',
  prayer_meeting: '祈祷会',
  special_service: '特別礼拝',
  chapel: 'チャペル',
  other: 'その他',
};

export const GATHERING_STATUS_LABELS: Record<string, string> = {
  draft: '下書き',
  scheduled: '予定',
  completed: '実施済み',
  canceled: '中止',
};

export const SERVICE_ELEMENT_TYPE_LABELS: Record<string, string> = {
  call_to_worship: '招詞',
  hymn: '賛美',
  prayer: '祈り',
  responsive_reading: '聖書交読',
  scripture_reading: '聖書朗読',
  message: '説教',
  offering: '献金',
  ceremony: '式典',
  doxology: '頌栄',
  benediction: '祝祷',
  custom: 'その他',
};

export const ENTITY_TYPE_LABELS: Record<string, string> = {
  message: 'メッセージ',
  gathering: '礼拝予定',
  series: 'シリーズ',
  observance: '教会暦',
  venue: '会場',
};

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  create: '作成',
  update: '更新',
  soft_delete: '削除',
  restore: '復元',
};

// audit の changed_fields（列名）→ 日本語。未知の列はそのまま表示する。
export const FIELD_LABELS: Record<string, string> = {
  title: 'タイトル',
  status: '状態',
  preparation_stage: '準備段階',
  central_message: '中心メッセージ',
  summary: '概要',
  outline_markdown: 'アウトライン',
  notes_markdown: 'ノート',
  type: '種別',
  primary_series_id: 'シリーズ',
  starts_at: '日時',
  ends_at: '終了日時',
  venue_id: '会場',
  kind: '集会種別',
  audience: '対象',
  notes: 'メモ',
  name: '名称',
  description: '説明',
  color: '色',
  starts_on: '開始日',
  ends_on: '終了日',
  deleted_at: '削除状態',
};

export const CEREMONY_TYPE_LABELS: Record<string, string> = {
  communion: '聖餐式',
  baptism: '洗礼式',
  transfer: '転入会式',
  ordination: '任職式',
  memorial: '召天者記念',
  other: 'その他',
};
