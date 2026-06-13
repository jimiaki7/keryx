import { describe, expect, it } from 'vitest';
import {
  analyzeLedgerRows,
  normalizeDate,
  toImportPayloadRow,
  type RawLedgerRow,
} from '../src/import';

function row(cells: RawLedgerRow['cells'], rowNumber = 6): RawLedgerRow {
  return { rowNumber, cells };
}

const BASE = {
  legacy_id: 'S-20260104-01',
  date: '2026-01-04 00:00:00',
  kind: '主日礼拝',
  book: '創世記',
  chapter_verse: '1:1-5',
  title: '初めに神が',
  stage: '説教済み',
};

describe('normalizeDate', () => {
  it('各種日付表記を YYYY-MM-DD に正規化する', () => {
    expect(normalizeDate('2026-01-04 00:00:00')).toBe('2026-01-04');
    expect(normalizeDate('2026/1/4')).toBe('2026-01-04');
    expect(normalizeDate('2026-06-14T00:00:00.000Z')).toBe('2026-06-14');
    expect(normalizeDate('日付ではない')).toBeNull();
    expect(normalizeDate('2026-13-01')).toBeNull();
  });

  it('実在しない暦日を拒否する（月ごとの日数を検証）', () => {
    expect(normalizeDate('2026-02-30')).toBeNull();
    expect(normalizeDate('2026-06-31')).toBeNull();
    expect(normalizeDate('2026-02-29')).toBeNull(); // 平年
    expect(normalizeDate('2028-02-29')).toBe('2028-02-29'); // 閏年は有効
  });

  it('末尾の余分な数字を黙って受理しない', () => {
    expect(normalizeDate('2026-01-045')).toBeNull();
  });
});

describe('analyzeLedgerRows: 変換表（KX-019 §4）', () => {
  it('主日礼拝の行を Message/Gathering へ変換する', () => {
    const plan = analyzeLedgerRows([row(BASE)]);
    const r = plan.rows[0]!;
    expect(r.importable).toBe(true);
    expect(r.messageType).toBe('sermon');
    expect(r.gatheringKind).toBe('sunday_worship');
    expect(r.startsAtLocal).toBe('2026-01-04T10:30');
    expect(r.messageStatus).toBe('completed');
    expect(r.preparationStage).toBe('completed');
    expect(r.passage?.bookId).toBe('Gen');
    expect(r.passage?.displayText).toBe('創世記1:1-5');
  });

  it('祈祷会奨励は 19:30 開始・prayer_meeting_exhortation になる', () => {
    const plan = analyzeLedgerRows([row({ ...BASE, kind: '祈祷会奨励', stage: '釈義中' })]);
    const r = plan.rows[0]!;
    expect(r.messageType).toBe('prayer_meeting_exhortation');
    expect(r.gatheringKind).toBe('prayer_meeting');
    expect(r.startsAtLocal).toBe('2026-01-04T19:30');
    expect(r.preparationStage).toBe('exegesis');
    expect(r.messageStatus).toBe('preparing');
  });

  it('kind で表現しきれない集会種別は gathering.title に保持する（§4.1）', () => {
    const plan = analyzeLedgerRows([row({ ...BASE, kind: '修養会' })]);
    expect(plan.rows[0]!.gatheringKind).toBe('other');
    expect(plan.rows[0]!.gatheringTitle).toBe('修養会');
  });

  it('礼拝要素を §4.4 の順序で生成し、式典前後の賛美を保持する', () => {
    const plan = analyzeLedgerRows([
      row({
        ...BASE,
        call_to_worship: '詩篇95:1-3',
        opening_hymn: '聖歌',
        responsive_reading: '詩篇8篇',
        response_hymn: '主の恵み',
        ceremony: '聖餐式',
        ceremony_hymn: '主の食卓に招かれて',
        doxology: '頌栄',
      }),
    ]);
    const types = plan.rows[0]!.elements.map((e) => e.type);
    expect(types).toEqual([
      'call_to_worship',
      'hymn',
      'responsive_reading',
      'scripture_reading',
      'message',
      'hymn',
      'ceremony',
      'hymn',
      'doxology',
    ]);
    const ceremony = plan.rows[0]!.elements.find((e) => e.type === 'ceremony')!;
    expect(ceremony.ceremonyType).toBe('communion');
  });

  it('式典「なし」では ceremony を生成しない', () => {
    const plan = analyzeLedgerRows([row({ ...BASE, ceremony: 'なし' })]);
    expect(plan.rows[0]!.elements.some((e) => e.type === 'ceremony')).toBe(false);
  });

  it('日付が空・不正な行は error でインポート対象外（§6.1）', () => {
    const plan = analyzeLedgerRows([
      row({ ...BASE, date: '' }, 6),
      row({ ...BASE, date: '不明' }, 7),
      row(BASE, 8),
    ]);
    expect(plan.counts.rowsTotal).toBe(3);
    expect(plan.counts.rowsImportable).toBe(1);
    expect(plan.issues.filter((i) => i.severity === 'error')).toHaveLength(2);
  });

  it('解析できない聖書箇所は warning で原文を migrationNotes に保存する（§6.3）', () => {
    const plan = analyzeLedgerRows([
      row({ ...BASE, book: '創世記', chapter_verse: '冒頭のあたり' }),
    ]);
    const r = plan.rows[0]!;
    expect(r.importable).toBe(true);
    expect(r.passage).toBeNull();
    expect(r.migrationNotes[0]?.value).toBe('創世記 冒頭のあたり');
    expect(plan.issues.some((i) => i.severity === 'warning' && i.column === '章節')).toBe(true);
  });

  it('ファイル内の fingerprint 重複を検出する（§5）', () => {
    const plan = analyzeLedgerRows([row(BASE, 6), row(BASE, 7)]);
    expect(plan.inFileDuplicates).toHaveLength(1);
    expect(plan.inFileDuplicates[0]!.rowNumbers).toEqual([6, 7]);
  });

  it('集計が正しい（series/venue はユニーク数）', () => {
    const plan = analyzeLedgerRows([
      row({ ...BASE, series_name: '創世記講解', venue: '本会堂' }, 6),
      row({ ...BASE, title: '別の説教', series_name: '創世記講解', venue: '本会堂' }, 7),
    ]);
    expect(plan.counts.messages).toBe(2);
    expect(plan.counts.series).toBe(1);
    expect(plan.counts.venues).toBe(1);
    expect(plan.counts.passages).toBe(2);
  });

  it('タグ・主題・次の作業・期限は legacy として保持する（破棄しない）', () => {
    const plan = analyzeLedgerRows([
      row({
        ...BASE,
        tags: '創造,主権',
        theme: '神',
        next_action: '推敲',
        due: '2026-01-02 00:00:00',
      }),
    ]);
    const legacy = plan.rows[0]!.legacy;
    expect(legacy.tags).toEqual(['創造', '主権']);
    expect(legacy.theme).toBe('神');
    expect(legacy.nextAction).toBe('推敲');
    expect(legacy.dueOn).toBe('2026-01-02');
  });

  it('空行は黙ってスキップする', () => {
    const plan = analyzeLedgerRows([row({}, 6), row(BASE, 7)]);
    expect(plan.counts.rowsTotal).toBe(1);
  });

  it('プロトタイプ汚染キーをマップ規則として誤マッチしない（リスト外フォールバック）', () => {
    const plan = analyzeLedgerRows([
      row({ ...BASE, kind: 'constructor', stage: 'hasOwnProperty', ceremony: 'toString' }),
    ]);
    const r = plan.rows[0]!;
    expect(r.messageType).toBe('other'); // KIND_MAP のフォールバック
    expect(r.gatheringKind).toBe('other');
    expect(r.messageStatus).toBe('planned'); // STAGE_MAP のフォールバック
    expect(r.preparationStage).toBe('not_started');
    const ceremony = r.elements.find((e) => e.type === 'ceremony');
    expect(ceremony?.ceremonyType).toBe('other'); // CEREMONY_MAP のフォールバック（関数が混入しない）
  });

  it('書巻が空で章節だけある行は警告＋migrationNote を残す（破棄しない／§6）', () => {
    const plan = analyzeLedgerRows([row({ ...BASE, book: '', chapter_verse: '23:1' })]);
    const r = plan.rows[0]!;
    expect(r.passage).toBeNull();
    expect(r.migrationNotes.some((nte) => nte.column === '書巻/章節' && nte.value === '23:1')).toBe(
      true,
    );
    expect(plan.issues.some((i) => i.severity === 'warning' && i.column === '章節')).toBe(true);
  });

  it('式典なし＋式典賛美ありは migrationNote に痕跡を残す（§6）', () => {
    const plan = analyzeLedgerRows([row({ ...BASE, ceremony: 'なし', ceremony_hymn: '感謝の歌' })]);
    const r = plan.rows[0]!;
    expect(r.elements.some((e) => e.type === 'ceremony')).toBe(false);
    expect(r.elements.some((e) => e.type === 'hymn' && e.title === '感謝の歌')).toBe(true);
    expect(
      r.migrationNotes.some((nte) => nte.column === '式典賛美' && nte.value === '感謝の歌'),
    ).toBe(true);
  });

  it('中心メッセージ（N列）を messages.central_message へ保持する', () => {
    const plan = analyzeLedgerRows([row({ ...BASE, central_message: '神は世を愛された' })]);
    expect(plan.rows[0]!.centralMessage).toBe('神は世を愛された');
  });
});

describe('toImportPayloadRow: RPC ペイロード（KX-021）', () => {
  it('解析済みの行を DB 関数の JSON 形状へ正しく変換する', () => {
    const plan = analyzeLedgerRows([
      row({
        ...BASE,
        kind: '主日礼拝',
        central_message: '神は世を愛された',
        series_name: '創世記講解',
        series_number: '3',
        venue: '本会堂',
        speaker: 'Jimi',
        memo: '導入の例話あり',
        theme: '神',
        tags: '創造,主権',
        next_action: '推敲',
        due: '2026-01-02',
        manuscript_link: 'https://example.com/sermon',
        ceremony: '聖餐式',
        ceremony_hymn: '主の食卓',
      }),
    ]);
    const payload = toImportPayloadRow(plan.rows[0]!, 'fp-abc');

    expect(payload.fingerprint).toBe('fp-abc');
    expect(payload.legacy_id).toBe('S-20260104-01');
    expect(payload.type).toBe('sermon');
    expect(payload.kind).toBe('sunday_worship');
    expect(payload.status).toBe('completed');
    expect(payload.preparation_stage).toBe('completed');
    expect(payload.central_message).toBe('神は世を愛された');
    expect(payload.notes).toBe('導入の例話あり');
    expect(payload.starts_at).toBe('2026-01-04T10:30:00+09:00');
    expect(payload.series_name).toBe('創世記講解');
    expect(payload.series_number).toBe(3);
    expect(payload.venue).toBe('本会堂');
    expect(payload.speaker).toBe('Jimi');
    expect(payload.passage).toEqual({
      book_id: 'Gen',
      start_chapter: 1,
      start_verse: 1,
      end_chapter: 1,
      end_verse: 5,
      display_text: '創世記1:1-5',
    });
    expect(payload.legacy).toEqual({
      observance: '',
      theme: '神',
      tags: ['創造', '主権'],
      next_action: '推敲',
      due_on: '2026-01-02',
      manuscript_ref: 'https://example.com/sermon',
    });
    // 礼拝要素: 聖書朗読→説教→式典→式典賛美 が含まれ、式典に ceremony_type が付く
    const ceremony = payload.elements.find((e) => e.type === 'ceremony');
    expect(ceremony?.ceremony_type).toBe('communion');
    expect(payload.elements.some((e) => e.type === 'message')).toBe(true);
  });
});
