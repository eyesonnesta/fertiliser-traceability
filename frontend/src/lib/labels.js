// Human-readable labels for the four role codes used by the backend.
export const ROLE_LABELS = {
  national_supplier: 'National Supplier',
  depot_manager: 'Depot Manager',
  cooperative_official: 'Cooperative Official',
  system_administrator: 'System Administrator',
};

// Labels + colour intent for the stock lifecycle statuses.
export const STATUS_META = {
  registered: { label: 'Registered', tone: 'verify' },
  in_transit: { label: 'In transit', tone: 'clay' },
  received: { label: 'Received', tone: 'verify' },
  expired: { label: 'Expired', tone: 'alert' },
  recalled: { label: 'Recalled', tone: 'alert' },
};
