// Coloured status badge with an icon, keyed to the stock lifecycle.

import { CheckCircle2, Truck, PackageCheck, AlertTriangle, Ban } from 'lucide-react';

const META = {
  registered: { label: 'Registered', cls: 'bg-leaf-soft text-moss ring-leaf/20', Icon: CheckCircle2 },
  in_transit: { label: 'In transit', cls: 'bg-clay-soft text-clay ring-clay/20', Icon: Truck },
  received: { label: 'Received', cls: 'bg-leaf-soft text-moss ring-leaf/20', Icon: PackageCheck },
  expired: { label: 'Expired', cls: 'bg-wheat-soft text-wheat ring-wheat/25', Icon: AlertTriangle },
  recalled: { label: 'Recalled', cls: 'bg-alert-soft text-alert ring-alert/20', Icon: Ban },
};

export default function StatusBadge({ status }) {
  const m = META[status] || { label: status, cls: 'bg-canvas text-mute', Icon: CheckCircle2 };
  const { Icon } = m;
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${m.cls}`}
    >
      <Icon size={13} strokeWidth={2.2} />
      <span className="truncate">{m.label}</span>
    </span>
  );
}
