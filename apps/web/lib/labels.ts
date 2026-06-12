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
  inbox: 'Inbox',
  planned: '計画中',
  preparing: '準備中',
  ready: '準備完了',
  completed: '完了',
  archived: 'アーカイブ',
};
