import { describe, expect, it } from 'vitest';
import {
  computePreparationProgress,
  DEFAULT_PREPARATION_TEMPLATES,
  preparationTemplateFor,
} from '../src/preparation';

describe('computePreparationProgress', () => {
  it('done / 全体 を percent にする', () => {
    const tasks = [{ status: 'done' }, { status: 'done' }, { status: 'todo' }, { status: 'doing' }];
    expect(computePreparationProgress(tasks)).toEqual({ total: 4, done: 2, percent: 50 });
  });

  it('skipped を分母から除外する（KX-015）', () => {
    const tasks = [
      { status: 'done' },
      { status: 'skipped' },
      { status: 'skipped' },
      { status: 'todo' },
    ];
    // skipped 2件を除くと 1/2 = 50%
    expect(computePreparationProgress(tasks)).toEqual({ total: 2, done: 1, percent: 50 });
  });

  it('全タスクが skipped なら 0%（0除算しない）', () => {
    expect(computePreparationProgress([{ status: 'skipped' }])).toEqual({
      total: 0,
      done: 0,
      percent: 0,
    });
  });

  it('タスクが無ければ 0%', () => {
    expect(computePreparationProgress([])).toEqual({ total: 0, done: 0, percent: 0 });
  });

  it('全タスク done で 100%', () => {
    expect(computePreparationProgress([{ status: 'done' }, { status: 'done' }]).percent).toBe(100);
  });

  it('丸めは四捨五入（1/3 → 33%）', () => {
    const tasks = [{ status: 'done' }, { status: 'todo' }, { status: 'todo' }];
    expect(computePreparationProgress(tasks).percent).toBe(33);
  });
});

describe('preparationTemplateFor', () => {
  it('説教テンプレートは釈義手順12項目（§6.7 P0）', () => {
    expect(DEFAULT_PREPARATION_TEMPLATES['sermon']).toEqual([
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
    ]);
  });

  it('全 Message 種別にテンプレートがある', () => {
    for (const type of ['sermon', 'prayer_meeting_exhortation', 'devotional', 'lecture', 'other']) {
      expect(preparationTemplateFor(type).length).toBeGreaterThan(0);
    }
  });

  it('未知の種別は other にフォールバックする', () => {
    expect(preparationTemplateFor('unknown')).toEqual(DEFAULT_PREPARATION_TEMPLATES['other']);
  });
});
