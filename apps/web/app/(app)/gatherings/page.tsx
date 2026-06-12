import { redirect } from 'next/navigation';

// 礼拝予定の一覧・作成はカレンダーへ統合された（ナビ簡素化、2026-06-12）
export default function GatheringsRedirect() {
  redirect('/calendar');
}
