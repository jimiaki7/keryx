export type Testament = 'old' | 'new';

export type BookGenre =
  | '律法'
  | '歴史書'
  | '詩歌書'
  | '大預言書'
  | '小預言書'
  | '福音書'
  | 'パウロ書簡'
  | '公同書簡'
  | '黙示文学';

export type BibleBook = {
  /** OSIS 標準 ID（正規参照キー） */
  osis: string;
  /** 1〜66 の正典順 */
  canonicalOrder: number;
  testament: Testament;
  genre: BookGenre;
  /** 新改訳2017 の書名 */
  nameJa: string;
  /** 表示用の短い書名（例: ヨハネ、Ⅰコリント） */
  shortNameJa: string;
  nameEn: string;
  /** 表記揺れの別名。正規化のうえ照合される */
  aliases: readonly string[];
  chapterCount: number;
};

export type PassageRange = {
  /** bible_books.osis を参照 */
  bookId: string;
  startChapter: number;
  startVerse?: number;
  endChapter: number;
  endVerse?: number;
  /** 正規化された表示文字列（例: ヨハネ3:16-21） */
  displayText: string;
};

export type ParseErrorCode =
  | 'empty_input'
  | 'invalid_format'
  | 'unknown_book'
  | 'invalid_chapter'
  | 'invalid_verse'
  | 'reversed_range';

export type ParseError = {
  code: ParseErrorCode;
  /** ユーザーに表示できる日本語の説明 */
  message: string;
  /** 書名の修正候補（unknown_book 時） */
  suggestions?: readonly string[];
};

export type ParseResult = { ok: true; value: PassageRange } | { ok: false; error: ParseError };
