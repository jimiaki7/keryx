import { describe, expect, it } from 'vitest';
import {
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
});
