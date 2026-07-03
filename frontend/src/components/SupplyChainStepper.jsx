// The signature element: a Supplier -> Depot -> Cooperative progress
// tracker. `compact` renders inline pips for table rows; the full version
// renders a labelled stepper for the batch detail page.
//
// Which stage a batch is at is inferred from its status + current holder
// role. For Week 1 most stock sits at the Supplier; this comes alive in
// Week 2 when transfers move batches along.

const STAGES = [
  { key: 'supplier', label: 'Supplier' },
  { key: 'depot', label: 'Depot' },
  { key: 'cooperative', label: 'Cooperative' },
];

// Map a holder role to a stage index.
function stageFromRole(role) {
  if (role === 'depot_manager') return 1;
  if (role === 'cooperative_official') return 2;
  return 0; // national_supplier or unknown -> origin
}

export default function SupplyChainStepper({ holderRole, compact = false }) {
  const current = stageFromRole(holderRole);

  if (compact) {
    return (
      <div className="flex items-center gap-1" title="Supply chain position">
        {STAGES.map((s, i) => {
          const reached = i <= current;
          return (
            <div key={s.key} className="flex items-center gap-1">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  reached ? 'bg-moss' : 'bg-line'
                }`}
              />
              {i < STAGES.length - 1 && (
                <span
                  className={`h-px w-3 ${i < current ? 'bg-moss' : 'bg-line'}`}
                />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex min-w-0 items-center">
      {STAGES.map((s, i) => {
        const reached = i < current || (i === current);
        const passed = i < current;
        return (
          <div key={s.key} className="flex min-w-0 flex-1 items-center last:flex-none">
            <div className="flex min-w-0 flex-col items-center gap-1.5">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                  passed
                    ? 'bg-moss text-white'
                    : i === current
                      ? 'bg-leaf text-forest ring-4 ring-leaf-soft'
                      : 'bg-canvas text-mute ring-1 ring-line'
                }`}
              >
                {passed ? '\u2713' : i + 1}
              </div>
              <span
                className={`max-w-24 truncate text-xs ${
                  reached ? 'font-medium text-ink' : 'text-mute'
                }`}
              >
                {s.label}
              </span>
            </div>
            {i < STAGES.length - 1 && (
              <div className="mx-2 h-px flex-1 self-start mt-4 bg-line">
                <div
                  className={`h-full ${passed ? 'bg-moss' : 'bg-transparent'}`}
                  style={{ width: passed ? '100%' : '0%' }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
