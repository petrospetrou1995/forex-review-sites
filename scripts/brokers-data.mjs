import { BROKER_DB } from './brokers-db.mjs';

function uniq(arr) {
  const out = [];
  const seen = new Set();
  for (const x of arr || []) {
    const t = String(x || '').trim();
    if (!t) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

function toBroker(row) {
  const broker_name = String(row?.broker_name || '').trim();
  const slug = String(row?.slug || '').trim();
  if (!broker_name || !slug) return null;

  const deposit_methods = Array.isArray(row.deposit_methods) ? row.deposit_methods : [];
  const withdrawal_methods = Array.isArray(row.withdrawal_methods) ? row.withdrawal_methods : [];

  return {
    // Database required fields (kept for reference / future tooling)
    broker_name,
    rating: Number(row.rating ?? 0),
    regulation: Array.isArray(row.regulation) ? row.regulation : [],
    spreads: String(row.spreads || '').trim(),
    minimum_deposit: String(row.minimum_deposit || '').trim(),
    trading_platforms: Array.isArray(row.trading_platforms) ? row.trading_platforms : [],
    deposit_methods,
    withdrawal_methods,
    pros: Array.isArray(row.pros) ? row.pros : [],
    cons: Array.isArray(row.cons) ? row.cons : [],

    // Backward compatible fields used across generator scripts
    name: broker_name,
    slug,
    website: String(row.website || '').trim() || '#',
    ratingValue: Number(row.rating ?? 0) || 4.5,
    minDeposit: String(row.minimum_deposit || '').trim() || 'Varies',
    regulators: Array.isArray(row.regulation) ? row.regulation : [],
    platforms: Array.isArray(row.trading_platforms) ? row.trading_platforms : [],
    comparison: {
      spreads: String(row.spreads || '').trim() || 'Varies',
      fees: String(row.comparison_fees || '').trim() || 'Varies by account and instrument',
    },
    // These sections can be expanded later with more granular DB fields.
    spreadsFees: Array.isArray(row.spreads_fees_notes) && row.spreads_fees_notes.length
      ? row.spreads_fees_notes
      : [
          'Compare the all-in cost (spread + commission + swaps/financing) for the pairs you actually trade.',
          'Costs can differ by account type and entity—confirm inside your portal before funding large amounts.',
          'Run a small live test to observe spread widening and execution during volatility.',
        ],
    depositWithdrawals: [
      `Deposit methods: ${uniq(deposit_methods).join(', ') || 'Varies by entity/country.'}`,
      `Withdrawal methods: ${uniq(withdrawal_methods).join(', ') || 'Varies by entity/country.'}`,
      'Verify fees, typical processing time, and complete a small withdrawal test early.',
    ],
    countriesAccepted: Array.isArray(row.countries_accepted) && row.countries_accepted.length
      ? row.countries_accepted
      : ['Varies by entity and jurisdiction.', 'Confirm availability for your country during sign-up.'],
    verdict: String(row.verdict || '').trim() || `${broker_name} can be a practical shortlist candidate. Verify the exact regulated entity for your country, compare all-in costs, and test withdrawals before scaling.`,
    faqs: Array.isArray(row.faqs) ? row.faqs : [],
  };
}

export const BROKERS = BROKER_DB.map(toBroker).filter(Boolean);

