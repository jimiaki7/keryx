// 準備段階（KX-015 簡素化版・ADR-0003）のドメインロジック。
// 説教準備の進み具合は Message ごとの単一ステージで表す。

export const PREPARATION_STAGES = [
  'not_started',
  'exegesis',
  'outline',
  'manuscript',
  'completed',
] as const;

export type PreparationStage = (typeof PREPARATION_STAGES)[number];

export function isPreparationStage(value: unknown): value is PreparationStage {
  return typeof value === 'string' && (PREPARATION_STAGES as readonly string[]).includes(value);
}

/** ステージの序数（0=未着手 … 4=完了）。未知の値は 0 扱い */
export function preparationStageIndex(stage: string): number {
  const index = (PREPARATION_STAGES as readonly string[]).indexOf(stage);
  return index < 0 ? 0 : index;
}

/** 進捗の目安（0 / 25 / 50 / 75 / 100）。ホームの表示などに使う */
export function preparationStagePercent(stage: string): number {
  return Math.round((preparationStageIndex(stage) / (PREPARATION_STAGES.length - 1)) * 100);
}

/**
 * 礼拝日までの残り日数に対して準備が遅れているか（ホームの「要確認」用）。
 * 目安: 3日前=完了、1週前=原稿、2週前=アウトライン に達していなければ遅れと判定する。
 * 過去・当日（daysUntil<=0）は対象外（実施済み/直前は判定しない）。
 */
export function isPreparationBehind(stage: string, daysUntil: number): boolean {
  if (daysUntil <= 0) return false;
  const idx = preparationStageIndex(stage);
  if (daysUntil <= 3) return idx < 4; // 完了(4)未満
  if (daysUntil <= 7) return idx < 3; // 原稿(3)未満
  if (daysUntil <= 14) return idx < 2; // アウトライン(2)未満
  return false;
}
