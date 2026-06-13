'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { generateText } from '@/lib/ai/claude';
import { createClient } from '@/lib/supabase/server';
import { getActiveWorkspace } from '@/lib/workspace';

export type AiSuggestState = { ok?: boolean; nonce?: number; error?: string; info?: string };

const KINDS = ['summary', 'central_message'] as const;
type Kind = (typeof KINDS)[number];

const PROMPTS: Record<Kind, { system: string; ask: string; maxTokens: number }> = {
  summary: {
    system:
      'あなたは改革派・福音主義の説教準備を助ける日本語アシスタントです。与えられた説教メモから、会衆向けの簡潔な概要を1〜2文の日本語で作成します。聖書本文にない事柄を断定せず、誇張しません。出力は概要本文のみとし、前置きや見出しを付けません。',
    ask: '次の説教メモの概要を1〜2文で作成してください。',
    maxTokens: 300,
  },
  central_message: {
    system:
      'あなたは改革派・福音主義の説教準備を助ける日本語アシスタントです。与えられた説教メモから、その説教が伝えたい中心メッセージを一文の日本語で表現します。聖書本文にない事柄を断定せず、福音中心で簡潔にまとめます。出力は中心メッセージ一文のみとし、前置きや見出しを付けません。',
    ask: '次の説教メモの中心メッセージを一文で表現してください。',
    maxTokens: 200,
  },
};

const messageIdSchema = z.uuid();
const kindSchema = z.enum(KINDS);

// AI provider へ送るソースの上限（暴走入力でのコスト浪費・巨大リクエストを防ぐ）。
const MAX_SOURCE_CHARS = 20_000;

/** AI に概要・中心メッセージの候補を生成させ、pending の ai_suggestions として保存する。
 *  正本（messages）には書き込まない。承認は別操作（approveSuggestion）。 */
export async function generateSuggestion(messageId: string, kind: Kind): Promise<AiSuggestState> {
  if (!messageIdSchema.safeParse(messageId).success) return { error: '不正なメッセージです。' };
  if (!kindSchema.safeParse(kind).success) return { error: '不正な種類です。' };

  const workspace = await getActiveWorkspace();
  const supabase = await createClient();

  const { data: message } = await supabase
    .from('messages')
    .select('id, title, central_message, summary, outline_markdown, notes_markdown')
    .eq('id', messageId)
    .eq('workspace_id', workspace.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!message) return { error: 'メッセージが見つかりません。' };

  const source = buildSource(message);
  if (source.trim().length === 0) {
    return { error: 'メモ・アウトラインなどの入力がありません。先に内容を書いてください。' };
  }

  // 同じ種類の pending 候補が既にあれば、AI を呼ばずに知らせる（重複生成の抑止）。
  const { data: existing } = await supabase
    .from('ai_suggestions')
    .select('id')
    .eq('message_id', messageId)
    .eq('kind', kind)
    .eq('status', 'pending')
    .maybeSingle();
  if (existing) {
    return {
      error: 'この種類の未承認の候補がすでにあります。承認または却下してから生成してください。',
    };
  }

  const prompt = PROMPTS[kind];
  const result = await generateText({
    system: prompt.system,
    user: `${prompt.ask}\n\n---\n${source}`,
    maxTokens: prompt.maxTokens,
  });

  if (!result.ok) {
    return { error: result.message };
  }

  const { error } = await supabase.from('ai_suggestions').insert({
    workspace_id: workspace.id,
    message_id: messageId,
    kind,
    content: result.content,
    model: result.model,
  });
  if (error) {
    // 競合で同種の pending が割り込んだ場合（部分ユニーク索引違反）も丁寧に伝える。
    if (error.code === '23505') {
      return {
        error: 'この種類の未承認の候補がすでにあります。承認または却下してから生成してください。',
      };
    }
    return { error: '提案を保存できませんでした。' };
  }

  revalidatePath(`/messages/${messageId}`);
  return {
    ok: true,
    nonce: Date.now(),
    info: '候補を作成しました。内容を確認して承認してください。',
  };
}

export async function approveSuggestion(
  suggestionId: string,
  messageId: string,
): Promise<AiSuggestState> {
  if (!z.uuid().safeParse(suggestionId).success || !messageIdSchema.safeParse(messageId).success) {
    return { error: '不正な提案です。' };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc('approve_ai_suggestion', { p_suggestion_id: suggestionId });
  if (error) return { error: '承認できませんでした。' };
  revalidatePath(`/messages/${messageId}`);
  return { ok: true, nonce: Date.now(), info: '承認し、本文へ反映しました。' };
}

export async function rejectSuggestion(
  suggestionId: string,
  messageId: string,
): Promise<AiSuggestState> {
  if (!z.uuid().safeParse(suggestionId).success || !messageIdSchema.safeParse(messageId).success) {
    return { error: '不正な提案です。' };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc('reject_ai_suggestion', { p_suggestion_id: suggestionId });
  if (error) return { error: '却下できませんでした。' };
  revalidatePath(`/messages/${messageId}`);
  return { ok: true, nonce: Date.now(), info: '却下しました。' };
}

function buildSource(m: {
  title: string;
  central_message: string;
  summary: string;
  outline_markdown: string;
  notes_markdown: string;
}): string {
  const parts: string[] = [];
  if (m.title) parts.push(`タイトル: ${m.title}`);
  if (m.central_message) parts.push(`現在の中心メッセージ: ${m.central_message}`);
  if (m.outline_markdown) parts.push(`アウトライン:\n${m.outline_markdown}`);
  if (m.notes_markdown) parts.push(`ノート:\n${m.notes_markdown}`);
  const joined = parts.join('\n\n');
  return joined.length > MAX_SOURCE_CHARS
    ? `${joined.slice(0, MAX_SOURCE_CHARS)}\n…（以下省略）`
    : joined;
}
