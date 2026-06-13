# KX-019: Spreadsheet v1.3.1 インポート変換仕様

調査日: 2026-06-12
調査対象: `/Users/james/outputs/sermon-planner-v1/年間説教プランナー_Keryx_v1.3.1.xlsx`（実ファイルを openpyxl で解析）
本書は KX-020（Dry Run）/ KX-021（トランザクショナルインポート）の実装正本である。

## 1. ブックの全体構造と取り込み対象

| シート             | 内容                                                       | 取り込み                                 |
| ------------------ | ---------------------------------------------------------- | ---------------------------------------- |
| ダッシュボード     | 集計・グラフ（数式）                                       | 対象外（UI）                             |
| 新規入力フォーム   | 入力補助フォーム                                           | 対象外（UI）                             |
| **説教・奨励台帳** | **正本データ。1行=1説教/奨励**（ヘッダー行5、データ行6〜） | **対象**                                 |
| カレンダー         | 月間表示（数式）                                           | 対象外（UI）                             |
| 教会暦             | 教会暦プリセットの参考表                                   | 対象外（KX-024 のプリセットで再現）      |
| 設定               | マスターデータ（書巻66・リスト類）                         | 対象外（Keryx 側マスタを正とする）       |
| 使い方             | 説明書                                                     | 対象外                                   |
| 変更履歴           | 操作ログ（日時/操作/ID/…）                                 | 対象外（v1。元ブックを保管庫として残す） |

v1.3.1 ファイルの実データ: 12行（サンプル）。実運用データは Google Sheets 版にあり、列構造は同一。

## 2. 台帳の列一覧（A〜AE、31列）

「導出」列は数式で他列から計算されるため**取り込まず、Keryx 側で再導出**する。

| 列  | 名称           | 型                                | 入力規則（設定シート参照）      | 導出 | 変換先                                                                     |
| --- | -------------- | --------------------------------- | ------------------------------- | ---- | -------------------------------------------------------------------------- |
| A   | ID（自動）     | 文字列 `S\|P-YYYYMMDD-NN`         | 数式（S=説教系 / P=祈祷会奨励） | ✓    | `metadata.legacy_id`（Message/Gathering 両方）                             |
| B   | 日付           | 日付                              | 必須                            |      | `gatherings.starts_at`（§4.2）                                             |
| C   | 曜日           | 文字列                            | 数式（Bから）                   | ✓    | 無視                                                                       |
| D   | 集会種別       | リスト（8値 §3.1）                | 必須                            |      | `messages.type` + `gatherings.kind`（§4.1）                                |
| E   | 教会暦・行事   | 自由文字列                        |                                 |      | `gatherings.notes` 先頭 + `metadata.legacy_observance`（KX-024で昇格）     |
| F   | シリーズ名     | 自由文字列                        |                                 |      | `series` find-or-create                                                    |
| G   | シリーズ回     | 数値                              |                                 |      | `series_messages.position`                                                 |
| H   | 書巻           | リスト（66巻、新改訳2017表記）    |                                 |      | Passage 解析の入力                                                         |
| I   | 章節           | 自由文字列（例 `1:1-5`）          |                                 |      | 同上                                                                       |
| J   | 聖書箇所       | 文字列                            | 数式（H&" "&I）                 | ✓    | 無視（H+I から再構成）                                                     |
| K   | 区分           | 旧約/新約                         | 数式（書巻から）                | ✓    | 無視（bible_books から再導出）                                             |
| L   | ジャンル       | 文字列                            | 数式（書巻から）                | ✓    | 無視（※表記差 §6.4）                                                       |
| M   | 説教題         | 自由文字列                        | 必須                            |      | `messages.title`                                                           |
| N   | 中心メッセージ | 自由文字列                        |                                 |      | `messages.central_message`                                                 |
| O   | 主題           | リスト（16値）                    |                                 |      | `messages.metadata.legacy.theme`（themes 実装後に昇格）                    |
| P   | タグ           | カンマ区切り                      |                                 |      | `messages.metadata.legacy.tags`（配列化して保存）                          |
| Q   | Venue          | リスト（4値＋自由）               |                                 |      | `venues` find-or-create → `gatherings.venue_id`                            |
| R   | 説教者         | リスト（Jimi/ゲスト説教者＋自由） |                                 |      | `message_deliveries.speaker_name`                                          |
| S   | 招詞           | 自由文字列                        |                                 |      | service_element `call_to_worship`                                          |
| T   | 開会賛美       | 自由文字列                        |                                 |      | service_element `hymn`（title=値）                                         |
| U   | 聖書交読       | 自由文字列                        |                                 |      | service_element `responsive_reading`                                       |
| V   | 応答賛美       | 自由文字列                        |                                 |      | service_element `hymn`                                                     |
| W   | 式典           | リスト（7値 §4.4）                |                                 |      | service_element `ceremony`（なし→生成しない）                              |
| X   | 式典賛美       | 自由文字列                        |                                 |      | service_element `hymn`（**式典の直後**に配置）                             |
| Y   | 頌栄           | 自由文字列                        |                                 |      | service_element `doxology`                                                 |
| Z   | 準備段階       | リスト（8値 §4.5）                |                                 |      | `messages.status` + `messages.preparation_stage`（§4.5）                   |
| AA  | 進捗%          | 小数 0〜1                         | decimal≧0                       |      | 無視（ステージから自明）                                                   |
| AB  | 次の作業       | 自由文字列                        |                                 |      | `messages.metadata.legacy.next_action`                                     |
| AC  | 期限           | 日付                              |                                 |      | `messages.metadata.legacy.due_on`（必要になれば昇格）                      |
| AD  | 原稿リンク     | URL/文字列                        |                                 |      | URL形式→`messages.source_links`、それ以外→`metadata.legacy.manuscript_ref` |
| AE  | メモ           | 自由文字列                        |                                 |      | `messages.notes_markdown`（先頭に追記）                                    |

### 3.1 リスト値（設定シートの正本）

- **集会種別（E11:E18）**: 主日礼拝・祈祷会奨励・伝道礼拝・特別礼拝・葬儀・記念礼拝・結婚式・修養会・その他
- **準備段階（F11:F18）**: 未着手・本文確定・釈義中・骨子作成・原稿執筆・推敲・礼拝準備完了・説教済み
- **式典（J11:J17）**: なし・聖餐式・洗礼式・転入会式・子ども祝福式・召天者記念・その他
- **主題（I11:I26）**: 神・キリスト・聖霊・福音・救い・信仰・悔い改め・教会・祈り・礼拝・宣教・弟子道・苦難・希望・聖化・終末
- 書巻（A11:A76）は新改訳2017表記で Keryx の `bible_books.name_ja` と完全一致（66巻照合済み）

## 4. 1行 → Keryx エンティティへの変換表

旧1行を `Message + Gathering + Message Delivery + Service Elements (+ Series/Venue)` に分割する。

### 4.1 集会種別 → type / kind

| 集会種別       | messages.type              | gatherings.kind | 補足                         |
| -------------- | -------------------------- | --------------- | ---------------------------- |
| 主日礼拝       | sermon                     | sunday_worship  |                              |
| 祈祷会奨励     | prayer_meeting_exhortation | prayer_meeting  |                              |
| 伝道礼拝       | sermon                     | special_service | gathering.title=「伝道礼拝」 |
| 特別礼拝       | sermon                     | special_service |                              |
| 葬儀・記念礼拝 | sermon                     | special_service | gathering.title=元値         |
| 結婚式         | sermon                     | special_service | gathering.title=「結婚式」   |
| 修養会         | sermon                     | other           | gathering.title=「修養会」   |
| その他         | other                      | other           |                              |

kind で表現しきれない元値は `gatherings.title` に保持し、情報を失わない。

### 4.2 日付 → Gathering

- B列は日付のみ（時刻 00:00）。`starts_at` は **kind 既定の開始時刻**で補完する: sunday_worship→10:30、prayer_meeting→19:30、その他→10:30（Dry Run 画面で一括変更可能にする）。タイムゾーンは `+09:00` 固定で `YYYY-MM-DDT HH:mm:00+09:00` を生成（KX-017 と同じ Tokyo 壁時計規約）。
- `status`: 日付が過去→`completed`、未来→`scheduled`。

### 4.3 聖書箇所 → message_passages

- 入力は `${H列} ${I列}`（例 `創世記 1:1-5`）を `parsePassage` に渡す（J列は使わない）。
- H列のみ（章節空）→ 解析不能として §6 の例外処理（書巻だけでは章が無いため）。
- 解析成功 → `role='primary'`、構造化保存。区分・ジャンルは保存せず `bible_books` から再導出。

### 4.4 礼拝要素 → service_elements

値が入っている列だけ、次の順序（position 昇順）で生成する:

1. S 招詞 → `call_to_worship`
2. T 開会賛美 → `hymn`
3. U 聖書交読 → `responsive_reading`
4. （聖書朗読 `scripture_reading`、title=Passage表示文字列。Passage がある場合のみ）
5. （説教 `message`。常に生成）
6. V 応答賛美 → `hymn`
7. W 式典 → `ceremony`（「なし」は生成しない）
8. X 式典賛美 → `hymn`（式典の**直後**。式典が「なし」でX列に値→ 通常の hymn として末尾に置き migration_note）
9. Y 頌栄 → `doxology`

式典の metadata.ceremony_type 対応: 聖餐式→communion / 洗礼式→baptism / 転入会式→transfer / 召天者記念→memorial / 子ども祝福式→**other**（title=「子ども祝福式」で名称保持） / その他→other。
祝祷は元データに列が無いため生成しない（取り込み後にテンプレート適用で補える旨をガイドに記載）。

### 4.5 準備段階 → messages.status / preparation_stage（ADR-0003 改訂）

準備管理は単一ステージ（未着手→釈義→アウトライン→原稿→完了）。旧8値は次のとおり畳み込む:

| 旧: 準備段階 | messages.preparation_stage | messages.status |
| ------------ | -------------------------- | --------------- |
| 未着手       | not_started                | planned         |
| 本文確定     | exegesis                   | preparing       |
| 釈義中       | exegesis                   | preparing       |
| 骨子作成     | outline                    | preparing       |
| 原稿執筆     | manuscript                 | preparing       |
| 推敲         | manuscript                 | preparing       |
| 礼拝準備完了 | completed                  | ready           |
| 説教済み     | completed                  | completed       |

- AB 次の作業／AC 期限は破棄せず `metadata.legacy.next_action` / `legacy.due_on` に保存する。
- AA 進捗% は取り込まない（ステージから自明）。

### 4.6 シリーズ

- F列シリーズ名で workspace 内 find-or-create（status=`active`）。
- G列シリーズ回を `series_messages.position` に。数値化できない・重複する場合は当該シリーズの max+1 を採番し migration_note。

## 5. ID・重複・再実行安全性

- **新IDは自動発行**（MSG-/GTH-）。A列は `metadata.legacy_id` として Message と Gathering の両方に保持する。
- 各行に `source_row_number`（台帳の物理行番号）と **fingerprint** `sha256(日付ISO + '|' + 集会種別 + '|' + 書巻 + '|' + 章節 + '|' + 説教題)` を計算し、`metadata.import = { source_row_number, fingerprint, imported_at, source_file }` に保存する。
- 重複判定（Dry Run で提示）:
  1. `legacy_id` 一致 → 既存行として**スキップ**（既定）/上書きを選択制に
  2. fingerprint 一致 → 重複候補として警告
  3. 同一 workspace に同じ `starts_at`±0分 かつ同じ kind の Gathering → 「同じ集会に複数 Message」候補として確認（夕拝等の正当ケースがあるため自動スキップしない）
- 再実行: 同じファイルを再度流しても 1) により既存分はスキップされ、新規行だけが追加される。

## 6. 例外・移行できない値の保存方針

**原則: 破棄しない。** 変換できない値は `messages.metadata.migration_notes[]` に `{ column, value, reason }` で残し、Dry Run のレポートに行単位で表示する。

| ケース                                         | 扱い                                                                                                                                |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 6.1 日付が空・不正                             | 行をエラーとしてインポートしない（台帳の必須項目欠落。レポートに表示）                                                              |
| 6.2 説教題が空                                 | Message は作成（title=''）。warning                                                                                                 |
| 6.3 章節が解析不能（`1:1-5` 以外の自由記述等） | Message/Gathering は作成、passage は作らず migration_note に原文保存。warning                                                       |
| 6.4 ジャンル表記差                             | 旧「使徒史」→歴史書、「詩歌・知恵」→詩歌書。導出列なので変換不要（再導出で吸収）。分析画面の名称が変わることをガイドに明記          |
| 6.5 リスト外の値（集会種別・式典等の自由入力） | その他/other にマップし、元値を title または migration_note に保持                                                                  |
| 6.6 教会暦・行事（E列）                        | Observance 未実装のため `gatherings.notes` 先頭に「行事: ◯◯」と `metadata.legacy_observance`。KX-024 実装後に一括昇格できる形で保存 |
| 6.7 主題・タグ（O/P列）                        | themes 未実装のため `metadata.legacy.theme` / `legacy.tags`。KX-022/023 で昇格                                                      |
| 6.8 原稿リンクが URL でない                    | `metadata.legacy.manuscript_ref` に保存（Scrivener 名等を想定）                                                                     |
| 6.9 変更履歴シート                             | 取り込まない。元ブックを読み取り専用で保管する運用をガイドに記載                                                                    |

## 7. Dry Run（KX-020）が表示すべきもの

1. シート/ヘッダー自動認識の結果（ヘッダー行5の検出、31列の対応表。列の手動マッピング変更可）
2. 作成予定件数: Message / Gathering / Delivery / Service Elements / Series / Venue
3. エラー行（6.1）・warning 行（6.2/6.3/6.5）・重複候補（§5）の行番号付き一覧
4. 既定開始時刻（§4.2）の確認 UI
5. **DB は一切変更しない**こと、再実行用 fingerprint を生成すること

## 8. 受け入れ条件との対応

- 列一覧・型・例外・重複規則 → §2/§3/§5/§6
- 1行からの変換表 → §4
- 移行できない値の保存方針 → §6（破棄禁止・migration_notes）

## 9. 実装状況（KX-020 / KX-021）

### KX-021（トランザクショナル取り込み）= 実装済み

- DB 関数 `import_ledger_batch(p_workspace, p_source_file, p_batch_id, p_rows jsonb)`
  （`supabase/migrations/20260613000006_import_ledger.sql`）。
  - SECURITY INVOKER。RLS が workspace 分離と書き込みロール（messages は owner/pastor）を強制。
  - 1 関数 = 1 トランザクション。行ごとに `BEGIN ... EXCEPTION` で savepoint を張り、
    1 行の失敗がバッチ全体を巻き戻さず行単位で報告する（§10 部分失敗の報告）。
  - 再実行安全性: legacy_id / fingerprint が一致する行はスキップ（同一トランザクション内で先に
    insert した行も見えるため、ファイル内重複も自動でスキップ）。
  - 1 行 → Message + Gathering + Delivery + Service Elements (+ Passage / Series / Venue) に分割。
  - `metadata.import.batch_id` を保存し、`undo_import_batch` でバッチをソフトデリート（取り消し）できる。
- gatherings に `metadata jsonb` 列を追加（legacy_id / import.batch_id の保持）。
- サーバーアクション `submitImport`（phase=dryrun/import）/ `undoImportBatch`
  （`apps/web/app/(app)/settings/import/actions.ts`）。ペイロード形は `toImportPayloadRow`
  （`packages/domain/src/import.ts`）で 1 か所に定義し、Dry Run と実取り込みのズレを防ぐ。
- 検証: pgTAP 0005（作成/冪等再実行/ファイル内重複/Gathering status/undo/認可）、
  実台帳12行のブラウザ E2E（12 作成 → 再 Dry Run で全件重複 → batch undo）。

実取り込みが `metadata` を書くようになったことで、KX-020 で申し送っていた「再 Dry Run の作成予定件数 vs
DB 重複の不整合」は解消（再実行時に既存12件を重複判定し新規0件と表示）。

### 残課題（次イテレーション）

- **§5(3) 既存 Gathering との時刻衝突検出**: Dry Run の重複判定は現状 (1)legacy_id / (2)fingerprint のみ。
  §5(3)「同一 workspace・同一 starts_at・同一 kind の既存 Gathering」（手入力済みデータとの衝突。自動スキップ
  不可・要確認）は未実装。`gatherings` を starts_at/kind で照会し「既存集会あり（要確認）」として提示する。
- 大量行（数千行超）での body サイズ・実行時間は未検証（実運用想定は数十〜数百行）。

### セキュリティ・堅牢性（KX-020 で対応済み）

信頼できないアップロードに対する DoS 防御を `apps/web/lib/import/parse-ledger.ts` に実装済み。

- zip bomb: 必要エントリのみをストリーミング解凍し、展開後サイズに予算（1エントリ32MB / 合計64MB）を課して中断。
- 巨大 `row r` 属性・大量行: グリッドは出現順 push で構築し物理行番号は別管理。解析行数の上限（50,000 行）。
- 正規表現の全文走査（ReDoS）撤廃: シート XML は線形タグスキャンで O(n) 解析。
- プロトタイプ汚染キー（`constructor` 等）の誤マッチ防止（`Object.hasOwn` ガード）、実在しない暦日の拒否、
  Excel シリアル日付の `Math.floor` 変換、同名ヘッダーの黙示的上書き防止。
