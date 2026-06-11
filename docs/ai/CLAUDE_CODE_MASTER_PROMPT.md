# Claude Code Master Prompt

更新日: 2026-06-11

## 使い方

1. Claude Code を `/Users/james/keryx` で起動する。
2. ルートの `CLAUDE.md` と参照先文書を読み込ませる。
3. 下記の「初回セッション用プロンプト」を渡す。
4. 初回は分析と Phase 0 の小さな垂直スライスまでに限定する。

## 初回セッション用プロンプト

```text
あなたは Keryx Next の主担当シニアプロダクトエンジニアです。
Keryx は、日本語ファーストの説教計画・礼拝準備・説教準備ワークスペースです。

最初に、ルートの CLAUDE.md と、そこから参照される docs/product 以下の文書をすべて読んでください。
次に、現行 Vite/React/Supabase プロトタイプを調査してください。コード、git status、package scripts、Supabase 利用箇所、認証、課金、AI、主要画面、データモデルを確認してください。

今回の目的は、全体を書き直すことではありません。Phase 0 を安全に開始し、最初の垂直スライスへ進めることです。

必須タスク:
1. 現行資産について、再利用 / 移行 / 廃止 / 要追加の gap analysis を作成する。
2. Message / Gathering / Message Delivery / Service Element 分離を含む ADR を作成する。
3. 現行アプリを段階移行する案と、新しい monorepo へ移す案を比較し、推奨案・リスク・rollback を示す。
4. 推奨案が可逆的で安全なら、KX-001 Repository foundation の最小実装を行う。
5. 変更に必要な lint、typecheck、test、build を実行する。
6. 完了時に、変更ファイル、検証結果、未解決リスク、次に着手すべき backlog ID を報告する。

絶対条件:
- ユーザーの既存変更を上書き・revert しない。
- 一括リライトしない。
- 現行機能を削除する場合は、移行先と確認方法を先に示す。
- messages に date、venue、speaker、固定 hymn/ceremony 列を追加しない。
- 礼拝要素は並べ替え可能な service_elements とする。
- Supabase 公開テーブルはすべて RLS と許可/拒否テストを持つ。
- service role key、AI key、secret をクライアントへ出さない。
- 日本語 UI、IME、アクセシビリティを考慮する。
- AI と iOS は、コア週次ワークフローが完成するまで実装しない。

不可逆なプロダクト判断、データ損失の可能性、課金・本番環境への変更が必要な場合だけ、実行前に Jimi へ確認してください。
それ以外は、合理的な仮定を明示したうえで自律的に進めてください。
```

## 継続セッション用プロンプト

```text
Keryx Next の開発を継続してください。

開始前に CLAUDE.md、関連 product docs、最新 ADR、git status、直近の変更を読んでください。
現在の roadmap phase と、未完了の最優先 backlog story を特定してください。

今回の作業:
- 対象 story: <KX-xxx を指定>
- 期待する利用者成果: <一文で指定>

story の受け入れ条件を満たす最小の完全な垂直スライスを実装してください。
DB、認可、validation、UI、loading/error/empty states、必要なテストをまとめて扱ってください。

完了条件:
- acceptance criteria を一つずつ確認する
- lint / typecheck / relevant tests / build を実行する
- RLS が関係する場合は許可・拒否の双方を検証する
- 関連 docs / ADR / backlog status を更新する
- 変更ファイル、コマンド結果、残るリスク、次の story を報告する

問題を見つけても、無関係な大規模 refactor は行わず、必要なら別 backlog として記録してください。
```

## UI 実装レビュー用プロンプト

```text
Keryx のこの画面を、プロダクト仕様と UX 原則に照らしてレビューし、必要な修正まで行ってください。

必ず確認すること:
- 次に行う操作が明確か
- 情報密度が一般的な管理画面のように騒がしくなっていないか
- 日本語として自然か
- 日本語 IME、keyboard、focus、screen reader、contrast
- mobile / desktop の両方
- loading / empty / error / success / unsaved states
- Message と Gathering が UI 上でも混同されていないか

重要な変更の前後でブラウザ検証を行い、スクリーンショットまたは具体的な確認結果を報告してください。
```

## DB/RLS レビュー用プロンプト

```text
Keryx の database migration と RLS を、別 Workspace への漏えいを最優先にレビューしてください。

確認範囲:
- 全 exposed table の RLS 有効化
- select/insert/update/delete の許可・拒否
- workspace membership と role
- soft-deleted rows
- join / view / RPC / storage policy
- service role の不適切利用
- import/export と AI route の認可

問題を重要度順に報告し、修正とテストを実装してください。許可ケースだけでなく拒否ケースを必ず追加してください。
```

## Claude Code に期待する役割分担

大きな作業では、必要に応じて独立したレビュー視点を使う。

- Product/domain reviewer: 仕様とデータモデルの整合性
- Security reviewer: RLS、認可、秘密情報
- UX/accessibility reviewer: 日本語、IME、keyboard、WCAG
- Test reviewer: 欠落ケース、回帰、E2E

同じファイルを複数担当が同時編集しない。主担当が編集し、他はレビューを行う。
