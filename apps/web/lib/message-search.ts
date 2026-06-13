// KX-022: メッセージ検索のパラメータ。URL searchParams と保存フィルター（jsonb）で共有する。

export const SEARCH_KEYS = [
  'q',
  'type',
  'status',
  'series',
  'venue',
  'speaker',
  'from',
  'to',
] as const;

export type SearchKey = (typeof SEARCH_KEYS)[number];
export type MessageSearchParams = Partial<Record<SearchKey, string>>;

/** 1ページあたりの件数（search_messages の上限 100 以内） */
export const PAGE_SIZE = 50;

/** ページ番号（1 以上）。不正値は 1 にフォールバック */
export function parsePage(raw: Record<string, string | string[] | undefined>): number {
  const v = raw.page;
  const s = Array.isArray(v) ? v[0] : v;
  const n = Number(s);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

const MESSAGE_TYPES = ['sermon', 'prayer_meeting_exhortation', 'devotional', 'lecture', 'other'];
const MESSAGE_STATUSES = ['planned', 'preparing', 'ready', 'completed', 'archived'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 生の searchParams を検証・正規化する（不正値は捨てる） */
export function parseSearchParams(
  raw: Record<string, string | string[] | undefined>,
): MessageSearchParams {
  const get = (k: string): string => {
    const v = raw[k];
    return (Array.isArray(v) ? v[0] : v)?.trim() ?? '';
  };
  const out: MessageSearchParams = {};
  const q = get('q').slice(0, 200);
  if (q) out.q = q;
  const type = get('type');
  if (MESSAGE_TYPES.includes(type)) out.type = type;
  const status = get('status');
  if (MESSAGE_STATUSES.includes(status)) out.status = status;
  const series = get('series');
  if (UUID_RE.test(series)) out.series = series;
  const venue = get('venue').slice(0, 100);
  if (venue) out.venue = venue;
  const speaker = get('speaker').slice(0, 100);
  if (speaker) out.speaker = speaker;
  const from = get('from');
  if (DATE_RE.test(from)) out.from = from;
  const to = get('to');
  if (DATE_RE.test(to)) out.to = to;
  return out;
}

/** RPC search_messages の引数へ変換する（空は null） */
export function toRpcArgs(p: MessageSearchParams) {
  // 値のあるキーだけを含める（省略した引数は関数側の default null = フィルター無しになる）
  return {
    ...(p.q ? { p_text: p.q } : {}),
    ...(p.series ? { p_series: p.series } : {}),
    ...(p.venue ? { p_venue: p.venue } : {}),
    ...(p.speaker ? { p_speaker: p.speaker } : {}),
    ...(p.status ? { p_status: p.status } : {}),
    ...(p.type ? { p_type: p.type } : {}),
    ...(p.from ? { p_date_from: p.from } : {}),
    ...(p.to ? { p_date_to: p.to } : {}),
  };
}

/** 保存フィルター適用リンク等のためのクエリ文字列（先頭に ? は付けない） */
export function toQueryString(p: MessageSearchParams): string {
  const sp = new URLSearchParams();
  for (const k of SEARCH_KEYS) {
    const v = p[k];
    if (v) sp.set(k, v);
  }
  return sp.toString();
}

export function hasAnyFilter(p: MessageSearchParams): boolean {
  return SEARCH_KEYS.some((k) => p[k]);
}
