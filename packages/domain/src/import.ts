// Spreadsheet v1.3.1 インポート解析（KX-020 Dry Run）のドメインロジック。
// 変換規則の正本は docs/product/KX-019_SPREADSHEET_IMPORT_MAPPING.md。
// DB・ファイルIOに依存しない純粋関数（fingerprint のハッシュ化は呼び出し側で行う）。

import { parsePassage, type PassageRange } from '@keryx/scripture';

export const LEDGER_SHEET_NAME = '説教・奨励台帳';

/** 台帳31列の定義（header は v1.3.1 のヘッダー行と完全一致させる） */
export const LEDGER_COLUMNS = [
  { key: 'legacy_id', header: 'ID（自動）', ignored: false },
  { key: 'date', header: '日付', ignored: false },
  { key: 'weekday', header: '曜日', ignored: true },
  { key: 'kind', header: '集会種別', ignored: false },
  { key: 'observance', header: '教会暦・行事', ignored: false },
  { key: 'series_name', header: 'シリーズ名', ignored: false },
  { key: 'series_number', header: 'シリーズ回', ignored: false },
  { key: 'book', header: '書巻', ignored: false },
  { key: 'chapter_verse', header: '章節', ignored: false },
  { key: 'passage_display', header: '聖書箇所', ignored: true },
  { key: 'testament', header: '区分', ignored: true },
  { key: 'genre', header: 'ジャンル', ignored: true },
  { key: 'title', header: '説教題', ignored: false },
  { key: 'central_message', header: '中心メッセージ', ignored: false },
  { key: 'theme', header: '主題', ignored: false },
  { key: 'tags', header: 'タグ', ignored: false },
  { key: 'venue', header: 'Venue', ignored: false },
  { key: 'speaker', header: '説教者', ignored: false },
  { key: 'call_to_worship', header: '招詞', ignored: false },
  { key: 'opening_hymn', header: '開会賛美', ignored: false },
  { key: 'responsive_reading', header: '聖書交読', ignored: false },
  { key: 'response_hymn', header: '応答賛美', ignored: false },
  { key: 'ceremony', header: '式典', ignored: false },
  { key: 'ceremony_hymn', header: '式典賛美', ignored: false },
  { key: 'doxology', header: '頌栄', ignored: false },
  { key: 'stage', header: '準備段階', ignored: false },
  { key: 'progress', header: '進捗%', ignored: true },
  { key: 'next_action', header: '次の作業', ignored: false },
  { key: 'due', header: '期限', ignored: false },
  { key: 'manuscript_link', header: '原稿リンク', ignored: false },
  { key: 'memo', header: 'メモ', ignored: false },
] as const;

export type LedgerColumnKey = (typeof LEDGER_COLUMNS)[number]['key'];

export type RawLedgerRow = {
  /** 台帳シート上の物理行番号 */
  rowNumber: number;
  cells: Partial<Record<LedgerColumnKey, string>>;
};

export type ImportIssue = {
  rowNumber: number;
  severity: 'error' | 'warning';
  column?: string;
  message: string;
};

export type PlannedElement = { type: string; title: string; ceremonyType?: string };

export type AnalyzedRow = {
  rowNumber: number;
  legacyId: string;
  /** sha256 の入力文字列（ハッシュ化は呼び出し側） */
  fingerprintSource: string;
  /** error のある行は false（インポート対象外） */
  importable: boolean;
  title: string;
  centralMessage: string;
  messageType: string;
  messageStatus: string;
  preparationStage: string;
  gatheringKind: string;
  gatheringTitle: string;
  /** YYYY-MM-DDTHH:mm（Asia/Tokyo）。error 行では '' */
  startsAtLocal: string;
  passage: PassageRange | null;
  seriesName: string;
  seriesNumber: number | null;
  venue: string;
  speaker: string;
  elements: PlannedElement[];
  legacy: {
    observance: string;
    theme: string;
    tags: string[];
    nextAction: string;
    dueOn: string;
    manuscriptRef: string;
  };
  memo: string;
  migrationNotes: { column: string; value: string; reason: string }[];
};

export type ImportPlan = {
  rows: AnalyzedRow[];
  issues: ImportIssue[];
  counts: {
    rowsTotal: number;
    rowsImportable: number;
    messages: number;
    gatherings: number;
    deliveries: number;
    passages: number;
    serviceElements: number;
    series: number;
    venues: number;
  };
  inFileDuplicates: { fingerprintSource: string; rowNumbers: number[] }[];
};

// §4.1 集会種別 → type / kind / gathering.title
const KIND_MAP: Record<string, { type: string; kind: string; gatheringTitle: string }> = {
  主日礼拝: { type: 'sermon', kind: 'sunday_worship', gatheringTitle: '' },
  祈祷会奨励: { type: 'prayer_meeting_exhortation', kind: 'prayer_meeting', gatheringTitle: '' },
  伝道礼拝: { type: 'sermon', kind: 'special_service', gatheringTitle: '伝道礼拝' },
  特別礼拝: { type: 'sermon', kind: 'special_service', gatheringTitle: '' },
  '葬儀・記念礼拝': { type: 'sermon', kind: 'special_service', gatheringTitle: '葬儀・記念礼拝' },
  結婚式: { type: 'sermon', kind: 'special_service', gatheringTitle: '結婚式' },
  修養会: { type: 'sermon', kind: 'other', gatheringTitle: '修養会' },
  その他: { type: 'other', kind: 'other', gatheringTitle: '' },
};

// §4.2 kind 既定の開始時刻
const DEFAULT_TIME: Record<string, string> = {
  sunday_worship: '10:30',
  prayer_meeting: '19:30',
};

// §4.5 準備段階（旧8値）→ preparation_stage / status
const STAGE_MAP: Record<string, { stage: string; status: string }> = {
  未着手: { stage: 'not_started', status: 'planned' },
  本文確定: { stage: 'exegesis', status: 'preparing' },
  釈義中: { stage: 'exegesis', status: 'preparing' },
  骨子作成: { stage: 'outline', status: 'preparing' },
  原稿執筆: { stage: 'manuscript', status: 'preparing' },
  推敲: { stage: 'manuscript', status: 'preparing' },
  礼拝準備完了: { stage: 'completed', status: 'ready' },
  説教済み: { stage: 'completed', status: 'completed' },
};

// §4.4 式典 → ceremony_type
const CEREMONY_MAP: Record<string, string> = {
  聖餐式: 'communion',
  洗礼式: 'baptism',
  転入会式: 'transfer',
  召天者記念: 'memorial',
  子ども祝福式: 'other',
  その他: 'other',
};

function cell(row: RawLedgerRow, key: LedgerColumnKey): string {
  return (row.cells[key] ?? '').trim();
}

/** 信頼できない台帳の値を素のオブジェクトリテラルへ引くときの安全なルックアップ
 *  （'constructor' / '__proto__' 等での Object.prototype 継承プロパティ誤マッチを防ぐ） */
function lookup<T>(map: Record<string, T>, key: string): T | undefined {
  return Object.hasOwn(map, key) ? map[key] : undefined;
}

/** '2026-01-04 00:00:00' / '2026/1/4' / ISO などを YYYY-MM-DD に正規化。失敗時 null */
export function normalizeDate(value: string): string | null {
  // 末尾アンカー付き（区切りは空白 / T / 時刻）で「2026-01-045」等の誤受理を防ぐ
  const m = value.trim().match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s].*)?$/);
  if (!m) return null;
  const [, y, mo, d] = m;
  const year = Number(y);
  const month = Number(mo);
  const day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  // 実在する暦日かを検証（2026-02-30 などのロールオーバーを拒否）
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (dt.getUTCFullYear() !== year || dt.getUTCMonth() !== month - 1 || dt.getUTCDate() !== day) {
    return null;
  }
  return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function isEmptyRow(row: RawLedgerRow): boolean {
  return Object.values(row.cells).every((v) => !v || !v.trim());
}

/** 台帳行を Dry Run 計画へ解析する（DB は一切触らない） */
export function analyzeLedgerRows(rawRows: RawLedgerRow[]): ImportPlan {
  const issues: ImportIssue[] = [];
  const rows: AnalyzedRow[] = [];

  for (const raw of rawRows) {
    if (isEmptyRow(raw)) continue;
    const n = raw.rowNumber;
    const notes: AnalyzedRow['migrationNotes'] = [];

    // 日付（必須）
    const dateRaw = cell(raw, 'date');
    const date = dateRaw ? normalizeDate(dateRaw) : null;
    let importable = true;
    if (!date) {
      issues.push({
        rowNumber: n,
        severity: 'error',
        column: '日付',
        message: dateRaw
          ? `日付「${dateRaw}」を解釈できません。この行はインポートされません。`
          : '日付が空です。この行はインポートされません。',
      });
      importable = false;
    }

    // 集会種別
    const kindRaw = cell(raw, 'kind');
    let kindMapped = lookup(KIND_MAP, kindRaw);
    if (!kindMapped) {
      kindMapped = { type: 'other', kind: 'other', gatheringTitle: kindRaw };
      if (kindRaw) {
        issues.push({
          rowNumber: n,
          severity: 'warning',
          column: '集会種別',
          message: `集会種別「${kindRaw}」はリスト外のため「その他」として取り込みます（名称は予定タイトルに保持）。`,
        });
      } else {
        issues.push({
          rowNumber: n,
          severity: 'warning',
          column: '集会種別',
          message: '集会種別が空のため「その他」として取り込みます。',
        });
      }
    }

    // タイトル
    const title = cell(raw, 'title');
    if (!title && importable) {
      issues.push({
        rowNumber: n,
        severity: 'warning',
        column: '説教題',
        message: '説教題が空です（無題のメッセージとして取り込みます）。',
      });
    }

    // 聖書箇所
    const book = cell(raw, 'book');
    const cv = cell(raw, 'chapter_verse');
    let passage: PassageRange | null = null;
    if (book) {
      const result = parsePassage(`${book} ${cv}`.trim());
      if (result.ok) {
        passage = result.value;
      } else {
        notes.push({
          column: '書巻/章節',
          value: `${book} ${cv}`.trim(),
          reason: result.error.message,
        });
        issues.push({
          rowNumber: n,
          severity: 'warning',
          column: '章節',
          message: `聖書箇所「${book} ${cv}」を解析できません（原文をメモに保存して取り込みます）。`,
        });
      }
    } else if (cv) {
      // 書巻が空で章節だけある行：値を破棄せず migration_notes に残す（§6）
      notes.push({ column: '書巻/章節', value: cv, reason: '書巻が空' });
      issues.push({
        rowNumber: n,
        severity: 'warning',
        column: '章節',
        message: `章節「${cv}」が入力されていますが書巻が空です（原文をメモに保存して取り込みます）。`,
      });
    }

    // 準備段階
    const stageRaw = cell(raw, 'stage');
    let stageMapped = lookup(STAGE_MAP, stageRaw);
    if (!stageMapped) {
      stageMapped = { stage: 'not_started', status: 'planned' };
      if (stageRaw) {
        issues.push({
          rowNumber: n,
          severity: 'warning',
          column: '準備段階',
          message: `準備段階「${stageRaw}」はリスト外のため「未着手」として取り込みます。`,
        });
      }
    }

    // 礼拝要素（§4.4 の順序）
    const elements: PlannedElement[] = [];
    const push = (type: string, value: string, ceremonyType?: string) => {
      const el: PlannedElement = { type, title: value };
      if (ceremonyType) el.ceremonyType = ceremonyType;
      elements.push(el);
    };
    if (cell(raw, 'call_to_worship')) push('call_to_worship', cell(raw, 'call_to_worship'));
    if (cell(raw, 'opening_hymn')) push('hymn', cell(raw, 'opening_hymn'));
    if (cell(raw, 'responsive_reading'))
      push('responsive_reading', cell(raw, 'responsive_reading'));
    if (passage) push('scripture_reading', passage.displayText);
    push('message', '');
    if (cell(raw, 'response_hymn')) push('hymn', cell(raw, 'response_hymn'));
    const ceremonyRaw = cell(raw, 'ceremony');
    const hasCeremony = ceremonyRaw && ceremonyRaw !== 'なし';
    if (hasCeremony) {
      const ceremonyMapped = lookup(CEREMONY_MAP, ceremonyRaw);
      const ceremonyType = ceremonyMapped ?? 'other';
      if (!ceremonyMapped) {
        issues.push({
          rowNumber: n,
          severity: 'warning',
          column: '式典',
          message: `式典「${ceremonyRaw}」はリスト外のため「その他」として取り込みます（名称は保持）。`,
        });
      }
      // 子ども祝福式・リスト外は名称を title に保持する
      push(
        'ceremony',
        ceremonyType === 'other' || ceremonyRaw === '子ども祝福式' ? ceremonyRaw : '',
        ceremonyType,
      );
    }
    if (cell(raw, 'ceremony_hymn')) {
      if (!hasCeremony) {
        issues.push({
          rowNumber: n,
          severity: 'warning',
          column: '式典賛美',
          message:
            '式典が「なし」ですが式典賛美が入力されています（通常の賛美として末尾に配置します）。',
        });
        // 変則配置の痕跡を永続化する（§6 破棄しない・痕跡を残す）
        notes.push({
          column: '式典賛美',
          value: cell(raw, 'ceremony_hymn'),
          reason: '式典なしのため通常の賛美として配置',
        });
      }
      push('hymn', cell(raw, 'ceremony_hymn'));
    }
    if (cell(raw, 'doxology')) push('doxology', cell(raw, 'doxology'));

    // シリーズ回
    const seriesNumberRaw = cell(raw, 'series_number');
    let seriesNumber: number | null = null;
    if (seriesNumberRaw) {
      const parsed = Number(seriesNumberRaw);
      if (Number.isFinite(parsed) && parsed > 0) {
        seriesNumber = parsed;
      } else {
        notes.push({
          column: 'シリーズ回',
          value: seriesNumberRaw,
          reason: '数値として解釈できない',
        });
      }
    }

    const startTime = DEFAULT_TIME[kindMapped.kind] ?? '10:30';
    const fingerprintSource = [date ?? dateRaw, kindRaw, book, cv, title].join('|');

    rows.push({
      rowNumber: n,
      legacyId: cell(raw, 'legacy_id'),
      fingerprintSource,
      importable,
      title,
      centralMessage: cell(raw, 'central_message'),
      messageType: kindMapped.type,
      messageStatus: stageMapped.status,
      preparationStage: stageMapped.stage,
      gatheringKind: kindMapped.kind,
      gatheringTitle: kindMapped.gatheringTitle,
      startsAtLocal: date ? `${date}T${startTime}` : '',
      passage,
      seriesName: cell(raw, 'series_name'),
      seriesNumber,
      venue: cell(raw, 'venue'),
      speaker: cell(raw, 'speaker'),
      elements,
      legacy: {
        observance: cell(raw, 'observance'),
        theme: cell(raw, 'theme'),
        tags: cell(raw, 'tags')
          .split(/[,、]/)
          .map((t) => t.trim())
          .filter(Boolean),
        nextAction: cell(raw, 'next_action'),
        dueOn: normalizeDate(cell(raw, 'due')) ?? '',
        manuscriptRef: cell(raw, 'manuscript_link'),
      },
      memo: cell(raw, 'memo'),
      migrationNotes: notes,
    });
  }

  // ファイル内重複（fingerprint 一致）
  const byFingerprint = new Map<string, number[]>();
  for (const r of rows) {
    if (!r.importable) continue;
    const list = byFingerprint.get(r.fingerprintSource) ?? [];
    list.push(r.rowNumber);
    byFingerprint.set(r.fingerprintSource, list);
  }
  const inFileDuplicates = [...byFingerprint.entries()]
    .filter(([, nums]) => nums.length > 1)
    .map(([fingerprintSource, rowNumbers]) => ({ fingerprintSource, rowNumbers }));

  const importable = rows.filter((r) => r.importable);
  const counts: ImportPlan['counts'] = {
    rowsTotal: rows.length,
    rowsImportable: importable.length,
    messages: importable.length,
    gatherings: importable.length,
    deliveries: importable.length,
    passages: importable.filter((r) => r.passage).length,
    serviceElements: importable.reduce((sum, r) => sum + r.elements.length, 0),
    series: new Set(importable.map((r) => r.seriesName).filter(Boolean)).size,
    venues: new Set(importable.map((r) => r.venue).filter(Boolean)).size,
  };

  return { rows, issues, counts, inFileDuplicates };
}

// ---------------------------------------------------------------------------
// KX-021: 実取り込み（import_ledger_batch RPC）への行ペイロード。
// DB 関数が消費する JSON 形状を 1 か所で定義し、Dry Run と実取り込みのズレを防ぐ。
// ---------------------------------------------------------------------------

export type ImportPayloadRow = {
  row_number: number;
  fingerprint: string;
  legacy_id: string;
  type: string;
  status: string;
  preparation_stage: string;
  title: string;
  central_message: string;
  notes: string;
  kind: string;
  gathering_title: string;
  /** +09:00 付きの完全な ISO（例 2026-01-04T10:30:00+09:00） */
  starts_at: string;
  speaker: string;
  venue: string;
  series_name: string;
  series_number: number | null;
  passage: {
    book_id: string;
    start_chapter: number;
    start_verse: number | null;
    end_chapter: number;
    end_verse: number | null;
    display_text: string;
  } | null;
  elements: { type: string; title: string; ceremony_type?: string }[];
  legacy: {
    observance: string;
    theme: string;
    tags: string[];
    next_action: string;
    due_on: string;
    manuscript_ref: string;
  };
  migration_notes: { column: string; value: string; reason: string }[];
};

/** 解析済みの 1 行を import_ledger_batch のペイロードへ変換する（importable 行のみ渡す） */
export function toImportPayloadRow(row: AnalyzedRow, fingerprint: string): ImportPayloadRow {
  return {
    row_number: row.rowNumber,
    fingerprint,
    legacy_id: row.legacyId,
    type: row.messageType,
    status: row.messageStatus,
    preparation_stage: row.preparationStage,
    title: row.title,
    central_message: row.centralMessage,
    notes: row.memo,
    kind: row.gatheringKind,
    gathering_title: row.gatheringTitle,
    starts_at: `${row.startsAtLocal}:00+09:00`,
    speaker: row.speaker,
    venue: row.venue,
    series_name: row.seriesName,
    series_number: row.seriesNumber,
    passage: row.passage
      ? {
          book_id: row.passage.bookId,
          start_chapter: row.passage.startChapter,
          start_verse: row.passage.startVerse ?? null,
          end_chapter: row.passage.endChapter,
          end_verse: row.passage.endVerse ?? null,
          display_text: row.passage.displayText,
        }
      : null,
    elements: row.elements.map((e) => ({
      type: e.type,
      title: e.title,
      ...(e.ceremonyType ? { ceremony_type: e.ceremonyType } : {}),
    })),
    legacy: {
      observance: row.legacy.observance,
      theme: row.legacy.theme,
      tags: row.legacy.tags,
      next_action: row.legacy.nextAction,
      due_on: row.legacy.dueOn,
      manuscript_ref: row.legacy.manuscriptRef,
    },
    migration_notes: row.migrationNotes,
  };
}
