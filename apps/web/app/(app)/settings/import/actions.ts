'use server';

import { analyzeLedgerRows, type ImportIssue, type ImportPlan } from '@keryx/domain';
import {
  LedgerParseError,
  parseCsvLedger,
  parseXlsxLedger,
  type ColumnMapping,
} from '@/lib/import/parse-ledger';
import { createClient } from '@/lib/supabase/server';
import { getActiveWorkspace } from '@/lib/workspace';

export type DryRunRowSummary = {
  rowNumber: number;
  legacyId: string;
  date: string;
  title: string;
  passage: string;
  importable: boolean;
  fingerprint: string;
  dbDuplicate: 'legacy_id' | 'fingerprint' | null;
};

export type DryRunResult = {
  ok?: boolean;
  error?: string;
  fileName?: string;
  sheetName?: string;
  headerRowNumber?: number;
  mapping?: ColumnMapping;
  counts?: ImportPlan['counts'] & { dbDuplicates: number; newRows: number };
  issues?: ImportIssue[];
  inFileDuplicates?: { rowNumbers: number[] }[];
  rows?: DryRunRowSummary[];
};

const MAX_FILE_BYTES = 5 * 1024 * 1024;

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Spreadsheet v1.3.1 の Dry Run（KX-020）。
 * 解析・検証・重複検出だけを行い、DB の正本は一切変更しない。
 */
export async function dryRunImport(_prev: DryRunResult, formData: FormData): Promise<DryRunResult> {
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { error: 'ファイルを選択してください（.xlsx または .csv）。' };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { error: 'ファイルが大きすぎます（5MBまで）。' };
  }

  let parsed;
  try {
    if (/\.csv$/i.test(file.name)) {
      parsed = parseCsvLedger(await file.text());
    } else if (/\.xlsx$/i.test(file.name)) {
      parsed = await parseXlsxLedger(await file.arrayBuffer());
    } else {
      return { error: '対応形式は .xlsx と .csv です。' };
    }
  } catch (e) {
    if (e instanceof LedgerParseError) return { error: e.message };
    return { error: 'ファイルを読み取れませんでした。形式を確認してください。' };
  }

  const plan = analyzeLedgerRows(parsed.rows);

  // fingerprint（再実行用）を生成
  const fingerprints = new Map<number, string>();
  await Promise.all(
    plan.rows.map(async (r) => {
      fingerprints.set(r.rowNumber, await sha256Hex(r.fingerprintSource));
    }),
  );

  // DB 側の重複検出（legacy_id / fingerprint）。読み取りのみ。
  // 全件取得は PostgREST の max_rows(=1000) で黙って打ち切られるため、
  // ファイル側のキーで絞り込んでチャンク照会する（テーブル件数に依存しない）。
  const workspace = await getActiveWorkspace();
  const supabase = await createClient();
  const existingLegacyIds = new Set<string>();
  const existingFingerprints = new Set<string>();

  const fileLegacyIds = [...new Set(plan.rows.map((r) => r.legacyId).filter(Boolean))];
  const fileFingerprints = [...new Set(fingerprints.values())];
  const CHUNK = 200;

  for (let i = 0; i < fileLegacyIds.length; i += CHUNK) {
    const { data } = await supabase
      .from('messages')
      .select('metadata')
      .eq('workspace_id', workspace.id)
      .is('deleted_at', null)
      .in('metadata->>legacy_id', fileLegacyIds.slice(i, i + CHUNK));
    for (const m of data ?? []) {
      const meta = m.metadata as { legacy_id?: string } | null;
      if (meta?.legacy_id) existingLegacyIds.add(meta.legacy_id);
    }
  }
  for (let i = 0; i < fileFingerprints.length; i += CHUNK) {
    const { data } = await supabase
      .from('messages')
      .select('metadata')
      .eq('workspace_id', workspace.id)
      .is('deleted_at', null)
      .in('metadata->import->>fingerprint', fileFingerprints.slice(i, i + CHUNK));
    for (const m of data ?? []) {
      const meta = m.metadata as { import?: { fingerprint?: string } } | null;
      if (meta?.import?.fingerprint) existingFingerprints.add(meta.import.fingerprint);
    }
  }

  const rows: DryRunRowSummary[] = plan.rows.map((r) => {
    const fingerprint = fingerprints.get(r.rowNumber) ?? '';
    const dbDuplicate =
      r.legacyId && existingLegacyIds.has(r.legacyId)
        ? ('legacy_id' as const)
        : existingFingerprints.has(fingerprint)
          ? ('fingerprint' as const)
          : null;
    return {
      rowNumber: r.rowNumber,
      legacyId: r.legacyId,
      date: r.startsAtLocal,
      title: r.title || '（無題）',
      passage: r.passage?.displayText ?? '',
      importable: r.importable,
      fingerprint,
      dbDuplicate,
    };
  });

  const dbDuplicates = rows.filter((r) => r.dbDuplicate).length;
  return {
    ok: true,
    fileName: file.name,
    sheetName: parsed.sheetName,
    headerRowNumber: parsed.headerRowNumber,
    mapping: parsed.mapping,
    counts: {
      ...plan.counts,
      dbDuplicates,
      newRows: rows.filter((r) => r.importable && !r.dbDuplicate).length,
    },
    issues: plan.issues,
    inFileDuplicates: plan.inFileDuplicates.map(({ rowNumbers }) => ({ rowNumbers })),
    rows,
  };
}
