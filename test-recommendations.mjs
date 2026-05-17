// 5-user recommendation diversity test
// Each user buys different category products, then we verify recommendations differ contextually.

const BASE = 'http://localhost:3000';

const USERS = [
  { name: 'Alice Hair',   email: `alice${Date.now()}@test.com`,   password: 'pw', gender: 1, buys: { category: 'Hair', problemHint: 'hair-fall' } },
  { name: 'Bob Face',     email: `bob${Date.now()}@test.com`,     password: 'pw', gender: 0, buys: { category: 'Face', problemHint: 'anti-acne' } },
  { name: 'Cara Body',    email: `cara${Date.now()}@test.com`,    password: 'pw', gender: 1, buys: { category: 'Body', problemHint: 'dry-skin' } },
  { name: 'Dan Oral',     email: `dan${Date.now()}@test.com`,     password: 'pw', gender: 0, buys: { category: 'Oral', problemHint: 'gum-care' } },
  { name: 'Eva Mixed',    email: `eva${Date.now()}@test.com`,     password: 'pw', gender: 1, buys: { category: 'Face', problemHint: 'brightening' } },
];

async function api(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const txt = await res.text();
  try { return JSON.parse(txt); } catch { return txt; }
}

async function pickProduct(category, problemHint) {
  const products = await api(`/api/products?category=${category}`);
  const matching = products.filter(p =>
    (p.problem_tags || '').toLowerCase().includes(problemHint.toLowerCase())
  );
  return (matching.length ? matching : products)[0];
}

function summarize(recs) {
  return recs.slice(0, 6).map(r => `${r.pname} [${r.category}/${r.recommendation_rule}/${r.recommendation_score.toFixed(2)}]`);
}

function jaccard(a, b) {
  const sa = new Set(a), sb = new Set(b);
  const inter = [...sa].filter(x => sb.has(x)).length;
  const uni = new Set([...sa, ...sb]).size;
  return uni === 0 ? 0 : inter / uni;
}

async function main() {
  console.log('\n=== 5-USER RECOMMENDATION DIVERSITY TEST ===\n');

  const results = [];
  for (const u of USERS) {
    // register
    const reg = await api('/api/register', {
      method: 'POST',
      body: { name: u.name, email: u.email, password: u.password, gender: u.gender, phone: '555' },
    });
    if (reg.error) { console.error(`Register failed for ${u.name}:`, reg.error); continue; }

    const product = await pickProduct(u.buys.category, u.buys.problemHint);
    if (!product) { console.error(`No product for ${u.name}`); continue; }

    // buy it
    const purchase = await api('/api/purchase', {
      method: 'POST',
      body: {
        customer_id: reg.id,
        items: [{ id: product.id, name: product.pname, price: product.netprice, image: product.image, quantity: 1 }],
        total: product.netprice,
      },
    });

    // get recommendations
    const recs = await api(`/api/recommendations/${reg.id}?limit=8`);
    const recIds = recs.map(r => r.id);

    results.push({ user: u.name, bought: product.pname, boughtCat: product.category, recs, recIds });

    console.log(`👤 ${u.name} (id=${reg.id})`);
    console.log(`   Bought: ${product.pname} (${product.category}, $${product.netprice})`);
    console.log(`   Got ${recs.length} recommendations:`);
    summarize(recs).forEach(s => console.log('     -', s));

    // rule breakdown
    const ruleCounts = recs.reduce((m, r) => (m[r.recommendation_rule] = (m[r.recommendation_rule] || 0) + 1, m), {});
    console.log(`   Rules:`, ruleCounts);
    console.log('');
  }

  // === DIVERSITY ANALYSIS ===
  console.log('=== DIVERSITY ANALYSIS ===\n');
  for (let i = 0; i < results.length; i++) {
    for (let j = i + 1; j < results.length; j++) {
      const sim = jaccard(results[i].recIds, results[j].recIds);
      const same = results[i].recIds.filter(id => results[j].recIds.includes(id)).length;
      const pct = (sim * 100).toFixed(0);
      const flag = sim >= 0.5 ? ' ⚠️  TOO SIMILAR' : sim === 0 ? ' ✓ fully unique' : ' ✓ diverse';
      console.log(`${results[i].user.padEnd(15)} vs ${results[j].user.padEnd(15)}: ${same}/8 overlap (${pct}%)${flag}`);
    }
  }
  console.log('');

  // === RELEVANCE CHECK ===
  console.log('=== RELEVANCE CHECK (cross-sell + same-category) ===\n');
  for (const r of results) {
    const sameCat = r.recs.filter(x => x.category === r.boughtCat).length;
    const crossCat = r.recs.filter(x => x.category !== r.boughtCat).length;
    const flag = sameCat === 0 && crossCat === r.recs.length ? ' ⚠️ no related items'
               : sameCat === r.recs.length ? ' ⚠️ no cross-sell'
               : ' ✓ balanced mix';
    console.log(`${r.user.padEnd(15)} bought ${r.boughtCat.padEnd(4)} → same-cat: ${sameCat}, cross: ${crossCat}${flag}`);
  }
  console.log('');

  // === IDENTICAL RECOMMENDATION DETECTION ===
  const allIdSets = results.map(r => JSON.stringify(r.recIds));
  const uniqueSets = new Set(allIdSets);
  if (uniqueSets.size === 1) {
    console.log('❌ FAIL: All 5 users got IDENTICAL recommendations.');
  } else if (uniqueSets.size < results.length) {
    console.log(`⚠️  ${results.length - uniqueSets.size} user(s) share identical recommendation sets.`);
  } else {
    console.log(`✅ PASS: All ${results.length} users got unique recommendation sets.`);
  }

  return results;
}

main().catch(e => { console.error('TEST ERROR:', e); process.exit(1); });
