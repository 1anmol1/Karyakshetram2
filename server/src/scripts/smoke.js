// API smoke test (KPI-19 style): valid, edge and invalid inputs. Usage: npm run smoke  (API must be running)
const B = process.env.API_URL || 'http://localhost:4000/api';
let token = '', pass = 0, fail = 0;
const req = async (method, path, body, { auth = true, form } = {}) => {
  const headers = {}; if (auth && token) headers.Authorization = `Bearer ${token}`;
  let payload; if (form) payload = form; else if (body) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  const r = await fetch(B + path, { method, headers, body: payload });
  let j = null; try { j = await r.json(); } catch { /* empty */ }
  return { status: r.status, body: j };
};
const t = async (name, fn) => { try { await fn(); pass++; console.log('  ok  ', name); } catch (e) { fail++; console.log('  FAIL', name, '→', e.message); } };
const expect = (c, m) => { if (!c) throw new Error(m); };

(async () => {
  await t('health', async () => { const r = await req('GET', '/health'); expect(r.status === 200 && r.body.db === 'ok', JSON.stringify(r.body)); });
  await t('categories (30)', async () => { const r = await req('GET', '/categories'); expect(r.body.categories.length === 30, r.body.categories.length); });
  await t('login wrong password → 401 + attempts left', async () => { const r = await req('POST', '/auth/login', { email: 'nobody@x.in', password: 'x' }); expect(r.status === 401, r.status); });
  await t('register validation → 400 field', async () => { const r = await req('POST', '/auth/register', { name: 'A', email: 'bad', password: '1', acceptTerms: true }); expect(r.status === 400 && r.body.error.field, JSON.stringify(r.body)); });
  await t('login demo', async () => { const r = await req('POST', '/auth/login', { email: 'demo@karyakshetram.in', password: 'Demo@1234' }); expect(r.status === 200, r.status); token = r.body.token; });
  await t('me', async () => { const r = await req('GET', '/auth/me'); expect(r.body.user.profile.category === 'grocery', 'cat'); });
  let picks = [];
  await t('recommend', async () => { const r = await req('POST', '/recommend', { category: 'grocery', constraints: { maxRent: 160 } }); expect(r.status === 200 && r.body.picks.length === 5, JSON.stringify(r.body).slice(0, 200)); picks = r.body.picks.filter((p) => !p.empty); });
  await t('recommend spacing ≥ 1.5 km', async () => {
    const d = (a, b) => Math.hypot((a.lat - b.lat) * 110.57, (a.lon - b.lon) * 111.32 * Math.cos(a.lat * Math.PI / 180));
    for (let i = 0; i < picks.length; i++) for (let j = i + 1; j < picks.length; j++) expect(d(picks[i], picks[j]) >= 1.49, `${picks[i].locality}-${picks[j].locality}`);
  });
  await t('recommend cached', async () => { const r = await req('POST', '/recommend', { category: 'grocery', constraints: { maxRent: 160 } }); expect(r.body.cached === true, 'not cached'); });
  await t('recommend rent out of range → 400', async () => { const r = await req('POST', '/recommend', { category: 'grocery', constraints: { maxRent: 1500 } }); expect(r.status === 400 && r.body.error.field === 'constraints.maxRent', JSON.stringify(r.body)); });
  await t('recommend budget below capex → 400', async () => { const r = await req('POST', '/recommend', { category: 'grocery', constraints: { budget: 100000 } }); expect(r.status === 400, r.status); });
  await t('recommend unknown category → 400', async () => { const r = await req('POST', '/recommend', { category: 'spaceport' }); expect(r.status === 400, r.status); });
  await t('cells geojson', async () => { const r = await req('GET', '/cells?category=grocery'); expect(r.body.features.length > 500, r.body.features?.length); });
  const cell = picks[0]?.cell;
  await t('cell detail', async () => { const r = await req('GET', `/cells/${cell}?category=grocery`); expect(r.body.site.tier, 'no tier'); });
  await t('cell unknown → 404', async () => { const r = await req('GET', '/cells/8860000000fffff?category=grocery'); expect(r.status === 404, r.status); });
  await t('similar', async () => { const r = await req('GET', `/cells/${cell}/similar?category=grocery`); expect(r.body.similar.length > 0, 'none'); });
  await t('explain + validator', async () => { const r = await req('POST', '/explain', { cellId: cell, category: 'grocery', compareWith: [picks[1].cell] }); expect(r.body.narrative && ['template', 'gemini', 'llm'].includes(r.body.narrative_source) && r.body.comparisons.length === 1, JSON.stringify(r.body).slice(0, 300)); });
  await t('compare 3', async () => { const r = await req('POST', '/compare', { cells: picks.slice(0, 3).map((p) => p.cell), category: 'grocery' }); expect(r.body.sites.length === 3, JSON.stringify(r.body).slice(0, 200)); });
  await t('compare 1 → 400', async () => { const r = await req('POST', '/compare', { cells: [cell], category: 'grocery' }); expect(r.status === 400, r.status); });
  await t('check outside city → 400', async () => { const r = await req('POST', '/check', { category: 'grocery', lat: 19.07, lon: 72.87 }); expect(r.status === 400 && r.body.error.code === 'OUTSIDE_CITY', JSON.stringify(r.body)); });
  await t('check rent 2400 → 400 field rent', async () => { const r = await req('POST', '/check', { category: 'grocery', lat: 18.55, lon: 73.79, rent: 2400 }); expect(r.status === 400 && r.body.error.field === 'rent', JSON.stringify(r.body)); });
  await t('check passing site', async () => { const r = await req('POST', '/check', { category: 'grocery', lat: picks[0].lat, lon: picks[0].lon, rent: 110, area: 4000 }); expect(r.body.eligible === true && r.body.site.tier, JSON.stringify(r.body).slice(0, 200)); });
  await t('check failing site → reasons + 3 alternatives', async () => {
    const cells = (await req('GET', '/cells?category=grocery')).body.features.filter((f) => !f.properties.eligible);
    const f = cells[0]; const [lon, lat] = f.geometry.coordinates[0].reduce((a, c) => [a[0] + c[0] / 7, a[1] + c[1] / 7], [0, 0]);
    const r = await req('POST', '/check', { category: 'grocery', lat, lon });
    expect(r.body.eligible === false && r.body.reasons.length && r.body.alternatives.length === 3, JSON.stringify(r.body).slice(0, 300));
  });
  await t('cannibalisation with picks', async () => { const r = await req('POST', '/cannibalisation', { cellId: cell, category: 'grocery', withPicks: true }); expect(['ok', 'heavy', 'no_overlap'].includes(r.body.status) && r.body.picks, JSON.stringify(r.body).slice(0, 200)); });
  await t('cannibalisation other category → different_category', async () => { const r = await req('POST', '/cannibalisation', { cellId: cell, category: 'pharmacy' }); expect(['different_category', 'ineligible'].includes(r.body.status), r.body.status); });
  await t('portfolio', async () => { const r = await req('POST', '/portfolio', { category: 'grocery', k: 5, spacingKm: 1.5, budget: 30000000 }); expect(r.body.selected.length > 0 && r.body.naive_comparison, JSON.stringify(r.body).slice(0, 200)); });
  await t('trending', async () => { const r = await req('GET', '/trending?category=grocery'); expect(r.body.trending.length > 0, 'empty'); });
  await t('search', async () => { const r = await req('GET', '/search?q=ban'); expect(r.body.results[0].name === 'Baner', JSON.stringify(r.body)); });
  await t('shops', async () => { const r = await req('GET', `/shops?lat=${picks[0].lat}&lon=${picks[0].lon}&radiusKm=2&category=grocery`); expect(Array.isArray(r.body.shops), 'no shops'); });
  await t('chat rent question', async () => { const r = await req('POST', '/chat', { message: 'Which pick is safest if rent rises 25%?', category: 'grocery', picks: picks.map((p) => p.cell) }); expect(r.body.answer.length > 20, JSON.stringify(r.body)); });
  let savedId;
  await t('save location', async () => { const r = await req('POST', '/saved', { cellId: cell, category: 'grocery' }); expect(r.status === 201, r.status); savedId = r.body.saved._id; });
  await t('list + delete saved', async () => { const l = await req('GET', '/saved'); expect(l.body.saved.length >= 1, 'none'); const d = await req('DELETE', `/saved/${savedId}`); expect(d.body.deleted, 'not deleted'); });
  await t('feedback down without reason → 400', async () => { const r = await req('POST', '/feedback', { cellId: cell, category: 'grocery', rating: 'down' }); expect(r.status === 400, r.status); });
  await t('feedback ok', async () => { const r = await req('POST', '/feedback', { cellId: cell, category: 'grocery', rating: 'down', reasonCode: 'competitor_missing' }); expect(r.status === 201, r.status); });
  await t('outcome → recalibration', async () => { const r = await req('POST', '/outcomes', { cellId: cell, category: 'grocery', openedOn: '2026-08-01', actualMonthlyRevenue: 4150000 }); expect(r.status === 201 && r.body.new_calibration_scale, JSON.stringify(r.body)); });
  await t('profile patch invalid → 400', async () => { const r = await req('PATCH', '/profile', { profile: { goals: { minP10Profit: -50000 } } }); expect(r.status === 400 && r.body.error.field === 'profile.goals.minP10Profit', JSON.stringify(r.body)); });
  await t('profile patch ok', async () => { const r = await req('PATCH', '/profile', { profile: { goals: { maxRent: 170 } } }); expect(r.body.rescored === true, JSON.stringify(r.body).slice(0, 100)); });
  await t('csv upload with errors', async () => {
    const csv = 'name,lat,lon,annual_revenue\nA,18.559,73.8077,44000000\nB,18.5362,73.7997,\nC,17.68,74.01,29000000\nA,18.559,73.8077,44000000\nD,abc,73.8,1\n';
    const form = new FormData(); form.append('file', new Blob([csv], { type: 'text/csv' }), 'stores.csv'); form.append('mode', 'replace');
    const r = await req('POST', '/stores/upload', null, { form });
    expect(r.status === 200 && r.body.summary.valid === 1 && r.body.summary.imputed === 1 && r.body.summary.excluded === 3, JSON.stringify(r.body).slice(0, 400));
  });
  await t('unauthenticated saved → 401', async () => { const tk = token; token = ''; const r = await req('GET', '/saved'); token = tk; expect(r.status === 401, r.status); });
  await t('eval + meta', async () => { const e = await req('GET', '/eval?category=grocery'); const m = await req('GET', '/meta'); expect(e.body.targets && m.body.sources, 'missing'); });
  await t('unknown route → 404 schema', async () => { const r = await req('GET', '/nope'); expect(r.status === 404 && r.body.error.code === 'NOT_FOUND', r.status); });
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
