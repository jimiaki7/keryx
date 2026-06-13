'use client';

import { startTransition, useActionState, useState } from 'react';
import {
  submitImport,
  undoImportBatch,
  type DryRunResult,
  type ImportPageState,
  type ImportResult,
} from './actions';

const initialState: ImportPageState = {};

const COUNT_LABELS: [keyof NonNullable<DryRunResult['counts']>, string][] = [
  ['rowsTotal', '読み取った行'],
  ['rowsImportable', 'インポート可能な行'],
  ['newRows', 'うち新規（重複を除く）'],
  ['messages', 'メッセージ'],
  ['gatherings', '礼拝予定'],
  ['deliveries', '実施記録（Delivery）'],
  ['passages', '聖書箇所'],
  ['serviceElements', '礼拝要素'],
  ['series', 'シリーズ'],
  ['venues', '会場'],
  ['dbDuplicates', '既存データとの重複'],
];

function DryRunReview({ dry }: { dry: DryRunResult }) {
  if (!dry.counts || !dry.mapping) return null;
  return (
    <>
      <section
        aria-label="解析サマリー"
        className="rounded-lg border border-line bg-paper-raised p-4"
      >
        <h2 className="text-sm font-medium text-ink">
          解析結果: {dry.fileName}（{dry.sheetName} / ヘッダー行 {dry.headerRowNumber}）
        </h2>
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
          {COUNT_LABELS.map(([key, label]) => (
            <div key={key} className="flex justify-between gap-2 border-b border-line/60 py-1">
              <dt className="text-ink-muted">{label}</dt>
              <dd
                className={
                  key === 'dbDuplicates' && (dry.counts?.[key] ?? 0) > 0
                    ? 'font-medium text-gold'
                    : 'font-medium text-ink'
                }
              >
                {dry.counts?.[key]}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section
        aria-label="列マッピング"
        className="rounded-lg border border-line bg-paper-raised p-4"
      >
        <h2 className="text-sm font-medium text-ink">列マッピング</h2>
        <ul className="mt-2 grid grid-cols-2 gap-x-6 gap-y-0.5 text-xs sm:grid-cols-3">
          {dry.mapping.matched.map((m, i) => (
            <li
              key={`${m.key}-${i}`}
              className={m.ignored ? 'text-ink-muted line-through' : 'text-ink'}
            >
              {m.header}
              {m.ignored ? '（再導出のため無視）' : ''}
            </li>
          ))}
        </ul>
        {dry.mapping.missing.length > 0 ? (
          <p className="mt-2 text-xs text-red-800">
            見つからない列: {dry.mapping.missing.join('、')}
          </p>
        ) : null}
        {dry.mapping.duplicates.length > 0 ? (
          <p className="mt-1 text-xs text-gold">
            重複した列（最初の列のみ採用）: {dry.mapping.duplicates.join('、')}
          </p>
        ) : null}
        {dry.mapping.extra.length > 0 ? (
          <p className="mt-1 text-xs text-ink-muted">
            対応のない列（無視）: {dry.mapping.extra.join('、')}
          </p>
        ) : null}
      </section>

      {(dry.issues?.length ?? 0) > 0 ? (
        <section
          aria-label="エラーと警告"
          className="rounded-lg border border-line bg-paper-raised p-4"
        >
          <h2 className="text-sm font-medium text-ink">エラーと警告</h2>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {dry.issues!.map((issue, i) => (
              <li key={i} className={issue.severity === 'error' ? 'text-red-800' : 'text-gold'}>
                行{issue.rowNumber}（{issue.severity === 'error' ? 'エラー' : '警告'}）:{' '}
                {issue.message}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {(dry.inFileDuplicates?.length ?? 0) > 0 ? (
        <section
          aria-label="ファイル内の重複"
          className="rounded-lg border border-gold/40 bg-paper-raised p-4"
        >
          <h2 className="text-sm font-medium text-ink">ファイル内の重複候補</h2>
          <ul className="mt-2 text-sm text-gold">
            {dry.inFileDuplicates!.map((d, i) => (
              <li key={i}>行 {d.rowNumbers.join(' と ')} が同じ内容です。</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section
        aria-label="行の内訳"
        className="overflow-x-auto rounded-lg border border-line bg-paper-raised p-4"
      >
        <h2 className="text-sm font-medium text-ink">行の内訳</h2>
        <table className="mt-2 w-full min-w-[560px] text-left text-xs">
          <thead>
            <tr className="border-b border-line text-ink-muted">
              <th className="py-1 pr-3 font-medium">行</th>
              <th className="py-1 pr-3 font-medium">旧ID</th>
              <th className="py-1 pr-3 font-medium">日時</th>
              <th className="py-1 pr-3 font-medium">説教題</th>
              <th className="py-1 pr-3 font-medium">聖書箇所</th>
              <th className="py-1 font-medium">判定</th>
            </tr>
          </thead>
          <tbody>
            {dry.rows?.map((r) => (
              <tr key={r.rowNumber} className="border-b border-line/60">
                <td className="py-1 pr-3 text-ink-muted">{r.rowNumber}</td>
                <td className="py-1 pr-3">{r.legacyId}</td>
                <td className="py-1 pr-3">{r.date.replace('T', ' ')}</td>
                <td className="max-w-48 truncate py-1 pr-3">{r.title}</td>
                <td className="py-1 pr-3">{r.passage}</td>
                <td className="py-1">
                  {!r.importable ? (
                    <span className="text-red-800">エラー</span>
                  ) : r.dbDuplicate ? (
                    <span className="text-gold">
                      重複（{r.dbDuplicate === 'legacy_id' ? '旧ID' : '内容'}）
                    </span>
                  ) : (
                    <span className="text-indigo-deep">新規</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}

function ImportReport({ imported }: { imported: ImportResult }) {
  if (!imported.counts) return null;
  const failed = imported.counts.created === 0 && imported.counts.error > 0;
  return (
    <>
      <section
        aria-label="取り込み結果"
        className={`rounded-lg border bg-paper-raised p-4 ${failed ? 'border-red-300' : 'border-line'}`}
      >
        <h2 className={`text-sm font-medium ${failed ? 'text-red-800' : 'text-ink'}`}>
          {failed
            ? `取り込めませんでした（${imported.sourceFile}）`
            : `取り込みが完了しました（${imported.sourceFile}）`}
        </h2>
        <dl className="mt-3 grid grid-cols-3 gap-x-6 text-sm">
          <div className="flex flex-col gap-0.5">
            <dt className="text-ink-muted">新規作成</dt>
            <dd className="text-lg font-medium text-indigo-deep">{imported.counts.created}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-ink-muted">スキップ（重複）</dt>
            <dd className="text-lg font-medium text-gold">{imported.counts.skipped}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-ink-muted">エラー</dt>
            <dd
              className={`text-lg font-medium ${imported.counts.error > 0 ? 'text-red-800' : 'text-ink'}`}
            >
              {imported.counts.error}
            </dd>
          </div>
        </dl>
        <form action={undoImportBatch} className="mt-4">
          <input type="hidden" name="batchId" value={imported.batchId} />
          <button
            type="submit"
            className="rounded-md border border-line px-3 py-1.5 text-sm text-ink-muted hover:bg-paper hover:text-ink"
          >
            このバッチを取り消す（ソフトデリート）
          </button>
        </form>
      </section>

      <section
        aria-label="取り込みの内訳"
        className="overflow-x-auto rounded-lg border border-line bg-paper-raised p-4"
      >
        <h2 className="text-sm font-medium text-ink">行ごとの結果</h2>
        <table className="mt-2 w-full min-w-[480px] text-left text-xs">
          <thead>
            <tr className="border-b border-line text-ink-muted">
              <th className="py-1 pr-3 font-medium">行</th>
              <th className="py-1 pr-3 font-medium">旧ID</th>
              <th className="py-1 pr-3 font-medium">説教題</th>
              <th className="py-1 pr-3 font-medium">新ID</th>
              <th className="py-1 font-medium">結果</th>
            </tr>
          </thead>
          <tbody>
            {imported.rows?.map((r) => (
              <tr key={r.rowNumber} className="border-b border-line/60">
                <td className="py-1 pr-3 text-ink-muted">{r.rowNumber}</td>
                <td className="py-1 pr-3">{r.legacyId}</td>
                <td className="max-w-48 truncate py-1 pr-3">{r.title}</td>
                <td className="py-1 pr-3">{r.messageDisplayId ?? ''}</td>
                <td className="py-1">
                  {r.status === 'created' ? (
                    <span className="text-indigo-deep">作成</span>
                  ) : r.status === 'skipped' ? (
                    <span className="text-gold">スキップ（{r.reason ?? '重複'}）</span>
                  ) : (
                    <span className="text-red-800">エラー（{r.reason ?? '不明'}）</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}

export function ImportAnalyzer() {
  const [state, dispatch, pending] = useActionState(submitImport, initialState);
  // ファイルは state で保持する（React 19 はフォーム送信後に file input をリセットするため、
  // Dry Run 後に「取り込む」で同じファイルを再送できるよう、入力欄に依存しない）
  const [file, setFile] = useState<File | null>(null);
  const dry = state.dry;
  const imported = state.imported;
  const canImport = !!dry?.ok && (dry.counts?.newRows ?? 0) > 0;

  const run = (phase: 'dryrun' | 'import') => {
    if (!file) return;
    const fd = new FormData();
    fd.set('file', file);
    fd.set('phase', phase);
    startTransition(() => dispatch(fd));
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-line bg-paper-raised p-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <label htmlFor="import-file" className="text-xs font-medium text-ink-muted">
            台帳ファイル（.xlsx / .csv）
          </label>
          <input
            id="import-file"
            name="file"
            type="file"
            accept=".xlsx,.csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="rounded-md border border-line bg-paper px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-indigo-deep/10 file:px-3 file:py-1 file:text-indigo-deep"
          />
        </div>
        <button
          type="button"
          onClick={() => run('dryrun')}
          disabled={pending || !file}
          className="rounded-md bg-indigo-deep px-4 py-2 text-sm font-medium text-paper-raised hover:bg-indigo-soft disabled:opacity-50"
        >
          {pending ? '処理中…' : '解析する（Dry Run）'}
        </button>
        {canImport ? (
          <button
            type="button"
            onClick={() => run('import')}
            disabled={pending || !file}
            className="rounded-md bg-gold px-4 py-2 text-sm font-medium text-ink hover:opacity-90 disabled:opacity-50"
          >
            {pending ? '処理中…' : `取り込む（${dry?.counts?.newRows ?? 0}件）`}
          </button>
        ) : null}
        <p className="w-full text-xs text-ink-muted">
          解析（Dry
          Run）はデータを一切変更しません。内容を確認してから「取り込む」で実際に登録します。
          取り込みは再実行しても重複しません（同じ行はスキップされます）。
        </p>
      </div>

      {dry?.error || imported?.error ? (
        <div role="alert" className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-800">
          {dry?.error ?? imported?.error}
        </div>
      ) : null}

      {imported?.counts ? (
        <ImportReport imported={imported} />
      ) : dry?.ok ? (
        <DryRunReview dry={dry} />
      ) : null}
    </div>
  );
}
