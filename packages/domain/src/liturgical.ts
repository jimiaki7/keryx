// KX-024: 教会暦（Observance）プリセットの日付計算。DB・UI に依存しない純粋関数。
// JECA（福音派）で扱う範囲を既定とする: 元旦・受難週・イースター・ペンテコステ・
// 召天者記念・アドベント・クリスマス。復活祭は computus で計算し、他は派生・固定。

export type LiturgicalObservance = {
  /** 年内で一意な再適用キー（例 'easter-2026'）。冪等な取り込みに使う */
  presetKey: string;
  kind: string;
  name: string;
  /** YYYY-MM-DD（Asia/Tokyo の暦日。時刻は持たない） */
  startsOn: string;
  /** YYYY-MM-DD。単日は startsOn と同じ */
  endsOn: string;
  color: string;
};

const COLORS: Record<string, string> = {
  new_year: '#1e3a8a',
  holy_week: '#6d28d9',
  easter: '#b45309',
  pentecost: '#b91c1c',
  memorial: '#475569',
  advent: '#6d28d9',
  christmas: '#b45309',
};

function ymd(year: number, month1: number, day: number): string {
  return `${year}-${String(month1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** UTC 基準で日付を足し引きして YYYY-MM-DD を返す（時刻なしの暦日演算） */
function addDays(iso: string, delta: number): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  const t = Date.UTC(y, m - 1, d) + delta * 86400000;
  const dt = new Date(t);
  return ymd(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

function weekday(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=日
}

/** グレゴリオ暦の復活祭（Anonymous/Meeus 算法）。month は 3=3月,4=4月 */
export function gregorianEaster(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const mm = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * mm + 114) / 31);
  const day = ((h + l - 7 * mm + 114) % 31) + 1;
  return { month, day };
}

/** ある年の n 月の第一日曜（1=日曜が来る最初の日） */
function firstSundayOf(year: number, month1: number): string {
  const first = ymd(year, month1, 1);
  const wd = weekday(first);
  return addDays(first, (7 - wd) % 7);
}

/** 指定年の福音派 Observance プリセット一覧を返す */
export function liturgicalObservances(year: number): LiturgicalObservance[] {
  const e = gregorianEaster(year);
  const easter = ymd(year, e.month, e.day);
  const palmSunday = addDays(easter, -7); // 棕櫚の主日（受難週の始まり）
  const holySaturday = addDays(easter, -1);
  const pentecost = addDays(easter, 49); // 聖霊降臨日（復活後7週）

  // アドベント第1主日 = クリスマス前の第4日曜。12/24 以前で最後の日曜から3週前。
  const dec24 = ymd(year, 12, 24);
  const advent4 = addDays(dec24, -weekday(dec24)); // 12/24 以前で直近の日曜
  const advent1 = addDays(advent4, -21);

  const o = (
    presetKey: string,
    kind: string,
    name: string,
    startsOn: string,
    endsOn: string,
  ): LiturgicalObservance => ({
    presetKey: `${presetKey}-${year}`,
    kind,
    name,
    startsOn,
    endsOn,
    color: COLORS[kind] ?? '#475569',
  });

  return [
    o('new-year', 'new_year', '元旦', ymd(year, 1, 1), ymd(year, 1, 1)),
    o('holy-week', 'holy_week', '受難週', palmSunday, holySaturday),
    o('easter', 'easter', 'イースター（復活祭）', easter, easter),
    o('pentecost', 'pentecost', 'ペンテコステ（聖霊降臨日）', pentecost, pentecost),
    o('memorial', 'memorial', '召天者記念', firstSundayOf(year, 11), firstSundayOf(year, 11)),
    o('advent', 'advent', 'アドベント（待降節）', advent1, dec24),
    o('christmas', 'christmas', 'クリスマス', ymd(year, 12, 25), ymd(year, 12, 25)),
  ];
}
