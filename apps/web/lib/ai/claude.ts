import 'server-only';

// AI provider ゲートウェイ（サーバー専用）。
// - ブラウザへ API キーを出さない（server-only でガード）。
// - ANTHROPIC_API_KEY 未設定なら呼び出さず {ok:false, reason:'unset'} を返す。
// - 本文・キーをログに出さない。エラーは利用者向けの一般的な文言に丸める。
// 決済・利用上限・監査の本実装は後段（ADR §10・§14）。土台のみ。

export type AiResult =
  | { ok: true; content: string; model: string }
  | { ok: false; reason: 'unset' | 'error'; message: string };

// 既定は環境変数で上書き可能。最新世代の Claude を既定にする。
const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6';
const API_URL = 'https://api.anthropic.com/v1/messages';

/** サーバーに AI が設定されているか（UI のガードに使う）。 */
export function aiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

type GenerateInput = {
  system: string;
  user: string;
  maxTokens?: number;
};

/** 単発のテキスト生成。失敗は理由つきで返し、例外は投げない。 */
export async function generateText(input: GenerateInput): Promise<AiResult> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return {
      ok: false,
      reason: 'unset',
      message: 'AI は未設定です（サーバーに ANTHROPIC_API_KEY が設定されていません）。',
    };
  }

  let res: Response;
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        max_tokens: input.maxTokens ?? 400,
        system: input.system,
        messages: [{ role: 'user', content: input.user }],
      }),
      // 暴走防止の簡易タイムアウト
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    // ネットワーク/タイムアウト。詳細（本文・キー）はログに残さない。
    return { ok: false, reason: 'error', message: 'AI 呼び出しでエラーが発生しました。' };
  }

  if (!res.ok) {
    return {
      ok: false,
      reason: 'error',
      message: 'AI 呼び出しに失敗しました。時間をおいて再試行してください。',
    };
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return { ok: false, reason: 'error', message: 'AI の応答を解釈できませんでした。' };
  }

  const content = extractText(data);
  if (!content) {
    return { ok: false, reason: 'error', message: 'AI の応答が空でした。' };
  }
  return { ok: true, content, model: extractModel(data) };
}

function extractText(data: unknown): string {
  if (typeof data !== 'object' || data === null) return '';
  const blocks = (data as { content?: unknown }).content;
  if (!Array.isArray(blocks)) return '';
  return blocks
    .filter(
      (b): b is { type: 'text'; text: string } =>
        typeof b === 'object' &&
        b !== null &&
        (b as { type?: unknown }).type === 'text' &&
        typeof (b as { text?: unknown }).text === 'string',
    )
    .map((b) => b.text)
    .join('')
    .trim();
}

function extractModel(data: unknown): string {
  if (typeof data === 'object' && data !== null) {
    const m = (data as { model?: unknown }).model;
    if (typeof m === 'string' && m.length > 0) return m;
  }
  return DEFAULT_MODEL;
}
