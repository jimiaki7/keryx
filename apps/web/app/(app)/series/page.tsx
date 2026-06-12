import { redirect } from 'next/navigation';

// シリーズは Messages セクションへ統合された（ナビ簡素化、2026-06-12）
export default function SeriesRedirect() {
  redirect('/messages/series');
}
