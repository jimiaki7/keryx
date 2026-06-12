// 月間カレンダー（KX-017）のドメインロジック。
// サーバーの実行タイムゾーンに依存せず、常に Asia/Tokyo の壁時計で日付を扱う。

export type CalendarDay = {
  /** YYYY-MM-DD（Asia/Tokyo の日付） */
  date: string;
  /** 表示中の月に属する日か（前後月の埋め草は false） */
  inMonth: boolean;
};

const TOKYO_DATE = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' });
const YEAR_MONTH = /^(\d{4})-(\d{2})$/;

/** timestamptz の ISO 文字列を Asia/Tokyo の日付（YYYY-MM-DD）にする */
export function tokyoDateOf(iso: string): string {
  return TOKYO_DATE.format(new Date(iso));
}

/** Date を Asia/Tokyo の YYYY-MM（月キー）にする */
export function tokyoYearMonthOf(date: Date): string {
  return TOKYO_DATE.format(date).slice(0, 7);
}

function parseYearMonth(yearMonth: string): { year: number; month: number } | null {
  const m = yearMonth.match(YEAR_MONTH);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12 || year < 1970 || year > 9999) return null;
  return { year, month };
}

/** YYYY-MM が有効な月キーか */
export function isValidYearMonth(yearMonth: string): boolean {
  return parseYearMonth(yearMonth) !== null;
}

/** 月キーに delta ヶ月を加算する（例: '2026-01' -1 → '2025-12'） */
export function addMonths(yearMonth: string, delta: number): string {
  const parsed = parseYearMonth(yearMonth);
  if (!parsed) throw new Error(`invalid yearMonth: ${yearMonth}`);
  const index = parsed.year * 12 + (parsed.month - 1) + delta;
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;
}

/** 表示用の和暦なし日本語月（例: 2026年6月） */
export function formatMonthJa(yearMonth: string): string {
  const parsed = parseYearMonth(yearMonth);
  if (!parsed) return yearMonth;
  return `${parsed.year}年${parsed.month}月`;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * 月間グリッド（日曜始まりの週配列）を返す。
 * 計算はすべて UTC のカレンダー演算で行い、実行環境のタイムゾーンに影響されない。
 */
export function monthGrid(yearMonth: string): CalendarDay[][] {
  const parsed = parseYearMonth(yearMonth);
  if (!parsed) throw new Error(`invalid yearMonth: ${yearMonth}`);
  const { year, month } = parsed;

  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay(); // 0 = 日曜
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
  const gridStart = Date.UTC(year, month - 1, 1 - firstWeekday);

  const weeks: CalendarDay[][] = [];
  for (let cell = 0; cell < totalCells; cell += 1) {
    const d = new Date(gridStart + cell * 86400000);
    const date = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
    const inMonth = d.getUTCFullYear() === year && d.getUTCMonth() === month - 1;
    if (cell % 7 === 0) weeks.push([]);
    weeks[weeks.length - 1]!.push({ date, inMonth });
  }
  return weeks;
}

/** グリッド全体（前後月の埋め草を含む）の開始日と終了日（両端を含む） */
export function gridRange(yearMonth: string): { start: string; end: string } {
  const weeks = monthGrid(yearMonth);
  return {
    start: weeks[0]![0]!.date,
    end: weeks[weeks.length - 1]![6]!.date,
  };
}
