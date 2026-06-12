import 'server-only';
import type { createClient } from '@/lib/supabase/server';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/** Venue 名から ID を解決する（無ければ作成して Workspace 内で再利用できるようにする） */
export async function findOrCreateVenue(
  supabase: SupabaseServerClient,
  workspaceId: string,
  name: string,
): Promise<string | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const { data: existing } = await supabase
    .from('venues')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('name', trimmed)
    .is('deleted_at', null)
    .maybeSingle();
  if (existing) return existing.id;
  const { data: created } = await supabase
    .from('venues')
    .insert({ workspace_id: workspaceId, name: trimmed })
    .select('id')
    .single();
  return created?.id ?? null;
}
