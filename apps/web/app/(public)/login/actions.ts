'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

export type AuthState = { error?: string };

const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(72),
});

function parseCredentials(formData: FormData) {
  return credentialsSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
}

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = parseCredentials(formData);
  if (!parsed.success) {
    return { error: 'メールアドレスと8文字以上のパスワードを入力してください。' };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return { error: 'ログインできませんでした。メールアドレスとパスワードをご確認ください。' };
  }
  redirect('/');
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = parseCredentials(formData);
  if (!parsed.success) {
    return { error: 'メールアドレスと8文字以上のパスワードを入力してください。' };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp(parsed.data);
  if (error) {
    return { error: 'アカウントを作成できませんでした。しばらくしてからもう一度お試しください。' };
  }
  redirect('/');
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
