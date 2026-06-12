// 説教準備ワークフロー（KX-015）のドメインロジック。
// DB・UIに依存しない純粋関数として Web / 将来の mobile で共有する。

export type PreparationStatus = 'todo' | 'doing' | 'done' | 'skipped';

export type PreparationTaskLike = {
  status: PreparationStatus | string;
};

export type PreparationProgress = {
  /** skipped を除いた分母 */
  total: number;
  done: number;
  /** 0〜100 の整数。分母が 0 のときは 0 */
  percent: number;
};

/**
 * 準備進捗を計算する。skipped は「やらないと決めた作業」なので分母から除外する（KX-015）。
 */
export function computePreparationProgress(tasks: PreparationTaskLike[]): PreparationProgress {
  const counted = tasks.filter((t) => t.status !== 'skipped');
  const done = counted.filter((t) => t.status === 'done').length;
  const total = counted.length;
  return {
    total,
    done,
    percent: total === 0 ? 0 : Math.round((done / total) * 100),
  };
}

/**
 * Message 種別ごとの初期準備テンプレート（KERYX_PRODUCT_SPEC §6.7 P0）。
 * 釈義の手順（本文確定→文脈→原語→…→原稿→推敲→資料）に従う。
 * Workspace ごとのカスタムテンプレートは P1（preparation_templates）で扱う。
 */
export const DEFAULT_PREPARATION_TEMPLATES: Record<string, readonly string[]> = {
  sermon: [
    '本文確定',
    '文脈',
    '原語',
    '構文・文法',
    '背景',
    '神学的主題',
    'キリストへの照準',
    '適用',
    '骨子',
    '原稿',
    '推敲',
    '資料',
  ],
  prayer_meeting_exhortation: [
    '本文確定',
    '文脈',
    '神学的主題',
    '適用と祈りの課題',
    '骨子',
    '原稿',
    '推敲',
  ],
  devotional: ['本文確定', '黙想', '適用', '原稿'],
  lecture: ['主題確定', '構成', '資料収集', '原稿', '推敲', '投影資料'],
  other: ['準備'],
};

/** 種別に対応する初期タスク名一覧を返す（未知の種別は other 扱い） */
export function preparationTemplateFor(messageType: string): readonly string[] {
  return DEFAULT_PREPARATION_TEMPLATES[messageType] ?? DEFAULT_PREPARATION_TEMPLATES['other']!;
}
