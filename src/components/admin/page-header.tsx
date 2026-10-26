export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-text-primary">{title}</h1>
        {description ? <p className="text-sm text-text-secondary">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
