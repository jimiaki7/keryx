import type { BibleBook, BookGenre, Testament } from './types';

function book(
  osis: string,
  canonicalOrder: number,
  testament: Testament,
  genre: BookGenre,
  nameJa: string,
  shortNameJa: string,
  nameEn: string,
  chapterCount: number,
  aliases: readonly string[],
): BibleBook {
  return {
    osis,
    canonicalOrder,
    testament,
    genre,
    nameJa,
    shortNameJa,
    nameEn,
    chapterCount,
    aliases,
  };
}

/**
 * 全66巻の書巻マスタ。書名は新改訳2017に従う。
 * 新約のジャンル区分は 福音書 / 歴史書 / パウロ書簡 / 公同書簡 / 黙示文学（一般書簡は使用しない）。
 */
export const BIBLE_BOOKS: readonly BibleBook[] = [
  // 旧約: 律法
  book('Gen', 1, 'old', '律法', '創世記', '創世記', 'Genesis', 50, ['創世', '創', 'Gn']),
  book('Exod', 2, 'old', '律法', '出エジプト記', '出エジプト', 'Exodus', 40, [
    '出エジプト',
    '出',
    'Ex',
    'Exo',
  ]),
  book('Lev', 3, 'old', '律法', 'レビ記', 'レビ記', 'Leviticus', 27, ['レビ', 'Lv']),
  book('Num', 4, 'old', '律法', '民数記', '民数記', 'Numbers', 36, ['民数', '民', 'Nm', 'Nu']),
  book('Deut', 5, 'old', '律法', '申命記', '申命記', 'Deuteronomy', 34, ['申命', '申', 'Dt']),
  // 旧約: 歴史書
  book('Josh', 6, 'old', '歴史書', 'ヨシュア記', 'ヨシュア記', 'Joshua', 24, [
    'ヨシュア',
    'ヨシュ',
    'Jos',
  ]),
  book('Judg', 7, 'old', '歴史書', '士師記', '士師記', 'Judges', 21, ['士師', '士', 'Jdg']),
  book('Ruth', 8, 'old', '歴史書', 'ルツ記', 'ルツ記', 'Ruth', 4, ['ルツ', 'Ru']),
  book('1Sam', 9, 'old', '歴史書', 'サムエル記第一', 'Ⅰサムエル', '1 Samuel', 31, [
    'サムエル記上',
    'Ⅰサムエル',
    'Ⅰサム',
    '1Samuel',
  ]),
  book('2Sam', 10, 'old', '歴史書', 'サムエル記第二', 'Ⅱサムエル', '2 Samuel', 24, [
    'サムエル記下',
    'Ⅱサムエル',
    'Ⅱサム',
    '2Samuel',
  ]),
  book('1Kgs', 11, 'old', '歴史書', '列王記第一', 'Ⅰ列王記', '1 Kings', 22, [
    '列王記上',
    'Ⅰ列王記',
    'Ⅰ列王',
    'Ⅰ列',
    '1Kings',
  ]),
  book('2Kgs', 12, 'old', '歴史書', '列王記第二', 'Ⅱ列王記', '2 Kings', 25, [
    '列王記下',
    'Ⅱ列王記',
    'Ⅱ列王',
    'Ⅱ列',
    '2Kings',
  ]),
  book('1Chr', 13, 'old', '歴史書', '歴代誌第一', 'Ⅰ歴代誌', '1 Chronicles', 29, [
    '歴代誌上',
    'Ⅰ歴代誌',
    'Ⅰ歴代',
    'Ⅰ歴',
    '1Chronicles',
  ]),
  book('2Chr', 14, 'old', '歴史書', '歴代誌第二', 'Ⅱ歴代誌', '2 Chronicles', 36, [
    '歴代誌下',
    'Ⅱ歴代誌',
    'Ⅱ歴代',
    'Ⅱ歴',
    '2Chronicles',
  ]),
  book('Ezra', 15, 'old', '歴史書', 'エズラ記', 'エズラ記', 'Ezra', 10, ['エズラ', 'エズ', 'Ezr']),
  book('Neh', 16, 'old', '歴史書', 'ネヘミヤ記', 'ネヘミヤ記', 'Nehemiah', 13, [
    'ネヘミヤ',
    'ネヘ',
    'Ne',
  ]),
  book('Esth', 17, 'old', '歴史書', 'エステル記', 'エステル記', 'Esther', 10, [
    'エステル',
    'エス',
    'Est',
  ]),
  // 旧約: 詩歌書
  book('Job', 18, 'old', '詩歌書', 'ヨブ記', 'ヨブ記', 'Job', 42, ['ヨブ', 'Jb']),
  book('Ps', 19, 'old', '詩歌書', '詩篇', '詩篇', 'Psalms', 150, [
    '詩編',
    '詩',
    'Psalm',
    'Psa',
    'Pss',
  ]),
  book('Prov', 20, 'old', '詩歌書', '箴言', '箴言', 'Proverbs', 31, ['箴', 'Pr', 'Prv']),
  book('Eccl', 21, 'old', '詩歌書', '伝道者の書', '伝道者の書', 'Ecclesiastes', 12, [
    '伝道者',
    '伝道の書',
    'コヘレトの言葉',
    'コヘレト',
    '伝',
    'Ecc',
    'Qoheleth',
  ]),
  book('Song', 22, 'old', '詩歌書', '雅歌', '雅歌', 'Song of Songs', 8, [
    '雅',
    'Song of Solomon',
    'Cant',
    'SS',
  ]),
  // 旧約: 大預言書
  book('Isa', 23, 'old', '大預言書', 'イザヤ書', 'イザヤ書', 'Isaiah', 66, [
    'イザヤ',
    'イザ',
    'Is',
  ]),
  book('Jer', 24, 'old', '大預言書', 'エレミヤ書', 'エレミヤ書', 'Jeremiah', 52, [
    'エレミヤ',
    'エレ',
    'Je',
  ]),
  book('Lam', 25, 'old', '大預言書', '哀歌', '哀歌', 'Lamentations', 5, ['哀', 'La']),
  book('Ezek', 26, 'old', '大預言書', 'エゼキエル書', 'エゼキエル書', 'Ezekiel', 48, [
    'エゼキエル',
    'エゼ',
    'Eze',
    'Ezk',
  ]),
  book('Dan', 27, 'old', '大預言書', 'ダニエル書', 'ダニエル書', 'Daniel', 12, [
    'ダニエル',
    'ダニ',
    'Da',
    'Dn',
  ]),
  // 旧約: 小預言書
  book('Hos', 28, 'old', '小預言書', 'ホセア書', 'ホセア書', 'Hosea', 14, ['ホセア', 'ホセ', 'Ho']),
  book('Joel', 29, 'old', '小預言書', 'ヨエル書', 'ヨエル書', 'Joel', 3, ['ヨエル', 'ヨエ', 'Jl']),
  book('Amos', 30, 'old', '小預言書', 'アモス書', 'アモス書', 'Amos', 9, ['アモス', 'アモ', 'Am']),
  book('Obad', 31, 'old', '小預言書', 'オバデヤ書', 'オバデヤ書', 'Obadiah', 1, [
    'オバデヤ',
    'オバ',
    'Ob',
  ]),
  book('Jonah', 32, 'old', '小預言書', 'ヨナ書', 'ヨナ書', 'Jonah', 4, ['ヨナ', 'Jon']),
  book('Mic', 33, 'old', '小預言書', 'ミカ書', 'ミカ書', 'Micah', 7, ['ミカ', 'Mc']),
  book('Nah', 34, 'old', '小預言書', 'ナホム書', 'ナホム書', 'Nahum', 3, ['ナホム', 'ナホ', 'Na']),
  book('Hab', 35, 'old', '小預言書', 'ハバクク書', 'ハバクク書', 'Habakkuk', 3, [
    'ハバクク',
    'ハバ',
    'Hb',
  ]),
  book('Zeph', 36, 'old', '小預言書', 'ゼパニヤ書', 'ゼパニヤ書', 'Zephaniah', 3, [
    'ゼパニヤ',
    'ゼパ',
    'Zep',
    'Zph',
  ]),
  book('Hag', 37, 'old', '小預言書', 'ハガイ書', 'ハガイ書', 'Haggai', 2, ['ハガイ', 'ハガ', 'Hg']),
  book('Zech', 38, 'old', '小預言書', 'ゼカリヤ書', 'ゼカリヤ書', 'Zechariah', 14, [
    'ゼカリヤ',
    'ゼカ',
    'Zec',
    'Zch',
  ]),
  book('Mal', 39, 'old', '小預言書', 'マラキ書', 'マラキ書', 'Malachi', 4, [
    'マラキ',
    'マラ',
    'Ml',
  ]),
  // 新約: 福音書
  book('Matt', 40, 'new', '福音書', 'マタイの福音書', 'マタイ', 'Matthew', 28, [
    'マタイ',
    'マタイによる福音書',
    'マタ',
    'Mt',
  ]),
  book('Mark', 41, 'new', '福音書', 'マルコの福音書', 'マルコ', 'Mark', 16, [
    'マルコ',
    'マルコによる福音書',
    'マコ',
    'Mk',
    'Mrk',
  ]),
  book('Luke', 42, 'new', '福音書', 'ルカの福音書', 'ルカ', 'Luke', 24, [
    'ルカ',
    'ルカによる福音書',
    'Lk',
    'Luk',
  ]),
  book('John', 43, 'new', '福音書', 'ヨハネの福音書', 'ヨハネ', 'John', 21, [
    'ヨハネ',
    'ヨハネによる福音書',
    'ヨハ',
    'Jn',
    'Joh',
    'Jhn',
  ]),
  // 新約: 歴史書
  book('Acts', 44, 'new', '歴史書', '使徒の働き', '使徒', 'Acts', 28, [
    '使徒',
    '使徒言行録',
    '使徒行伝',
    '使',
    'Ac',
  ]),
  // 新約: パウロ書簡
  book('Rom', 45, 'new', 'パウロ書簡', 'ローマ人への手紙', 'ローマ', 'Romans', 16, [
    'ローマ',
    'ロマ',
    'Ro',
    'Rm',
  ]),
  book(
    '1Cor',
    46,
    'new',
    'パウロ書簡',
    'コリント人への手紙第一',
    'Ⅰコリント',
    '1 Corinthians',
    16,
    ['Ⅰコリント', 'Ⅰコリ', '1Corinthians'],
  ),
  book(
    '2Cor',
    47,
    'new',
    'パウロ書簡',
    'コリント人への手紙第二',
    'Ⅱコリント',
    '2 Corinthians',
    13,
    ['Ⅱコリント', 'Ⅱコリ', '2Corinthians'],
  ),
  book('Gal', 48, 'new', 'パウロ書簡', 'ガラテヤ人への手紙', 'ガラテヤ', 'Galatians', 6, [
    'ガラテヤ',
    'ガラ',
    'Ga',
  ]),
  book('Eph', 49, 'new', 'パウロ書簡', 'エペソ人への手紙', 'エペソ', 'Ephesians', 6, [
    'エペソ',
    'エフェソ',
    'エペ',
    'Ep',
  ]),
  book('Phil', 50, 'new', 'パウロ書簡', 'ピリピ人への手紙', 'ピリピ', 'Philippians', 4, [
    'ピリピ',
    'フィリピ',
    'ピリ',
    'Php',
    'Pp',
  ]),
  book('Col', 51, 'new', 'パウロ書簡', 'コロサイ人への手紙', 'コロサイ', 'Colossians', 4, [
    'コロサイ',
    'コロ',
    'Cl',
  ]),
  book(
    '1Thess',
    52,
    'new',
    'パウロ書簡',
    'テサロニケ人への手紙第一',
    'Ⅰテサロニケ',
    '1 Thessalonians',
    5,
    ['Ⅰテサロニケ', 'Ⅰテサ', '1Thessalonians', '1Thes', '1Th'],
  ),
  book(
    '2Thess',
    53,
    'new',
    'パウロ書簡',
    'テサロニケ人への手紙第二',
    'Ⅱテサロニケ',
    '2 Thessalonians',
    3,
    ['Ⅱテサロニケ', 'Ⅱテサ', '2Thessalonians', '2Thes', '2Th'],
  ),
  book('1Tim', 54, 'new', 'パウロ書簡', 'テモテへの手紙第一', 'Ⅰテモテ', '1 Timothy', 6, [
    'Ⅰテモテ',
    'Ⅰテモ',
    '1Timothy',
    '1Ti',
  ]),
  book('2Tim', 55, 'new', 'パウロ書簡', 'テモテへの手紙第二', 'Ⅱテモテ', '2 Timothy', 4, [
    'Ⅱテモテ',
    'Ⅱテモ',
    '2Timothy',
    '2Ti',
  ]),
  book('Titus', 56, 'new', 'パウロ書簡', 'テトスへの手紙', 'テトス', 'Titus', 3, [
    'テトス',
    'テト',
    'Tit',
    'Ti',
  ]),
  book('Phlm', 57, 'new', 'パウロ書簡', 'ピレモンへの手紙', 'ピレモン', 'Philemon', 1, [
    'ピレモン',
    'フィレモン',
    'ピレ',
    'Phm',
    'Pm',
  ]),
  // 新約: 公同書簡
  book('Heb', 58, 'new', '公同書簡', 'ヘブル人への手紙', 'ヘブル', 'Hebrews', 13, [
    'ヘブル',
    'ヘブライ人への手紙',
    'ヘブライ',
    'ヘブ',
    'He',
  ]),
  book('Jas', 59, 'new', '公同書簡', 'ヤコブの手紙', 'ヤコブ', 'James', 5, [
    'ヤコブ',
    'ヤコ',
    'Jam',
    'Jm',
  ]),
  book('1Pet', 60, 'new', '公同書簡', 'ペテロの手紙第一', 'Ⅰペテロ', '1 Peter', 5, [
    'Ⅰペテロ',
    'Ⅰペテ',
    '1Peter',
    '1Pe',
    '1Pt',
  ]),
  book('2Pet', 61, 'new', '公同書簡', 'ペテロの手紙第二', 'Ⅱペテロ', '2 Peter', 3, [
    'Ⅱペテロ',
    'Ⅱペテ',
    '2Peter',
    '2Pe',
    '2Pt',
  ]),
  book('1John', 62, 'new', '公同書簡', 'ヨハネの手紙第一', 'Ⅰヨハネ', '1 John', 5, [
    'Ⅰヨハネ',
    'Ⅰヨハ',
    '1Jn',
    '1Jo',
  ]),
  book('2John', 63, 'new', '公同書簡', 'ヨハネの手紙第二', 'Ⅱヨハネ', '2 John', 1, [
    'Ⅱヨハネ',
    'Ⅱヨハ',
    '2Jn',
    '2Jo',
  ]),
  book('3John', 64, 'new', '公同書簡', 'ヨハネの手紙第三', 'Ⅲヨハネ', '3 John', 1, [
    'Ⅲヨハネ',
    'Ⅲヨハ',
    '3Jn',
    '3Jo',
  ]),
  book('Jude', 65, 'new', '公同書簡', 'ユダの手紙', 'ユダ', 'Jude', 1, ['ユダ', 'Jud', 'Jd']),
  // 新約: 黙示文学
  book('Rev', 66, 'new', '黙示文学', 'ヨハネの黙示録', '黙示録', 'Revelation', 22, [
    '黙示録',
    'ヨハネ黙示録',
    '黙示',
    '黙',
    'Re',
    'Rv',
    'Apocalypse',
  ]),
];

const KANJI_NUM: Record<string, string> = { 一: '1', 二: '2', 三: '3' };

/**
 * 書名照合キーの正規化。
 * NFKC（全角→半角、ローマ数字Ⅰ→I など）、空白除去、小文字化のうえ、
 * 「第一◯◯」「◯◯第一」「◯◯上/下」「Ⅰ◯◯」「1◯◯」を接頭辞 digit に統一する。
 */
export function normalizeBookKey(raw: string): string {
  let s = raw
    .normalize('NFKC')
    .replace(/[\s・･]/g, '')
    .toLowerCase();
  let num = '';
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^(.+?)第([一二三123])$/))) {
    s = m[1] ?? '';
    num = KANJI_NUM[m[2] ?? ''] ?? m[2] ?? '';
  } else if ((m = s.match(/^(サムエル記?|列王記?|歴代誌?)(上|下)$/))) {
    s = m[1] ?? '';
    num = m[2] === '上' ? '1' : '2';
  } else if ((m = s.match(/^第([一二三123])(.+)$/))) {
    num = KANJI_NUM[m[1] ?? ''] ?? m[1] ?? '';
    s = m[2] ?? '';
  } else if ((m = s.match(/^([123一二三])(?=\D)(.+)$/))) {
    num = KANJI_NUM[m[1] ?? ''] ?? m[1] ?? '';
    s = m[2] ?? '';
  } else if ((m = s.match(/^(iii|ii|i)(?=[^a-z0-9])(.+)$/))) {
    num = String((m[1] ?? '').length);
    s = m[2] ?? '';
  }
  return num + s;
}

function buildAliasIndex(): Map<string, BibleBook> {
  const index = new Map<string, BibleBook>();
  for (const b of BIBLE_BOOKS) {
    const candidates = [b.nameJa, b.shortNameJa, b.nameEn, b.osis, ...b.aliases];
    for (const c of candidates) {
      const key = normalizeBookKey(c);
      if (!key) continue;
      const existing = index.get(key);
      if (existing && existing.osis !== b.osis) {
        throw new Error(`書名キーが重複しています: "${c}" → ${existing.osis} / ${b.osis}`);
      }
      index.set(key, b);
    }
  }
  return index;
}

const ALIAS_INDEX = buildAliasIndex();
const OSIS_INDEX = new Map(BIBLE_BOOKS.map((b) => [b.osis, b]));

/** 書名・略称・別名から書巻を解決する。完全一致のみ（曖昧な接頭辞一致はしない）。 */
export function resolveBook(input: string): BibleBook | null {
  const key = normalizeBookKey(input);
  if (!key) return null;
  return ALIAS_INDEX.get(key) ?? null;
}

export function getBookByOsis(osis: string): BibleBook | null {
  return OSIS_INDEX.get(osis) ?? null;
}

/** 解決できなかった入力に対する書名候補（正典順、最大 limit 件）。 */
export function suggestBooks(input: string, limit = 5): BibleBook[] {
  const key = normalizeBookKey(input);
  if (!key) return [];
  const hits = new Map<string, BibleBook>();
  for (const [aliasKey, b] of ALIAS_INDEX) {
    if (aliasKey.includes(key) || key.startsWith(aliasKey)) hits.set(b.osis, b);
  }
  return [...hits.values()].sort((a, z) => a.canonicalOrder - z.canonicalOrder).slice(0, limit);
}
