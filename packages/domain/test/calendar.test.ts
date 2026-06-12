import { describe, expect, it } from 'vitest';
import {
  addMonths,
  formatMonthJa,
  gridRange,
  isValidYearMonth,
  monthGrid,
  tokyoDateOf,
} from '../src/calendar';

describe('tokyoDateOf（タイムゾーンによる日付ずれ防止: KX-017）', () => {
  it('JST深夜帯のGatheringがUTC解釈で前日へずれない', () => {
    // 2026-07-01 00:30 JST は UTC では 2026-06-30 15:30。
    // UTC日付でグルーピングすると6/30へずれるが、Tokyo日付では7/1でなければならない
    expect(tokyoDateOf('2026-06-30T15:30:00.000Z')).toBe('2026-07-01');
  });

  it('JST同日の朝（UTC前日夜）も正しい日付になる', () => {
    // 2026-06-14 07:00 JST = 2026-06-13 22:00 UTC
    expect(tokyoDateOf('2026-06-13T22:00:00.000Z')).toBe('2026-06-14');
  });

  it('オフセット付きISO（+09:00）も同じ結果になる', () => {
    expect(tokyoDateOf('2026-06-14T10:30:00+09:00')).toBe('2026-06-14');
    expect(tokyoDateOf('2026-07-01T00:30:00+09:00')).toBe('2026-07-01');
  });

  it('月末日のJST 23:59は翌月へずれない', () => {
    expect(tokyoDateOf('2026-06-30T23:59:00+09:00')).toBe('2026-06-30');
  });
});

describe('monthGrid', () => {
  it('2026年6月は月曜始まりで、前月の5/31が先頭に入る', () => {
    const weeks = monthGrid('2026-06');
    expect(weeks[0]![0]).toEqual({ date: '2026-05-31', inMonth: false });
    expect(weeks[0]![1]).toEqual({ date: '2026-06-01', inMonth: true });
  });

  it('すべての週が7日で、当月の全日を含む', () => {
    for (const ym of ['2026-01', '2026-02', '2026-06', '2026-12', '2024-02']) {
      const weeks = monthGrid(ym);
      for (const week of weeks) expect(week).toHaveLength(7);
      const inMonthDays = weeks.flat().filter((d) => d.inMonth);
      const [y, m] = ym.split('-').map(Number);
      const expected = new Date(Date.UTC(y!, m!, 0)).getUTCDate();
      expect(inMonthDays).toHaveLength(expected);
      expect(inMonthDays[0]!.date).toBe(`${ym}-01`);
    }
  });

  it('うるう年2月を正しく扱う（2024-02は29日）', () => {
    const days = monthGrid('2024-02')
      .flat()
      .filter((d) => d.inMonth);
    expect(days).toHaveLength(29);
    expect(days[28]!.date).toBe('2024-02-29');
  });

  it('日曜始まりの月（2026-02-01は日曜）は埋め草なしで始まる', () => {
    const weeks = monthGrid('2026-02');
    expect(weeks[0]![0]).toEqual({ date: '2026-02-01', inMonth: true });
  });
});

describe('addMonths / gridRange / バリデーション', () => {
  it('年をまたぐ加減算', () => {
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-06', 0)).toBe('2026-06');
  });

  it('gridRange はグリッドの両端日を返す', () => {
    expect(gridRange('2026-06')).toEqual({ start: '2026-05-31', end: '2026-07-04' });
  });

  it('isValidYearMonth が不正値を拒否する', () => {
    expect(isValidYearMonth('2026-06')).toBe(true);
    expect(isValidYearMonth('2026-13')).toBe(false);
    expect(isValidYearMonth('2026-00')).toBe(false);
    expect(isValidYearMonth('abc')).toBe(false);
    expect(isValidYearMonth('2026-6')).toBe(false);
  });

  it('formatMonthJa', () => {
    expect(formatMonthJa('2026-06')).toBe('2026年6月');
  });
});
