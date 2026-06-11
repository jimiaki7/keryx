import { describe, expect, it } from 'vitest';
import { formatPassage, parsePassage } from '../src/parser';
import type { PassageRange } from '../src/types';

function ok(input: string): PassageRange {
  const r = parsePassage(input);
  if (!r.ok) throw new Error(`parse failed for "${input}": ${r.error.message}`);
  return r.value;
}

function errCode(input: string): string {
  const r = parsePassage(input);
  if (r.ok) throw new Error(`expected error for "${input}"`);
  return r.error.code;
}

describe('parsePassage: 仕様書の入力例', () => {
  it('ヨハネ3:16', () => {
    expect(ok('ヨハネ3:16')).toMatchObject({
      bookId: 'John',
      startChapter: 3,
      startVerse: 16,
      endChapter: 3,
      displayText: 'ヨハネ3:16',
    });
  });

  it('ヨハ 3:16-21', () => {
    expect(ok('ヨハ 3:16-21')).toMatchObject({
      bookId: 'John',
      startChapter: 3,
      startVerse: 16,
      endChapter: 3,
      endVerse: 21,
      displayText: 'ヨハネ3:16-21',
    });
  });

  it('ヨハネの福音書 3章16〜21節', () => {
    expect(ok('ヨハネの福音書 3章16〜21節')).toMatchObject({
      bookId: 'John',
      startChapter: 3,
      startVerse: 16,
      endVerse: 21,
      displayText: 'ヨハネ3:16-21',
    });
  });

  it('John 3:16-21', () => {
    expect(ok('John 3:16-21')).toMatchObject({ bookId: 'John', startVerse: 16, endVerse: 21 });
  });

  it('詩篇 23（章のみ）', () => {
    expect(ok('詩篇 23')).toMatchObject({
      bookId: 'Ps',
      startChapter: 23,
      endChapter: 23,
      displayText: '詩篇23',
    });
    expect(ok('詩篇 23').startVerse).toBeUndefined();
  });

  it('Ⅰコリント13:1-13', () => {
    expect(ok('Ⅰコリント13:1-13')).toMatchObject({
      bookId: '1Cor',
      startChapter: 13,
      startVerse: 1,
      endVerse: 13,
      displayText: 'Ⅰコリント13:1-13',
    });
  });
});

describe('parsePassage: 形式バリエーション', () => {
  it('全角数字・全角コロンを解釈する', () => {
    expect(ok('ヨハネ３：１６')).toMatchObject({ bookId: 'John', startChapter: 3, startVerse: 16 });
  });

  it('章をまたぐ範囲', () => {
    expect(ok('ヨハネ3:16-4:2')).toMatchObject({
      startChapter: 3,
      startVerse: 16,
      endChapter: 4,
      endVerse: 2,
      displayText: 'ヨハネ3:16-4:2',
    });
    expect(ok('ヨハネ3章16節〜4章2節')).toMatchObject({
      startChapter: 3,
      startVerse: 16,
      endChapter: 4,
      endVerse: 2,
    });
  });

  it('章範囲（マタイ5-7、マタイ5章〜7章）', () => {
    expect(ok('マタイ5-7')).toMatchObject({
      bookId: 'Matt',
      startChapter: 5,
      endChapter: 7,
      displayText: 'マタイ5-7',
    });
    expect(ok('マタイ5章〜7章')).toMatchObject({ startChapter: 5, endChapter: 7 });
  });

  it('1章のみの書巻は「ユダ6」を1章6節と解釈する', () => {
    expect(ok('ユダ6')).toMatchObject({
      bookId: 'Jude',
      startChapter: 1,
      startVerse: 6,
      displayText: 'ユダ1:6',
    });
    expect(ok('ピレモン6')).toMatchObject({ bookId: 'Phlm', startChapter: 1, startVerse: 6 });
    expect(ok('ユダ6-7')).toMatchObject({
      startChapter: 1,
      startVerse: 6,
      endChapter: 1,
      endVerse: 7,
      displayText: 'ユダ1:6-7',
    });
  });

  it('表記揺れの書名（使徒言行録、第一コリント）', () => {
    expect(ok('使徒言行録2:42').bookId).toBe('Acts');
    expect(ok('第一コリント 13:4').bookId).toBe('1Cor');
    expect(ok('サムエル記上3:10').bookId).toBe('1Sam');
  });
});

describe('parsePassage: 拒否すべき入力', () => {
  it('空入力', () => {
    expect(errCode('')).toBe('empty_input');
    expect(errCode('   ')).toBe('empty_input');
  });

  it('存在しない章', () => {
    expect(errCode('詩篇151')).toBe('invalid_chapter');
    expect(errCode('ヨハネ22:1')).toBe('invalid_chapter');
    expect(errCode('ヨハネ0:1')).toBe('invalid_chapter');
  });

  it('逆転した範囲', () => {
    expect(errCode('ヨハネ3:21-16')).toBe('reversed_range');
    expect(errCode('ヨハネ4:2〜3:16')).toBe('reversed_range');
    expect(errCode('マタイ7-5')).toBe('reversed_range');
  });

  it('未知の書名には候補を返す', () => {
    const r = parsePassage('コリント13:1');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('unknown_book');
      expect(r.error.suggestions).toContain('コリント人への手紙第一');
    }
  });

  it('章のない入力は形式エラー', () => {
    expect(errCode('ヨハネ')).toBe('invalid_format');
  });

  it('0節は拒否する', () => {
    expect(errCode('ヨハネ3:0')).toBe('invalid_verse');
  });
});

describe('formatPassage', () => {
  it('正規化された表示文字列を生成する', () => {
    expect(
      formatPassage({
        bookId: 'John',
        startChapter: 3,
        startVerse: 16,
        endChapter: 3,
        endVerse: 21,
        displayText: '',
      }),
    ).toBe('ヨハネ3:16-21');
  });
});
