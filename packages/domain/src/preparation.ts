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
