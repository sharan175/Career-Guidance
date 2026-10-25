/** Small reusable progress bar (roadmap header, dashboard cards). */
export function ProgressBar({
  percent,
  label = "Progress",
  className = "",
}: {
  percent: number;
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={`h-2.5 w-full overflow-hidden rounded-full bg-slate-200 ${className}`}
    >
      <div
        className="h-full rounded-full bg-[#2B78E4] transition-[width] duration-300 motion-reduce:transition-none"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
