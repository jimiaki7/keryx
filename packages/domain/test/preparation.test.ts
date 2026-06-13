import { describe, expect, it } from 'vitest';
import {
  isPreparationBehind,
  isPreparationStage,
  PREPARATION_STAGES,
  preparationStageIndex,
  preparationStagePercent,
} from '../src/preparation';

describe('準備段階（ADR-0003）', () => {
  it('5段階が順序どおりに定義されている', () => {
    expect(PREPARATION_STAGES).toEqual([
      'not_started',
      'exegesis',
      'outline',
      'manuscript',
      'completed',
    ]);
  });

  it('序数と進捗の目安', () => {
    expect(preparationStageIndex('not_started')).toBe(0);
    expect(preparationStageIndex('exegesis')).toBe(1);
    expect(preparationStageIndex('manuscript')).toBe(3);
    expect(preparationStagePercent('not_started')).toBe(0);
    expect(preparationStagePercent('exegesis')).toBe(25);
    expect(preparationStagePercent('outline')).toBe(50);
    expect(preparationStagePercent('manuscript')).toBe(75);
    expect(preparationStagePercent('completed')).toBe(100);
  });

  it('未知の値は未着手として扱う（古いデータへの耐性）', () => {
    expect(preparationStageIndex('unknown')).toBe(0);
    expect(preparationStagePercent('unknown')).toBe(0);
  });

  it('isPreparationStage が型ガードとして機能する', () => {
    expect(isPreparationStage('exegesis')).toBe(true);
    expect(isPreparationStage('done')).toBe(false);
    expect(isPreparationStage(null)).toBe(false);
  });

  it('isPreparationBehind: 残り日数に対する遅れを判定する', () => {
    // 過去・当日は対象外
    expect(isPreparationBehind('not_started', 0)).toBe(false);
    expect(isPreparationBehind('not_started', -3)).toBe(false);
    // 3日前: 完了していなければ遅れ
    expect(isPreparationBehind('manuscript', 2)).toBe(true);
    expect(isPreparationBehind('completed', 2)).toBe(false);
    // 1週前: 原稿に達していなければ遅れ
    expect(isPreparationBehind('outline', 6)).toBe(true);
    expect(isPreparationBehind('manuscript', 6)).toBe(false);
    // 2週前: アウトラインに達していなければ遅れ
    expect(isPreparationBehind('exegesis', 12)).toBe(true);
    expect(isPreparationBehind('outline', 12)).toBe(false);
    // 2週より先は遅れと見なさない
    expect(isPreparationBehind('not_started', 20)).toBe(false);
  });
});
