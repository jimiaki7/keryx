import type { ReactNode } from 'react';

/** 空状態の共通UI。次の操作は一つだけ示す（KERYX_PRODUCT_SPEC §9.2） */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-line bg-paper-raised px-6 py-14 text-center">
      <p className="font-medium text-ink">{title}</p>
      {description ? (
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-muted">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
