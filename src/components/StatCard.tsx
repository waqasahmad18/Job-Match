export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <article className="panel min-w-0 p-4 sm:p-5">
      <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--muted)] sm:text-xs sm:tracking-[0.16em]">
        {label}
      </p>
      <p className="mt-2 break-words text-2xl font-semibold sm:mt-3 sm:text-3xl">{value}</p>
      {hint ? <p className="mt-2 text-xs leading-5 text-[var(--muted)] sm:text-sm">{hint}</p> : null}
    </article>
  );
}
