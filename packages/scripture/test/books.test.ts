import { describe, expect, it } from 'vitest';
import { BIBLE_BOOKS, normalizeBookKey, resolveBook, suggestBooks } from '../src/books';

describe('書巻マスタ', () => {
  it('全66巻を正典順に持つ', () => {
    expect(BIBLE_BOOKS).toHaveLength(66);
    expect(BIBLE_BOOKS.map((b) => b.canonicalOrder)).toEqual(
      Array.from({ length: 66 }, (_, i) => i + 1),
    );
  });

  it('旧約39巻・新約27巻である', () => {
    expect(BIBLE_BOOKS.filter((b) => b.testament === 'old')).toHaveLength(39);
    expect(BIBLE_BOOKS.filter((b) => b.testament === 'new')).toHaveLength(27);
  });

  it('osis は一意である', () => {
    const ids = new Set(BIBLE_BOOKS.map((b) => b.osis));
    expect(ids.size).toBe(66);
  });

  it('新約ジャンルに「公同書簡」を使用し、「一般書簡」を使用しない', () => {
    const catholic = BIBLE_BOOKS.filter((b) => b.genre === '公同書簡').map((b) => b.osis);
    expect(catholic).toEqual(['Heb', 'Jas', '1Pet', '2Pet', '1John', '2John', '3John', 'Jude']);
    expect(BIBLE_BOOKS.some((b) => (b.genre as string) === '一般書簡')).toBe(false);
  });

  it('章数の代表値が正しい', () => {
    expect(resolveBook('詩篇')?.chapterCount).toBe(150);
    expect(resolveBook('黙示録')?.chapterCount).toBe(22);
    expect(resolveBook('オバデヤ書')?.chapterCount).toBe(1);
    expect(resolveBook('マラキ書')?.chapterCount).toBe(4);
  });

  it('日本語書名・略称から解決できる', () => {
    expect(resolveBook('ヨハネ')?.osis).toBe('John');
    expect(resolveBook('ヨハ')?.osis).toBe('John');
    expect(resolveBook('ヨハネの福音書')?.osis).toBe('John');
    expect(resolveBook('創')?.osis).toBe('Gen');
    expect(resolveBook('使徒言行録')?.osis).toBe('Acts');
    expect(resolveBook('詩編')?.osis).toBe('Ps');
  });

  it('第一・第二の表記揺れを解決できる', () => {
    for (const input of ['Ⅰコリント', '1コリント', '第一コリント', 'コリント第一', '１コリント']) {
      expect(resolveBook(input)?.osis).toBe('1Cor');
    }
    expect(resolveBook('サムエル記上')?.osis).toBe('1Sam');
    expect(resolveBook('列王記下')?.osis).toBe('2Kgs');
    expect(resolveBook('Ⅲヨハネ')?.osis).toBe('3John');
  });

  it('英語名・OSISから解決できる（大文字小文字無視）', () => {
    expect(resolveBook('John')?.osis).toBe('John');
    expect(resolveBook('john')?.osis).toBe('John');
    expect(resolveBook('1 Corinthians')?.osis).toBe('1Cor');
    expect(resolveBook('Gen')?.osis).toBe('Gen');
    expect(resolveBook('Isaiah')?.osis).toBe('Isa');
  });

  it('未知の書名は null を返し、候補を提案できる', () => {
    expect(resolveBook('存在しない書')).toBeNull();
    const names = suggestBooks('コリント').map((b) => b.osis);
    expect(names).toContain('1Cor');
    expect(names).toContain('2Cor');
  });

  it('normalizeBookKey が数字接頭辞へ統一する', () => {
    expect(normalizeBookKey('テサロニケ人への手紙第二')).toBe(
      normalizeBookKey('Ⅱテサロニケ人への手紙'),
    );
    expect(normalizeBookKey('歴代誌上')).toBe(normalizeBookKey('歴代誌第一'));
  });
});
