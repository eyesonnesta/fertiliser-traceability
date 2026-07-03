// A single metric card for the dashboard summary row.

export default function StatCard({ label, value, Icon, tone = 'moss', hint }) {
  const tones = {
    moss: {
      icon: 'bg-leaf-soft text-moss',
      accent: 'before:bg-moss',
    },
    clay: {
      icon: 'bg-clay-soft text-clay',
      accent: 'before:bg-clay',
    },
    wheat: {
      icon: 'bg-wheat-soft text-wheat',
      accent: 'before:bg-wheat',
    },
    alert: {
      icon: 'bg-alert-soft text-alert',
      accent: 'before:bg-alert',
    },
  };
  const toneClasses = tones[tone] || tones.moss;

  return (
    <div
      className={`card-shadow relative overflow-hidden rounded-lg border border-line bg-card p-4 sm:p-5 before:absolute before:inset-y-0 before:left-0 before:w-1 ${toneClasses.accent}`}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0 pl-1">
          <div className="break-words text-[11px] font-semibold uppercase tracking-wide text-mute">
            {label}
          </div>
          <div className="mt-2 min-w-0 break-words font-display text-2xl font-semibold tabular-nums text-ink sm:text-3xl">
            {value}
          </div>
          {hint && <div className="mt-1 break-words text-xs text-mute">{hint}</div>}
        </div>
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ring-black/5 ${toneClasses.icon}`}>
          <Icon size={18} strokeWidth={2.2} />
        </div>
      </div>
    </div>
  );
}
