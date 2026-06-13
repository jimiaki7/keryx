import { getBookByOsis, resolveBook, suggestBooks } from './books';
import type { BibleBook, ParseError, ParseResult, PassageRange } from './types';

// 範囲記号: ハイフン各種・波ダッシュ・全角マイナス(U+2212。NFKC でも分解されないので明示)
const DASH = '[-‐–—~〜−]';

// 「ヨハネ3:16」「ヨハ 3:16-21」「John 3:16-4:2」「詩篇 23」「マタイ5-7」
const COLON_REF = new RegExp(
  `^(.*?)\\s*(\\d{1,3})(?:\\s*:\\s*(\\d{1,3}))?(?:\\s*${DASH}\\s*(\\d{1,3})(?:\\s*:\\s*(\\d{1,3}))?)?$`,
);
// 「ヨハネの福音書 3章16〜21節」「ヨハネ3章16節〜4章2節」「詩篇23章」
const JA_REF = new RegExp(
  `^(.*?)\\s*(\\d{1,3})\\s*章(?:\\s*(\\d{1,3})\\s*節?)?(?:\\s*${DASH}\\s*(?:(\\d{1,3})\\s*章)?\\s*(\\d{1,3})\\s*節?)?$`,
);
// 「マタイ5章〜7章」「マタイ5〜7章」
const JA_CHAPTER_RANGE = new RegExp(`^(.*?)\\s*(\\d{1,3})\\s*章?\\s*${DASH}\\s*(\\d{1,3})\\s*章$`);

type RawRef = {
  bookPart: string;
  startChapter: number;
  startVerse?: number;
  endChapter?: number;
  endVerse?: number;
};

function fail(error: ParseError): ParseResult {
  return { ok: false, error };
}

function toInt(s: string | undefined): number | undefined {
  return s == null ? undefined : Number.parseInt(s, 10);
}

function matchRef(text: string): RawRef | ParseError {
  if (/[章節]/.test(text)) {
    const chRange = text.match(JA_CHAPTER_RANGE);
    if (chRange) {
      return {
        bookPart: chRange[1] ?? '',
        startChapter: Number(chRange[2]),
        endChapter: Number(chRange[3]),
      };
    }
    const m = text.match(JA_REF);
    if (!m) {
      return {
        code: 'invalid_format',
        message: '聖書箇所の形式を解釈できません。例: ヨハネ3章16節〜21節',
      };
    }
    const startVerse = toInt(m[3]);
    const endChapterRaw = toInt(m[4]);
    const endVerse = toInt(m[5]);
    if (endVerse != null && endChapterRaw == null && startVerse == null) {
      return {
        code: 'invalid_format',
        message: '範囲の開始節がありません。例: ヨハネ3章16節〜21節',
      };
    }
    return {
      bookPart: m[1] ?? '',
      startChapter: Number(m[2]),
      ...(startVerse != null ? { startVerse } : {}),
      ...(endChapterRaw != null ? { endChapter: endChapterRaw } : {}),
      ...(endVerse != null ? { endVerse } : {}),
    };
  }
  const m = text.match(COLON_REF);
  if (!m) {
    return {
      code: 'invalid_format',
      message: '聖書箇所の形式を解釈できません。例: ヨハネ3:16-21',
    };
  }
  const startVerse = toInt(m[3]);
  const rangeFirst = toInt(m[4]);
  const rangeSecond = toInt(m[5]);
  const raw: RawRef = {
    bookPart: m[1] ?? '',
    startChapter: Number(m[2]),
    ...(startVerse != null ? { startVerse } : {}),
  };
  if (rangeFirst != null) {
    if (rangeSecond != null) {
      // 3:16-4:2
      raw.endChapter = rangeFirst;
      raw.endVerse = rangeSecond;
    } else if (startVerse != null) {
      // 3:16-21 → 同じ章の節範囲
      raw.endVerse = rangeFirst;
    } else {
      // 5-7 → 章範囲
      raw.endChapter = rangeFirst;
    }
  }
  return raw;
}

function validateAndBuild(book: BibleBook, raw: RawRef): ParseResult {
  let { startChapter, startVerse, endChapter, endVerse } = raw;

  // 1章のみの書巻（ユダ、ピレモンなど）: 「ユダ6」は1章6節と解釈する
  if (book.chapterCount === 1 && startChapter > 1 && startVerse == null) {
    startVerse = startChapter;
    if (endChapter != null && endVerse == null) {
      endVerse = endChapter;
    }
    startChapter = 1;
    endChapter = 1;
  }

  const ec = endChapter ?? startChapter;
  const ev = endVerse;

  for (const ch of [startChapter, ec]) {
    if (ch < 1 || ch > book.chapterCount) {
      return fail({
        code: 'invalid_chapter',
        message: `${book.nameJa}は全${book.chapterCount}章です。${ch}章は存在しません。`,
      });
    }
  }
  for (const v of [startVerse, ev]) {
    if (v != null && v < 1) {
      return fail({ code: 'invalid_verse', message: `${v}節は存在しません。節は1以上です。` });
    }
  }
  if (ec < startChapter) {
    return fail({
      code: 'reversed_range',
      message: `範囲が逆転しています（${startChapter}章 → ${ec}章）。`,
    });
  }
  if (ec === startChapter && startVerse != null && ev != null && ev < startVerse) {
    return fail({
      code: 'reversed_range',
      message: `範囲が逆転しています（${startVerse}節 → ${ev}節）。`,
    });
  }
  // 終端のみ節指定（例: 3-4:2 の形以外で endVerse があるのに startVerse がない）は
  // matchRef 側で弾くか、章をまたぐ範囲として両方の章節が揃っている場合のみ許す
  if (ev != null && startVerse == null && ec === startChapter) {
    return fail({
      code: 'invalid_format',
      message: '範囲の開始節がありません。例: ヨハネ3:16-21',
    });
  }

  const value: PassageRange = {
    bookId: book.osis,
    startChapter,
    ...(startVerse != null ? { startVerse } : {}),
    endChapter: ec,
    ...(ev != null ? { endVerse: ev } : {}),
    displayText: '',
  };
  value.displayText = formatPassage(value);
  return { ok: true, value };
}

/**
 * 聖書箇所文字列を構造化された PassageRange に解析する。
 * DB・UIに依存しない純粋関数。解析不能な入力は補完せず、説明付きで拒否する。
 * 注: 節番号の上限（章ごとの節数）検証は未対応（バックログ: 節数マスタ追加後に対応）。
 */
export function parsePassage(input: string): ParseResult {
  // 実データの表記ゆれを正規化する（Gate A で観測）:
  // - NFKC で全角→半角（全角数字・コロン・チルダ等）
  // - 括弧内の注記（例「（参照：ローマ8:35-39）」）を除去
  // - 「篇」を章として扱う（詩篇の章表記。書名「詩篇」の篇は数字直後でないので不変）
  // - 「番」は「節」の誤記として扱う
  const text = input
    .normalize('NFKC')
    .replace(/[（(][^（()）]*[）)]/g, '')
    .replace(/[：]/g, ':')
    .replace(/(\d)\s*篇/g, '$1章')
    .replace(/(\d)\s*番/g, '$1節')
    .trim();
  if (!text) {
    return fail({ code: 'empty_input', message: '聖書箇所を入力してください。' });
  }
  const raw = matchRef(text);
  if ('code' in raw) return fail(raw);
  const bookPart = raw.bookPart.trim();
  if (!bookPart) {
    return fail({
      code: 'invalid_format',
      message: '書名が見つかりません。例: ヨハネ3:16',
    });
  }
  const book = resolveBook(bookPart);
  if (!book) {
    const suggestions = suggestBooks(bookPart).map((b) => b.nameJa);
    return fail({
      code: 'unknown_book',
      message: `書名「${bookPart}」を特定できません。`,
      ...(suggestions.length > 0 ? { suggestions } : {}),
    });
  }
  return validateAndBuild(book, raw);
}

/** PassageRange を正規化された日本語表示文字列にする（例: ヨハネ3:16-21）。 */
export function formatPassage(range: PassageRange): string {
  const book = getBookByOsis(range.bookId);
  if (!book) throw new Error(`未知の書巻ID: ${range.bookId}`);
  let s = `${book.shortNameJa}${range.startChapter}`;
  if (range.startVerse != null) s += `:${range.startVerse}`;
  if (range.endChapter !== range.startChapter) {
    s += `-${range.endChapter}`;
    if (range.endVerse != null) s += `:${range.endVerse}`;
  } else if (range.endVerse != null && range.endVerse !== range.startVerse) {
    s += `-${range.endVerse}`;
  }
  return s;
}
