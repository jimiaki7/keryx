import Link from 'next/link';
import { MESSAGE_STATUS_LABELS, MESSAGE_TYPE_LABELS, PREPARATION_STAGE_LABELS } from '@/lib/labels';

export type MessageListItem = {
  id: string;
  display_id: string;
  type: string;
  status: string;
  preparation_stage: string;
  title: string;
  created_at: string;
  message_passages: { display_text: string; role: string }[];
};

export function MessageList({ messages }: { messages: MessageListItem[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {messages.map((m) => {
        const primary = m.message_passages.find((p) => p.role === 'primary');
        return (
          <li key={m.id} className="rounded-lg border border-line bg-paper-raised px-4 py-3">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <Link
                href={`/messages/${m.id}`}
                className="font-medium text-ink hover:text-indigo-deep hover:underline"
              >
                {m.title || '（無題）'}
              </Link>
              {primary ? (
                <span className="text-sm text-indigo-soft">{primary.display_text}</span>
              ) : null}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
              <span>{m.display_id}</span>
              <span>{MESSAGE_TYPE_LABELS[m.type] ?? m.type}</span>
              <span className="rounded-full border border-line px-2 py-0.5">
                {MESSAGE_STATUS_LABELS[m.status] ?? m.status}
              </span>
              <span className="rounded-full bg-indigo-deep/5 px-2 py-0.5 text-indigo-deep">
                準備: {PREPARATION_STAGE_LABELS[m.preparation_stage] ?? m.preparation_stage}
              </span>
              <time dateTime={m.created_at}>
                {new Date(m.created_at).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' })}
              </time>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
