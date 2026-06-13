'use server';

import { revalidatePath } from 'next/cache';
import {
  analyzeLedgerRows,
  toImportPayloadRow,
  type ImportIssue,
  type ImportPlan,
} from '@keryx/domain';
import {
  LedgerParseError,
  parseCsvLedger,
  parseXlsxLedger,
  type ColumnMapping,
  type ParsedLedger,
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

export type ImportRowResult = {
  rowNumber: number;
  status: 'created' | 'skipped' | 'error';
  legacyId: string;
  title: string;
  messageDisplayId?: string;
  reason?: string;
};

export type ImportResult = {
  ok?: boolean;
  error?: string;
  batchId?: string;
  sourceFile?: string;
  counts?: { created: number; skipped: number; error: number };
  rows?: ImportRowResult[];
};

/** Dry Run と実取り込みを1つの useActionState で扱う統合状態 */
export type ImportPageState = { dry?: DryRunResult; imported?: ImportResult };

const MAX_FILE_BYTES = 5 * 1024 * 1024;

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** アップロードファイルを検証して台帳を解析する。失敗時は LedgerParseError */
async function parseUpload(file: unknown): Promise<{ parsed: ParsedLedger; fileName: string }> {
  if (!(file instanceof File) || file.size === 0) {
    throw new LedgerParseError('ファイルを選択してください（.xlsx または .csv）。');
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new LedgerParseError('ファイルが大きすぎます（5MBまで）。');
  }
  let parsed: ParsedLedger;
  if (/\.csv$/i.test(file.name)) {
    parsed = parseCsvLedger(await file.text());
  } else if (/\.xlsx$/i.test(file.name)) {
    parsed = await parseXlsxLedger(await file.arrayBuffer());
  } else {
    throw new LedgerParseError('対応形式は .xlsx と .csv です。');
  }
  return { parsed, fileName: file.name };
}

/** 解析計画と行ごとの fingerprint（sha256）を作る */
async function planWithFingerprints(parsed: ParsedLedger) {
  const plan = analyzeLedgerRows(parsed.rows);
  const fingerprints = new Map<number, string>();
  await Promise.all(
    plan.rows.map(async (r) => {
      fingerprints.set(r.rowNumber, await sha256Hex(r.fingerprintSource));
    }),
  );
  return { plan, fingerprints };
}

/** workspace の messages から、ファイル側キーに一致する既存 legacy_id / fingerprint を集める */
async function fetchExistingKeys(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  legacyIds: string[],
  fingerprints: string[],
) {
  const existingLegacyIds = new Set<string>();
  const existingFingerprints = new Set<string>();
  const CHUNK = 200;
  for (let i = 0; i < legacyIds.length; i += CHUNK) {
    const { data } = await supabase
      .from('messages')
      .select('metadata')
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)
      .in('metadata->>legacy_id', legacyIds.slice(i, i + CHUNK));
    for (const m of data ?? []) {
      const meta = m.metadata as { legacy_id?: string } | null;
      if (meta?.legacy_id) existingLegacyIds.add(meta.legacy_id);
    }
  }
  for (let i = 0; i < fingerprints.length; i += CHUNK) {
    const { data } = await supabase
      .from('messages')
      .select('metadata')
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)
      .in('metadata->import->>fingerprint', fingerprints.slice(i, i + CHUNK));
    for (const m of data ?? []) {
      const meta = m.metadata as { import?: { fingerprint?: string } } | null;
      if (meta?.import?.fingerprint) existingFingerprints.add(meta.import.fingerprint);
    }
  }
  return { existingLegacyIds, existingFingerprints };
}

/**
 * Spreadsheet v1.3.1 の Dry Run（KX-020）。
 * 解析・検証・重複検出だけを行い、DB の正本は一切変更しない。
 */
async function runDryRun(parsed: ParsedLedger, fileName: string): Promise<DryRunResult> {
  const { plan, fingerprints } = await planWithFingerprints(parsed);

  const workspace = await getActiveWorkspace();
  const supabase = await createClient();
  const { existingLegacyIds, existingFingerprints } = await fetchExistingKeys(
    supabase,
    workspace.id,
    [...new Set(plan.rows.map((r) => r.legacyId).filter(Boolean))],
    [...new Set(fingerprints.values())],
  );

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

  // newRows は実取り込み（RPC）の dedup と一致させる: DB 重複に加え、ファイル内の重複も畳む。
  // RPC は legacy_id を持つ行を legacy_id で、持たない行を fingerprint で 1 件に畳む（§5）。
  const seenLegacy = new Set<string>();
  const seenFingerprint = new Set<string>();
  let newRows = 0;
  for (const r of rows) {
    if (!r.importable || r.dbDuplicate) continue;
    if (r.legacyId) {
      if (seenLegacy.has(r.legacyId)) continue;
      seenLegacy.add(r.legacyId);
    } else {
      if (seenFingerprint.has(r.fingerprint)) continue;
      seenFingerprint.add(r.fingerprint);
    }
    newRows += 1;
  }

  return {
    ok: true,
    fileName,
    sheetName: parsed.sheetName,
    headerRowNumber: parsed.headerRowNumber,
    mapping: parsed.mapping,
    counts: {
      ...plan.counts,
      dbDuplicates,
      newRows,
    },
    issues: plan.issues,
    inFileDuplicates: plan.inFileDuplicates.map(({ rowNumbers }) => ({ rowNumbers })),
    rows,
  };
}

/**
 * KX-021: トランザクショナル取り込み。
 * importable な行を import_ledger_batch RPC へ渡し、1関数=1トランザクションで投入する。
 * 重複は RPC 側の権威的な冪等判定でスキップされる（再実行安全）。
 */
async function runImport(parsed: ParsedLedger, fileName: string): Promise<ImportResult> {
  const { plan, fingerprints } = await planWithFingerprints(parsed);
  const importableRows = plan.rows.filter((r) => r.importable);
  if (importableRows.length === 0) {
    return { error: '取り込める行がありません。' };
  }

  const payload = importableRows.map((r) =>
    toImportPayloadRow(r, fingerprints.get(r.rowNumber) ?? ''),
  );
  const titleByRow = new Map(importableRows.map((r) => [r.rowNumber, r.title || '（無題）']));

  const workspace = await getActiveWorkspace();
  if (workspace.role !== 'owner' && workspace.role !== 'pastor') {
    return { error: 'このワークスペースに取り込む権限がありません。' };
  }
  const supabase = await createClient();
  const batchId = crypto.randomUUID();

  const { data, error } = await supabase.rpc('import_ledger_batch', {
    p_workspace: workspace.id,
    p_source_file: fileName,
    p_batch_id: batchId,
    p_rows: payload,
  });
  if (error) {
    return { error: `取り込みに失敗しました: ${error.message}` };
  }

  const raw = (data ?? []) as {
    row_number: number;
    status: 'created' | 'skipped' | 'error';
    legacy_id?: string;
    message_display_id?: string;
    reason?: string;
  }[];
  const rows: ImportRowResult[] = raw.map((r) => ({
    rowNumber: r.row_number,
    status: r.status,
    legacyId: r.legacy_id ?? '',
    title: titleByRow.get(r.row_number) ?? '',
    ...(r.message_display_id ? { messageDisplayId: r.message_display_id } : {}),
    ...(r.reason ? { reason: r.reason } : {}),
  }));

  revalidatePath('/messages');
  revalidatePath('/calendar');
  revalidatePath('/');

  const counts = {
    created: rows.filter((r) => r.status === 'created').length,
    skipped: rows.filter((r) => r.status === 'skipped').length,
    error: rows.filter((r) => r.status === 'error').length,
  };
  // 何も作成されず全行がエラー = systemic な失敗。成功扱いにせずエラーとして見せる。
  const ok = counts.created > 0 || counts.error === 0;

  return { ok, batchId, sourceFile: fileName, counts, rows };
}

/** Dry Run（phase=dryrun）と実取り込み（phase=import）を1アクションで分岐する */
export async function submitImport(
  _prev: ImportPageState,
  formData: FormData,
): Promise<ImportPageState> {
  const phase = formData.get('phase');
  let parsed: ParsedLedger;
  let fileName: string;
  try {
    ({ parsed, fileName } = await parseUpload(formData.get('file')));
  } catch (e) {
    const message =
      e instanceof LedgerParseError
        ? e.message
        : 'ファイルを読み取れませんでした。形式を確認してください。';
    return phase === 'import' ? { imported: { error: message } } : { dry: { error: message } };
  }

  if (phase === 'import') {
    return { imported: await runImport(parsed, fileName) };
  }
  return { dry: await runDryRun(parsed, fileName) };
}

/** 取り込んだバッチを取り消す（metadata.import.batch_id でソフトデリート） */
export async function undoImportBatch(formData: FormData): Promise<void> {
  const batchId = formData.get('batchId');
  if (typeof batchId !== 'string' || !batchId) return;
  const workspace = await getActiveWorkspace();
  if (workspace.role !== 'owner' && workspace.role !== 'pastor') return;
  const supabase = await createClient();
  await supabase.rpc('undo_import_batch', { p_workspace: workspace.id, p_batch_id: batchId });
  revalidatePath('/messages');
  revalidatePath('/calendar');
  revalidatePath('/');
  revalidatePath('/settings/import');
}
