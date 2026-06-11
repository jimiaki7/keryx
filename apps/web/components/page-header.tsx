export function PageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <header className="mb-6">
      <h1 className="text-2xl font-semibold text-indigo-deep">{title}</h1>
      {description ? <p className="mt-1 text-sm text-ink-muted">{description}</p> : null}
    </header>
  );
}
