import { describe, expect, it } from 'vitest';
import { gregorianEaster, liturgicalObservances } from '../src/liturgical';

describe('gregorianEaster: 既知の復活祭', () => {
  it('既知年の復活祭を正しく計算する', () => {
    expect(gregorianEaster(2024)).toEqual({ month: 3, day: 31 });
    expect(gregorianEaster(2025)).toEqual({ month: 4, day: 20 });
    expect(gregorianEaster(2026)).toEqual({ month: 4, day: 5 });
    expect(gregorianEaster(2027)).toEqual({ month: 3, day: 28 });
  });
});

describe('liturgicalObservances: 2026年プリセット', () => {
  const list = liturgicalObservances(2026);
  const by = (kind: string) => list.find((o) => o.kind === kind)!;

  it('7件（元旦・受難週・イースター・ペンテコステ・召天者記念・アドベント・クリスマス）', () => {
    expect(list.map((o) => o.kind)).toEqual([
      'new_year',
      'holy_week',
      'easter',
      'pentecost',
      'memorial',
      'advent',
      'christmas',
    ]);
  });

  it('イースターは復活祭当日（2026-04-05）', () => {
    expect(by('easter').startsOn).toBe('2026-04-05');
    expect(by('easter').endsOn).toBe('2026-04-05');
  });

  it('受難週は棕櫚の主日(復活祭-7)〜聖土曜日(復活祭-1)', () => {
    expect(by('holy_week').startsOn).toBe('2026-03-29');
    expect(by('holy_week').endsOn).toBe('2026-04-04');
  });

  it('ペンテコステは復活祭+49日（2026-05-24）', () => {
    expect(by('pentecost').startsOn).toBe('2026-05-24');
  });

  it('クリスマスは12/25、元旦は1/1', () => {
    expect(by('christmas').startsOn).toBe('2026-12-25');
    expect(by('new_year').startsOn).toBe('2026-01-01');
  });

  it('アドベント第1主日はクリスマス前の第4日曜、終わりは12/24', () => {
    // 2026-12-25 は金曜 → 直近の日曜は 12/20(第4主日) → 第1主日は 11/29
    expect(by('advent').startsOn).toBe('2026-11-29');
    expect(by('advent').endsOn).toBe('2026-12-24');
  });

  it('召天者記念は11月第1主日（2026-11-01は日曜）', () => {
    expect(by('memorial').startsOn).toBe('2026-11-01');
  });

  it('presetKey は年つきで一意', () => {
    expect(by('easter').presetKey).toBe('easter-2026');
    expect(new Set(list.map((o) => o.presetKey)).size).toBe(list.length);
  });
});
