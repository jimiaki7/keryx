import { redirect } from 'next/navigation';

// シリーズは Messages セクションへ統合された（ナビ簡素化、2026-06-12）
export default async function SeriesDetailRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/messages/series/${id}`);
}
