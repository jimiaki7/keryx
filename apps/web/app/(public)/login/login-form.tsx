'use client';

import { useActionState } from 'react';
import type { KeyboardEvent } from 'react';
import { signIn, signUp, type AuthState } from './actions';

const initialState: AuthState = {};

/** 日本語IMEの変換確定Enterでフォームを送信しない */
function preventImeSubmit(e: KeyboardEvent<HTMLInputElement>) {
  if (e.key === 'Enter' && (e.nativeEvent.isComposing || e.keyCode === 229)) {
    e.preventDefault();
  }
}

export function LoginForm() {
  const [signInState, signInAction, signInPending] = useActionState(signIn, initialState);
  const [signUpState, signUpAction, signUpPending] = useActionState(signUp, initialState);
  const pending = signInPending || signUpPending;
  const error = signInState.error ?? signUpState.error;

  return (
    <form className="flex w-full flex-col gap-4">
      <div className="flex flex-col gap-1 text-left">
        <label htmlFor="email" className="text-sm font-medium text-ink">
          メールアドレス
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          onKeyDown={preventImeSubmit}
          className="rounded-md border border-line bg-paper-raised px-3 py-2 text-base"
        />
      </div>
      <div className="flex flex-col gap-1 text-left">
        <label htmlFor="password" className="text-sm font-medium text-ink">
          パスワード（8文字以上）
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          minLength={8}
          onKeyDown={preventImeSubmit}
          className="rounded-md border border-line bg-paper-raised px-3 py-2 text-base"
        />
      </div>
      {error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        formAction={signInAction}
        disabled={pending}
        className="rounded-md bg-indigo-deep px-4 py-2.5 text-sm font-medium text-paper-raised hover:bg-indigo-soft disabled:opacity-50"
      >
        {pending ? '処理中…' : 'ログイン'}
      </button>
      <button
        type="submit"
        formAction={signUpAction}
        disabled={pending}
        className="rounded-md border border-line bg-paper-raised px-4 py-2.5 text-sm font-medium text-indigo-deep hover:bg-indigo-deep/5 disabled:opacity-50"
      >
        新規登録
      </button>
    </form>
  );
}
