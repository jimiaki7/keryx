import { redirect } from 'next/navigation';

// Inbox は Messages のフィルタへ統合された（ナビ簡素化、2026-06-12）
export default function InboxRedirect() {
  redirect('/messages?status=inbox');
}
