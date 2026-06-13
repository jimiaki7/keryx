'use client';

import { useActionState } from 'react';
import { dryRunImport, type DryRunResult } from './actions';

const initialState: DryRunResult = {};

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

export function ImportAnalyzer() {
  const [state, formAction, pending] = useActionState(dryRunImport, initialState);

  return (
    <div className="flex flex-col gap-5">
      <form
        action={formAction}
        className="flex flex-wrap items-end gap-3 rounded-lg border border-line bg-paper-raised p-4"
      >
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <label htmlFor="import-file" className="text-xs font-medium text-ink-muted">
            台帳ファイル（.xlsx / .csv）
          </label>
          <input
            id="import-file"
            name="file"
            type="file"
            accept=".xlsx,.csv"
            required
            className="rounded-md border border-line bg-paper px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-indigo-deep/10 file:px-3 file:py-1 file:text-indigo-deep"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-indigo-deep px-4 py-2 text-sm font-medium text-paper-raised hover:bg-indigo-soft disabled:opacity-50"
        >
          {pending ? '解析中…' : '解析する（Dry Run）'}
        </button>
        <p className="w-full text-xs text-ink-muted">
          解析はデータを一切変更しません。結果を確認してから取り込み（次のステップ）に進みます。
        </p>
      </form>

      {state.error ? (
        <div role="alert" className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-800">
          {state.error}
        </div>
      ) : null}

      {state.ok && state.counts && state.mapping ? (
        <>
          <section
            aria-label="解析サマリー"
            className="rounded-lg border border-line bg-paper-raised p-4"
          >
            <h2 className="text-sm font-medium text-ink">
              解析結果: {state.fileName}（{state.sheetName} / ヘッダー行 {state.headerRowNumber}）
            </h2>
            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
              {COUNT_LABELS.map(([key, label]) => (
                <div key={key} className="flex justify-between gap-2 border-b border-line/60 py-1">
                  <dt className="text-ink-muted">{label}</dt>
                  <dd
                    className={
                      key === 'dbDuplicates' && (state.counts?.[key] ?? 0) > 0
                        ? 'font-medium text-gold'
                        : 'font-medium text-ink'
                    }
                  >
                    {state.counts?.[key]}
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
              {state.mapping.matched.map((m, i) => (
                <li
                  key={`${m.key}-${i}`}
                  className={m.ignored ? 'text-ink-muted line-through' : 'text-ink'}
                >
                  {m.header}
                  {m.ignored ? '（再導出のため無視）' : ''}
                </li>
              ))}
            </ul>
            {state.mapping.missing.length > 0 ? (
              <p className="mt-2 text-xs text-red-800">
                見つからない列: {state.mapping.missing.join('、')}
              </p>
            ) : null}
            {state.mapping.duplicates.length > 0 ? (
              <p className="mt-1 text-xs text-gold">
                重複した列（最初の列のみ採用）: {state.mapping.duplicates.join('、')}
              </p>
            ) : null}
            {state.mapping.extra.length > 0 ? (
              <p className="mt-1 text-xs text-ink-muted">
                対応のない列（無視）: {state.mapping.extra.join('、')}
              </p>
            ) : null}
          </section>

          {(state.issues?.length ?? 0) > 0 ? (
            <section
              aria-label="エラーと警告"
              className="rounded-lg border border-line bg-paper-raised p-4"
            >
              <h2 className="text-sm font-medium text-ink">エラーと警告</h2>
              <ul className="mt-2 flex flex-col gap-1 text-sm">
                {state.issues!.map((issue, i) => (
                  <li key={i} className={issue.severity === 'error' ? 'text-red-800' : 'text-gold'}>
                    行{issue.rowNumber}（{issue.severity === 'error' ? 'エラー' : '警告'}）:{' '}
                    {issue.message}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {(state.inFileDuplicates?.length ?? 0) > 0 ? (
            <section
              aria-label="ファイル内の重複"
              className="rounded-lg border border-gold/40 bg-paper-raised p-4"
            >
              <h2 className="text-sm font-medium text-ink">ファイル内の重複候補</h2>
              <ul className="mt-2 text-sm text-gold">
                {state.inFileDuplicates!.map((d, i) => (
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
                {state.rows?.map((r) => (
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
            <p className="mt-2 text-xs text-ink-muted">
              各行には再実行用の指紋（fingerprint）が生成されており、取り込みを繰り返しても同じ行が
              二重に登録されない仕組みです。実際の取り込みは次のステップ（KX-021）で提供されます。
            </p>
          </section>
        </>
      ) : null}
    </div>
  );
}
