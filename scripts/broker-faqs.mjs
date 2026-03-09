function normQ(q) {
  return String(q || '')
    .toLowerCase()
    .replace(/[{()}[\].,!?/\\'"’“”]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function listOrFallback(arr, fallback) {
  const items = (arr || []).map((x) => String(x || '').trim()).filter(Boolean);
  return items.length ? items.join(', ') : fallback;
}

function safeMinDepositLabel(minDeposit) {
  const s = String(minDeposit || '').trim();
  return s || 'Varies by region, entity, and funding method';
}

export function ensureBrokerFaqs(broker) {
  const name = String(broker?.name || 'This broker').trim();
  const regs = listOrFallback(broker?.regulators, 'Varies by entity and jurisdiction');
  const plats = listOrFallback(broker?.platforms, 'Varies by region/entity');
  const minDep = safeMinDepositLabel(broker?.minDeposit);

  const required = [
    {
      q: `Is ${name} safe?`,
      a: `${name} can be safer when you onboard under a well-regulated entity and you verify the license on the regulator’s official register. Safety also depends on how withdrawals work for your country—start small, complete KYC early, and run a withdrawal test before scaling.`,
    },
    {
      q: `Is ${name} regulated?`,
      a: `${name} operates under different entities. Regulation depends on your country and the entity you sign up with. Regulators commonly mentioned include: ${regs}. Always verify the exact entity and license status on the regulator’s official register.`,
    },
    {
      q: 'What is the minimum deposit?',
      a: `Minimum deposit is often shown as ${minDep}, but it can vary by region, entity, account type, and funding method. Treat it as a starting point and confirm inside the broker’s client portal before funding.`,
    },
    {
      q: 'What platforms does it support?',
      a: `Platforms commonly listed include: ${plats}. Platform availability can vary by region/entity—confirm the exact platform list during sign-up or inside your account portal.`,
    },
    {
      q: 'Is it good for beginners?',
      a: `${name} can work for beginners if you use a demo first, start with a small deposit, and focus on risk controls (position sizing and stop-loss). Beginners should prioritize clear fees, stable platforms, and reliable withdrawals over bonuses or high leverage.`,
    },
  ];

  const existing = Array.isArray(broker?.faqs) ? broker.faqs : [];
  const seen = new Set(required.map((x) => normQ(x.q)));
  const extras = existing
    .filter((f) => f && f.q && f.a)
    .filter((f) => !seen.has(normQ(f.q)))
    .map((f) => ({ q: String(f.q).trim(), a: String(f.a).trim() }))
    .filter((f) => f.q && f.a);

  return [...required, ...extras];
}

