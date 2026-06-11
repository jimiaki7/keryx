// packages/scripture の書巻マスタから bible_books テーブルの seed SQL を生成する。
// 使い方: pnpm dlx tsx scripts/gen-bible-books-sql.ts
import { BIBLE_BOOKS } from '../packages/scripture/src/index';

const rows = BIBLE_BOOKS.map((b) => {
  const aliases = JSON.stringify(b.aliases).replace(/'/g, "''");
  return `  ('${b.osis}', ${b.canonicalOrder}, '${b.testament}', '${b.genre}', '${b.nameJa}', '${b.shortNameJa}', '${b.nameEn.replace(/'/g, "''")}', '${aliases}'::jsonb, ${b.chapterCount})`;
});

process.stdout.write(
  `insert into public.bible_books
  (osis, canonical_order, testament, genre, name_ja, short_name_ja, name_en, aliases, chapter_count)
values
${rows.join(',\n')};
`,
);
