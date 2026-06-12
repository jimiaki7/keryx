import { redirect } from 'next/navigation';

// Inbox は廃止された（ADR-0004。日付未定でも「計画中」として扱う）
export default function InboxRedirect() {
  redirect('/messages');
}
