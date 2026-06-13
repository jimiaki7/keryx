import 'server-only';
import { strFromU8, Unzip, UnzipInflate } from 'fflate';
import {
  LEDGER_COLUMNS,
  LEDGER_SHEET_NAME,
  type LedgerColumnKey,
  type RawLedgerRow,
} from '@keryx/domain';

export type ColumnMapping = {
  /** 検出できた列（ヘッダー → 取り込み先） */
  matched: { header: string; key: LedgerColumnKey; ignored: boolean }[];
  /** 期待したが見つからなかったヘッダー */
  missing: string[];
  /** ファイル側にあるが対応のないヘッダー（無視される） */
  extra: string[];
  /** 同名ヘッダーが複数あり、2列目以降を無視した列（黙って上書きしないため） */
  duplicates: string[];
};

export type ParsedLedger = {
  sheetName: string;
  headerRowNumber: number;
  mapping: ColumnMapping;
  rows: RawLedgerRow[];
};

export class LedgerParseError extends Error {}

// --- リソース上限（信頼できない入力に対する DoS 防御） -------------------------
/** 1エントリの展開後サイズ上限 */
const ENTRY_BUDGET = 32 * 1024 * 1024;
/** 全エントリ合計の展開後サイズ上限 */
const TOTAL_BUDGET = 64 * 1024 * 1024;
/** 解析する最大行数（巨大 r 属性・大量行による枯渇を防ぐ） */
const MAX_ROWS = 50_000;
/** 1行あたりの最大列インデックス（巨大セル参照による疎配列肥大を防ぐ） */
const MAX_COLS = 1024;

function normalizeHeader(value: string): string {
  return value.replace(/\s/g, '').trim();
}

const HEADER_TO_KEY = new Map(LEDGER_COLUMNS.map((c) => [normalizeHeader(c.header), c] as const));

/** Excel のシリアル値（1900系）を YYYY-MM-DD に変換する（整数部=日、小数部=時刻なので floor） */
function excelSerialToDate(serial: number): string {
  const ms = Math.floor(serial) * 86400000;
  const d = new Date(Date.UTC(1899, 11, 30) + ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 日付列のセル値がシリアル数値なら日付文字列へ（文字列日付はそのまま） */
function coerceDateCell(value: string): string {
  if (/^\d{4,6}(\.\d+)?$/.test(value)) {
    const serial = Number(value);
    if (serial > 20000 && serial < 80000) return excelSerialToDate(serial);
  }
  return value;
}

const DATE_KEYS = new Set<LedgerColumnKey>(['date', 'due']);

type GridRow = { rowNumber: number; cells: string[] };

/** ヘッダー行（'ID（自動）' と '日付' を含む行）を探し、列マッピングと行データを作る */
function buildLedger(sheetName: string, gridRows: GridRow[]): ParsedLedger {
  let headerPos = -1;
  for (let i = 0; i < Math.min(gridRows.length, 10); i += 1) {
    const normalized = (gridRows[i]?.cells ?? []).map(normalizeHeader);
    if (normalized.includes('ID（自動）') && normalized.includes('日付')) {
      headerPos = i;
      break;
    }
  }
  if (headerPos < 0) {
    throw new LedgerParseError(
      'ヘッダー行が見つかりません。「説教・奨励台帳」シート（ID（自動）・日付 などの列）を含むファイルか確認してください。',
    );
  }

  const headerRow = gridRows[headerPos]!;
  const headers = headerRow.cells;
  const keyByIndex = new Map<number, LedgerColumnKey>();
  const matched: ColumnMapping['matched'] = [];
  const extra: string[] = [];
  const duplicates: string[] = [];
  const found = new Set<LedgerColumnKey>();
  headers.forEach((h, i) => {
    const header = (h ?? '').trim();
    if (!header) return;
    const col = HEADER_TO_KEY.get(normalizeHeader(header));
    if (!col) {
      extra.push(header);
      return;
    }
    if (found.has(col.key)) {
      // 同名ヘッダーの2列目以降は採用しない（左の列の値を黙って上書きさせない）
      duplicates.push(header);
      return;
    }
    keyByIndex.set(i, col.key);
    found.add(col.key);
    matched.push({ header, key: col.key, ignored: col.ignored });
  });
  const missing = LEDGER_COLUMNS.filter((c) => !found.has(c.key) && !c.ignored).map(
    (c) => c.header,
  );

  const rows: RawLedgerRow[] = [];
  for (let i = headerPos + 1; i < gridRows.length; i += 1) {
    const gr = gridRows[i]!;
    const cells: RawLedgerRow['cells'] = {};
    gr.cells.forEach((value, colIndex) => {
      const key = keyByIndex.get(colIndex);
      if (!key || !value) return;
      cells[key] = DATE_KEYS.has(key) ? coerceDateCell(value) : value;
    });
    rows.push({ rowNumber: gr.rowNumber, cells });
  }

  return {
    sheetName,
    headerRowNumber: headerRow.rowNumber,
    mapping: { matched, missing, extra, duplicates },
    rows,
  };
}

// ---------------------------------------------------------------------------
// 最小 XLSX リーダー（fflate ストリーミング解凍 + 線形タグスキャン）。
// exceljs は名前空間プレフィックス付き（<x:workbook>）のブックを読めない。さらに
// 自前実装は信頼できない入力を受けるため、(1) 展開後サイズに予算を設けて zip bomb を
// 防ぎ、(2) 正規表現の全文走査をやめ線形スキャンにして ReDoS / 疎配列肥大を防ぐ。
// ---------------------------------------------------------------------------

function unescapeXml(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&amp;', '&');
}

/** 小さなタグ本文から <t> を連結（リッチテキスト対応）。本文は1セル分なので全文走査でも安全 */
function textContent(xmlFragment: string): string {
  const parts = [...xmlFragment.matchAll(/<(?:\w+:)?t(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?t>/g)];
  if (parts.length === 0) return '';
  return unescapeXml(parts.map((m) => m[1] ?? '').join(''));
}

/** 小さなセル本文から <v> の中身を取り出す */
function valueText(body: string): string {
  const m = body.match(/<(?:\w+:)?v(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?v>/);
  return m ? (m[1] ?? '') : '';
}

function colLettersToIndex(letters: string): number {
  let index = 0;
  for (const ch of letters) {
    const code = ch.charCodeAt(0);
    if (code < 65 || code > 90) break;
    index = index * 26 + (code - 64);
  }
  return index - 1;
}

function attr(attrs: string, name: string): string | null {
  const m = attrs.match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`));
  return m ? (m[1] ?? null) : null;
}

type Tag = {
  name: string;
  attrs: string;
  closing: boolean;
  selfClosing: boolean;
  tagStart: number;
  contentStart: number;
};

/** 次のタグを線形に読む（indexOf ベース。バックトラッキングしないので ReDoS 不能） */
function readTag(xml: string, from: number): { tag: Tag | null; next: number } | null {
  const lt = xml.indexOf('<', from);
  if (lt < 0) return null;
  if (xml.startsWith('<!--', lt)) {
    const end = xml.indexOf('-->', lt + 4);
    return { tag: null, next: end < 0 ? xml.length : end + 3 };
  }
  const gt = xml.indexOf('>', lt);
  if (gt < 0) return null;
  let inner = xml.slice(lt + 1, gt);
  const closing = inner[0] === '/';
  if (closing) inner = inner.slice(1);
  let selfClosing = false;
  if (inner.endsWith('/')) {
    selfClosing = true;
    inner = inner.slice(0, -1);
  }
  let sp = 0;
  while (sp < inner.length) {
    const c = inner.charCodeAt(sp);
    if (c === 32 || c === 9 || c === 10 || c === 13) break;
    sp += 1;
  }
  let name = inner.slice(0, sp);
  const colon = name.indexOf(':');
  if (colon >= 0) name = name.slice(colon + 1);
  return {
    tag: { name, attrs: inner.slice(sp), closing, selfClosing, tagStart: lt, contentStart: gt + 1 },
    next: gt + 1,
  };
}

/** name の閉じタグまでの本文を返す（セル本文は小さいため線形で安全） */
function sliceUntilClose(xml: string, name: string, from: number): { body: string; next: number } {
  let p = from;
  for (;;) {
    const r = readTag(xml, p);
    if (!r) return { body: xml.slice(from), next: xml.length };
    if (r.tag && r.tag.closing && r.tag.name === name) {
      return { body: xml.slice(from, r.tag.tagStart), next: r.next };
    }
    p = r.next;
  }
}

function decodeCellValue(body: string, type: string, shared: string[]): string {
  if (type === 's') {
    const idx = Number(valueText(body));
    return shared[idx] ?? '';
  }
  if (type === 'inlineStr') return textContent(body);
  if (type === 'str') return unescapeXml(valueText(body));
  const v = unescapeXml(valueText(body));
  if (type === 'b') return v === '1' ? 'TRUE' : 'FALSE';
  return v;
}

/** シート XML を線形スキャンして物理行番号付きのグリッドを得る */
function extractGrid(sheetXml: string, shared: string[]): GridRow[] {
  const grid: GridRow[] = [];
  let cur: GridRow | null = null;
  let nextCol = 0;
  let rowCount = 0;
  let pos = 0;

  const flush = () => {
    if (cur) {
      grid.push(cur);
      cur = null;
    }
  };

  while (pos < sheetXml.length) {
    const r = readTag(sheetXml, pos);
    if (!r) break;
    pos = r.next;
    const tag = r.tag;
    if (!tag) continue;

    if (tag.name === 'row') {
      if (tag.closing) {
        flush();
      } else {
        flush(); // 直前の行が未閉じでも区切る
        rowCount += 1;
        if (rowCount > MAX_ROWS) {
          throw new LedgerParseError(`行数が多すぎます（上限 ${MAX_ROWS} 行）。`);
        }
        const rNum = Number(attr(tag.attrs, 'r'));
        cur = { rowNumber: Number.isFinite(rNum) && rNum > 0 ? rNum : rowCount, cells: [] };
        nextCol = 0;
        if (tag.selfClosing) flush();
      }
    } else if (tag.name === 'c' && !tag.closing) {
      const ref = attr(tag.attrs, 'r');
      const type = attr(tag.attrs, 't') ?? 'n';
      const colIndex = ref ? colLettersToIndex(ref) : nextCol;
      nextCol = colIndex + 1;
      let value = '';
      if (!tag.selfClosing) {
        const sliced = sliceUntilClose(sheetXml, 'c', tag.contentStart);
        pos = sliced.next;
        value = decodeCellValue(sliced.body, type, shared);
      }
      if (cur && value && colIndex >= 0 && colIndex < MAX_COLS) {
        cur.cells[colIndex] = value.trim();
      }
    }
  }
  flush();
  return grid;
}

/** 必要なエントリだけを展開後サイズ予算つきで解凍する（zip bomb 防御） */
function unzipWanted(data: Uint8Array, wanted: Set<string>): Record<string, Uint8Array> {
  const out: Record<string, Uint8Array> = {};
  let total = 0;
  let aborted: Error | null = null;

  const uz = new Unzip();
  uz.register(UnzipInflate);
  uz.onfile = (file) => {
    if (aborted || !wanted.has(file.name)) return;
    const chunks: Uint8Array[] = [];
    let size = 0;
    file.ondata = (err, chunk, final) => {
      if (aborted) return;
      if (err) {
        aborted = new LedgerParseError('ファイルの解凍に失敗しました。');
        return;
      }
      size += chunk.length;
      total += chunk.length;
      if (size > ENTRY_BUDGET || total > TOTAL_BUDGET) {
        aborted = new LedgerParseError(
          '展開後のサイズが大きすぎます（インポートを中止しました）。',
        );
        return;
      }
      chunks.push(chunk);
      if (final) {
        const merged = new Uint8Array(size);
        let off = 0;
        for (const c of chunks) {
          merged.set(c, off);
          off += c.length;
        }
        out[file.name] = merged;
      }
    };
    file.start();
  };

  // 圧縮データを小さく分割して push し、展開出力を逐次受け取って早期に打ち切る
  const CHUNK = 16 * 1024;
  try {
    for (let i = 0; i < data.length; i += CHUNK) {
      if (aborted) break;
      const end = Math.min(i + CHUNK, data.length);
      uz.push(data.subarray(i, end), end >= data.length);
    }
  } catch {
    if (aborted) throw aborted;
    throw new LedgerParseError('xlsx ファイルとして読み取れませんでした。');
  }
  if (aborted) throw aborted;
  return out;
}

export async function parseXlsxLedger(buffer: ArrayBuffer): Promise<ParsedLedger> {
  const data = new Uint8Array(buffer);

  // Pass 1: ブック構造（小さい）だけ展開してシートのパスを決める
  const meta = unzipWanted(data, new Set(['xl/workbook.xml', 'xl/_rels/workbook.xml.rels']));
  const workbookXml = meta['xl/workbook.xml'] ? strFromU8(meta['xl/workbook.xml']!) : null;
  const relsXml = meta['xl/_rels/workbook.xml.rels']
    ? strFromU8(meta['xl/_rels/workbook.xml.rels']!)
    : null;
  if (!workbookXml || !relsXml) {
    throw new LedgerParseError('ブックの構造を読み取れませんでした。');
  }

  const sheets = [...workbookXml.matchAll(/<(?:\w+:)?sheet\s+[^>]*?\/?>/g)].map((m) => {
    const tag = m[0];
    return {
      name: unescapeXml(tag.match(/name="([^"]*)"/)?.[1] ?? ''),
      rid: tag.match(/r:id="([^"]*)"/)?.[1] ?? '',
    };
  });
  const target = sheets.find((s) => s.name === LEDGER_SHEET_NAME) ?? sheets[0];
  if (!target) throw new LedgerParseError('シートが見つかりません。');

  const rel = [...relsXml.matchAll(/<Relationship\s+[^>]*?\/?>/g)]
    .map((m) => ({
      id: m[0].match(/Id="([^"]*)"/)?.[1] ?? '',
      path: m[0].match(/Target="([^"]*)"/)?.[1] ?? '',
    }))
    .find((r) => r.id === target.rid);
  if (!rel) throw new LedgerParseError('シートの参照を解決できませんでした。');
  const sheetPath = rel.path.startsWith('/') ? rel.path.slice(1) : `xl/${rel.path}`;

  // Pass 2: 対象シートと共有文字列だけを予算つきで展開する
  const parts = unzipWanted(data, new Set([sheetPath, 'xl/sharedStrings.xml']));
  const sheetData = parts[sheetPath];
  if (!sheetData) throw new LedgerParseError('シートの内容を読み取れませんでした。');
  const sheetXml = strFromU8(sheetData);

  const sharedData = parts['xl/sharedStrings.xml'];
  const sharedXml = sharedData ? strFromU8(sharedData) : '';
  const shared = [...sharedXml.matchAll(/<(?:\w+:)?si(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?si>/g)].map(
    (m) => textContent(m[1] ?? ''),
  );

  return buildLedger(target.name, extractGrid(sheetXml, shared));
}

/** RFC 4180 準拠の最小CSVパーサ（BOM・引用符・改行入りセル対応） */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i += 1;
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export function parseCsvLedger(text: string): ParsedLedger {
  const gridRows: GridRow[] = parseCsv(text).map((r, i) => ({
    rowNumber: i + 1,
    cells: r.map((c) => (c ?? '').trim()),
  }));
  return buildLedger('CSV', gridRows);
}
