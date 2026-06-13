'use client';

import { useActionState } from 'react';
import { acceptInvitation, type AcceptState } from './actions';

const initial: AcceptState = {};

export function AcceptInvitation({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(acceptInvitation.bind(null, token), initial);
  return (
    <form action={formAction} className="mt-4 flex flex-col gap-2">
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-indigo-deep px-4 py-2 text-sm font-medium text-paper-raised hover:bg-indigo-soft disabled:opacity-50"
      >
        {pending ? '参加中…' : '参加する'}
      </button>
      {state.error ? <p className="text-xs text-red-800">{state.error}</p> : null}
    </form>
  );
}
