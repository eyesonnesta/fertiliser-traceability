const DEMO_DEPOTS = [
  'Nairobi Depot',
  'Nakuru Depot',
];

const DEMO_DEPOT_SET = new Set(DEMO_DEPOTS);

function isDemoDepot(value) {
  return DEMO_DEPOT_SET.has(String(value || '').trim());
}

function normalizeDemoDepot(value) {
  const depot = String(value || '').trim();
  return isDemoDepot(depot) ? depot : null;
}

module.exports = {
  DEMO_DEPOTS,
  isDemoDepot,
  normalizeDemoDepot,
};
