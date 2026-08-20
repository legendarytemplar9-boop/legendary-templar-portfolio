// ── Test harness: runs inside the real page, results into <pre id="testout"> ──
(function () {
  const L = [];
  let pass = 0, fail = 0;
  function ok(name, cond, extra) {
    if (cond) { pass++; L.push('  ok   ' + name); }
    else { fail++; L.push('  FAIL ' + name + (extra ? '  → ' + extra : '')); }
  }
  function eq(name, got, want) {
    const g = JSON.stringify(got), w = JSON.stringify(want);
    ok(name, g === w, 'got ' + g + ' want ' + w);
  }
  function sec(t) { L.push(''); L.push('── ' + t + ' ──'); }

  const TODAY = new Date().toISOString().split('T')[0];

  // ══════════════════ number / date helpers ══════════════════
  sec('ppNum / ppDate');
  eq('ppNum plain', ppNum('245.50'), 245.5);
  eq('ppNum commas', ppNum('1,500'), 1500);
  eq('ppNum baht sign', ppNum('฿1,234.5'), 1234.5);
  eq('ppNum spaces', ppNum(' 42 '), 42);
  eq('ppNum text → null', ppNum('ADVANC'), null);
  eq('ppNum empty → null', ppNum(''), null);
  eq('ppNum date-like → null', ppNum('2026-08-12'), null);
  eq('ppNum zero', ppNum('0'), 0);

  eq('ppDate iso', ppDate('2026-08-12'), '2026-08-12');
  eq('ppDate dd/mm/yyyy', ppDate('12/08/2026'), '2026-08-12');
  eq('ppDate dd-mm-yyyy', ppDate('1-2-2026'), '2026-02-01');
  eq('ppDate Thai BE year', ppDate('12/08/2569'), '2026-08-12');
  eq('ppDate Thai BE iso', ppDate('2569-08-12'), '2026-08-12');
  eq('ppDate bad month', ppDate('2026-13-01'), null);
  eq('ppDate not a date', ppDate('500'), null);
  eq('ppDate junk', ppDate('ADVANC'), null);

  eq('ppStripThousands single', ppStripThousands('1,500'), '1500');
  eq('ppStripThousands double', ppStripThousands('1,234,567'), '1234567');
  eq('ppStripThousands in pipe row', ppStripThousands('A | 1,500 | 2'), 'A | 1500 | 2');
  eq('ppStripThousands baht', ppStripThousands('฿1,234.50'), '฿1234.50');
  // Commas that are field delimiters must survive — "1500,245.5" is two fields,
  // not a badly grouped number.
  eq('ppStripThousands keeps csv delims', ppStripThousands('ADVANC,1500,245.5,251'), 'ADVANC,1500,245.5,251');
  eq('ppStripThousands ambiguous csv left alone', ppStripThousands('A,1,500,2'), 'A,1,500,2');

  // ══════════════════ splitting ══════════════════
  sec('ppSplit');
  eq('split pipe', ppSplit('A | 1 | 2'), ['A', '1', '2']);
  eq('split tab', ppSplit('A\t1\t2'), ['A', '1', '2']);
  eq('split comma', ppSplit('A,1,2'), ['A', '1', '2']);
  eq('split spaces', ppSplit('A   1  2'), ['A', '1', '2']);
  eq('split single space', ppSplit('A 1 2'), ['A', '1', '2']);
  eq('split markdown row', ppSplit('| A | 1 | 2 |'), ['A', '1', '2']);

  // ══════════════════ parser ══════════════════
  sec('parsePortfolioPaste — happy paths');
  let r = parsePortfolioPaste('ADVANC | 500 | 245.50 | 251.00');
  eq('one full row', r.rows, [{ ticker: 'ADVANC', shares: 500, avg_cost: 245.5, price: 251, date: null }]);
  eq('no errors', r.errors, []);

  r = parsePortfolioPaste('ADVANC | 500 | 245.50');
  eq('price omitted → null', r.rows[0].price, null);

  r = parsePortfolioPaste('#วันที่ 2026-08-01\nADVANC | 500 | 245.5\nBDMS | 1000 | 22.5 | 24.1');
  eq('default date directive', r.defaultDate, '2026-08-01');
  eq('two rows parsed', r.rows.length, 2);
  eq('second row price', r.rows[1].price, 24.1);

  r = parsePortfolioPaste('ADVANC | 500 | 245.5 | 251 | 2026-07-01');
  eq('per-row date', r.rows[0].date, '2026-07-01');
  eq('per-row date does not eat price', r.rows[0].price, 251);

  r = parsePortfolioPaste('ADVANC\t1,500\t245.50\t251.00');
  eq('tab + thousands', r.rows[0].shares, 1500);

  r = parsePortfolioPaste('ADVANC,1500,245.5,251');
  eq('csv', r.rows[0], { ticker: 'ADVANC', shares: 1500, avg_cost: 245.5, price: 251, date: null });

  r = parsePortfolioPaste('advanc | 500 | 245.5');
  eq('ticker uppercased', r.rows[0].ticker, 'ADVANC');

  r = parsePortfolioPaste('MSFT80 | 100 | 80.5 | 92');
  eq('DR ticker accepted', r.rows[0].ticker, 'MSFT80');

  sec('parsePortfolioPaste — messy input Claude might emit');
  r = parsePortfolioPaste('```\nADVANC | 500 | 245.5\n```');
  eq('code fences stripped', r.rows.length, 1);

  r = parsePortfolioPaste('| หุ้น | จำนวน | ต้นทุน |\n|---|---|---|\n| ADVANC | 500 | 245.5 |');
  eq('markdown table rows', r.rows.length, 1);
  eq('markdown table no errors', r.errors, []);

  r = parsePortfolioPaste('ticker | shares | cost\nADVANC | 500 | 245.5');
  eq('english header skipped', r.rows.length, 1);
  eq('english header silent', r.errors, []);

  r = parsePortfolioPaste('\n\n  ADVANC | 500 | 245.5  \n\n');
  eq('blank lines ignored', r.rows.length, 1);

  r = parsePortfolioPaste('2026-08-05\nADVANC | 500 | 245.5');
  eq('bare date line sets default', r.defaultDate, '2026-08-05');
  eq('bare date line not a row', r.rows.length, 1);

  r = parsePortfolioPaste('# ราคาจากรูป ณ 12/08/2569\nADVANC | 500 | 245.5');
  eq('BE date inside comment', r.defaultDate, '2026-08-12');

  r = parsePortfolioPaste('ADVANC | 500 | 245.5\nADVANC | 700 | 250');
  eq('duplicate ticker → last wins', r.rows.length, 1);
  eq('duplicate value', r.rows[0].shares, 700);
  ok('duplicate warned', r.errors.length === 1 && /ซ้ำ/.test(r.errors[0]), JSON.stringify(r.errors));

  sec('parsePortfolioPaste — bad input');
  r = parsePortfolioPaste('ADVANC | 500');
  eq('missing cost → no row', r.rows.length, 0);
  ok('missing cost errors', r.errors.length === 1, JSON.stringify(r.errors));

  r = parsePortfolioPaste('ADVANC');
  eq('lone ticker → no row', r.rows.length, 0);
  ok('lone ticker errors', r.errors.length === 1);

  r = parsePortfolioPaste('ชื่อหุ้นยาวมากเกินไป | 500 | 245.5');
  eq('non-ascii ticker rejected', r.rows.length, 0);
  ok('non-ascii ticker errors', r.errors.length === 1, JSON.stringify(r.errors));

  r = parsePortfolioPaste('ADVANC | -500 | 245.5');
  eq('negative rejected', r.rows.length, 0);

  eq('empty input', parsePortfolioPaste('').rows, []);
  eq('whitespace input', parsePortfolioPaste('   \n  ').rows, []);

  sec('parsePortfolioPaste — JSON fallback');
  r = parsePortfolioPaste('[{"ticker":"ADVANC","shares":500,"avg_cost":245.5,"price":251}]');
  eq('json array', r.rows[0], { ticker: 'ADVANC', shares: 500, avg_cost: 245.5, price: 251, date: null });

  r = parsePortfolioPaste('{"date":"2026-08-01","stocks":[{"symbol":"BDMS","qty":1000,"cost":22.5}]}');
  eq('json stocks + aliases', r.rows[0], { ticker: 'BDMS', shares: 1000, avg_cost: 22.5, price: null, date: null });
  eq('json top-level date', r.defaultDate, '2026-08-01');

  r = parsePortfolioPaste('{ not json at all');
  eq('bad json falls back to lines', r.rows.length, 0);
  ok('bad json reports error', r.errors.length > 0);

  // ══════════════════ sorting ══════════════════
  sec('sorting');
  S.registry = {
    portfolio_name: 'T', last_updated: TODAY, stocks: [
      // ticker, shares, avg_cost, current_price → cost / value / pl
      { ticker: 'BBB', shares: 100, avg_cost: 10, current_price: 12, thesis_score: 82 }, // cost 1000 val 1200 pl +200
      { ticker: 'AAA', shares: 100, avg_cost: 50, current_price: 45, thesis_score: 55 }, // cost 5000 val 4500 pl -500
      { ticker: 'CCC', shares: 200, avg_cost: 20, current_price: 30, thesis_score: 70 }, // cost 4000 val 6000 pl +2000
      { ticker: 'ZZZ', shares: 0, avg_cost: 0, thesis_score: 91 }                        // watch only → 0 across the board
    ]
  };
  S.kb = { score_history: {}, catalyst_log: {}, guidance_tracker: {}, evidence_clips: [], value_history: [] };

  const tickersBy = (key, dir) => { S.plSort = { key, dir }; return sortedStockRows().map(s => s.ticker); };
  // The list is now the ONLY place stocks appear, so watch-only ones must be in it.
  eq('includes watch-only', tickersBy('value', 'desc').includes('ZZZ'), true);
  eq('lists every stock', tickersBy('value', 'desc').length, 4);
  eq('value desc', tickersBy('value', 'desc'), ['CCC', 'AAA', 'BBB', 'ZZZ']);
  eq('value asc', tickersBy('value', 'asc'), ['ZZZ', 'BBB', 'AAA', 'CCC']);
  eq('cost desc', tickersBy('cost', 'desc'), ['AAA', 'CCC', 'BBB', 'ZZZ']);
  eq('cost asc', tickersBy('cost', 'asc'), ['ZZZ', 'BBB', 'CCC', 'AAA']);
  eq('pl desc', tickersBy('pl', 'desc'), ['CCC', 'BBB', 'ZZZ', 'AAA']);
  eq('pl asc', tickersBy('pl', 'asc'), ['AAA', 'ZZZ', 'BBB', 'CCC']);
  eq('score desc', tickersBy('score', 'desc'), ['ZZZ', 'BBB', 'CCC', 'AAA']);
  eq('score asc', tickersBy('score', 'asc'), ['AAA', 'CCC', 'BBB', 'ZZZ']);
  eq('ticker asc', tickersBy('ticker', 'asc'), ['AAA', 'BBB', 'CCC', 'ZZZ']);
  eq('ticker desc', tickersBy('ticker', 'desc'), ['ZZZ', 'CCC', 'BBB', 'AAA']);

  eq('stats value', plRowStats(S.registry.stocks[0]).value, 1200);
  eq('stats pl', plRowStats(S.registry.stocks[1]).pl, -500);
  eq('stats pct', Math.round(plRowStats(S.registry.stocks[2]).pct), 50);
  eq('stats score', plRowStats(S.registry.stocks[3]).score, 91);
  eq('no price → value falls back to cost', plRowStats({ shares: 10, avg_cost: 5 }).value, 50);
  eq('watch-only stats are zero, not NaN', plRowStats({ ticker: 'W' }), { cost: 0, hasP: false, value: 0, pl: 0, pct: 0, score: 0 });

  // tie-break stability
  S.registry.stocks = [
    { ticker: 'DDD', shares: 10, avg_cost: 10, current_price: 10, thesis_score: 70 },
    { ticker: 'AAA', shares: 10, avg_cost: 10, current_price: 10, thesis_score: 70 }
  ];
  eq('ties break alphabetically', tickersBy('value', 'desc'), ['AAA', 'DDD']);
  eq('score ties break alphabetically', tickersBy('score', 'desc'), ['AAA', 'DDD']);

  sec('setPlSort toggle');
  S.plSort = { key: 'value', dir: 'desc' };
  setPlSort('value'); eq('same key flips to asc', S.plSort, { key: 'value', dir: 'asc' });
  setPlSort('value'); eq('flips back to desc', S.plSort, { key: 'value', dir: 'desc' });
  setPlSort('ticker'); eq('ticker defaults asc', S.plSort, { key: 'ticker', dir: 'asc' });
  setPlSort('pl'); eq('money defaults desc', S.plSort, { key: 'pl', dir: 'desc' });
  setPlSort('cost'); eq('cost defaults desc', S.plSort, { key: 'cost', dir: 'desc' });
  setPlSort('score'); eq('score defaults desc', S.plSort, { key: 'score', dir: 'desc' });
  setPlSort('cost');
  ok('sort persisted to localStorage',
    JSON.parse(localStorage.getItem('lt_portfolio_v1') || '{}').plSort?.key === 'cost');

  // ══════════════════ apply (offline) ══════════════════
  sec('applyPastePort');
  S.offline = true; S.accessToken = null;
  S.registry = {
    portfolio_name: 'T', last_updated: TODAY,
    stocks: [{ ticker: 'BDMS', company: 'Bangkok Dusit', sector: 'Healthcare', avg_cost: 22.5, shares: 1000, thesis_score: 75, thesis_status: '🟢', catalysts: [], thesis_breakers: [] }]
  };
  S.kb = { score_history: { BDMS: [{ date: '2026-01-01', score: 75, delta: 0, reason: 'baseline' }] }, catalyst_log: { BDMS: [] }, guidance_tracker: { BDMS: [] }, evidence_clips: [], value_history: [] };

  document.getElementById('pastePortText').value =
    '#วันที่ 2026-08-10\nBDMS | 1200 | 23.10 | 24.50\nADVANC | 500 | 245.50 | 251.00';
  previewPastePort();
  eq('preview parsed 2', S.pasteParsed.rows.length, 2);
  ok('apply button enabled', document.getElementById('pastePortApply').disabled === false);
  ok('preview shows both tickers', /BDMS/.test(document.getElementById('pastePortPreview').innerHTML) &&
     /ADVANC/.test(document.getElementById('pastePortPreview').innerHTML));
  ok('preview marks new vs updated',
     /pp-tag new/.test(document.getElementById('pastePortPreview').innerHTML) &&
     /pp-tag upd/.test(document.getElementById('pastePortPreview').innerHTML));

  applyPastePort();

  const bdms = S.registry.stocks.find(s => s.ticker === 'BDMS');
  const adv = S.registry.stocks.find(s => s.ticker === 'ADVANC');
  eq('existing shares updated', bdms.shares, 1200);
  eq('existing cost updated', bdms.avg_cost, 23.1);
  eq('existing price updated', bdms.current_price, 24.5);
  eq('existing position_date', bdms.position_date, '2026-08-10');
  ok('past date → noon timestamp', bdms.price_updated === '2026-08-10T12:00:00.000Z', bdms.price_updated);
  eq('existing company preserved', bdms.company, 'Bangkok Dusit');
  eq('existing sector preserved', bdms.sector, 'Healthcare');
  eq('existing score preserved', bdms.thesis_score, 75);
  eq('existing score_history untouched', S.kb.score_history.BDMS.length, 1);

  ok('new stock created', !!adv);
  eq('new stock shares', adv.shares, 500);
  eq('new stock cost', adv.avg_cost, 245.5);
  eq('new stock price', adv.current_price, 251);
  eq('new stock default score', adv.thesis_score, 70);
  eq('new stock has arrays', [Array.isArray(adv.catalysts), Array.isArray(adv.thesis_breakers)], [true, true]);
  eq('new stock kb score_history seeded', S.kb.score_history.ADVANC.length, 1);
  eq('new stock kb catalyst_log seeded', S.kb.catalyst_log.ADVANC, []);
  eq('modal closed', document.getElementById('pastePortModal').classList.contains('hidden'), true);

  // value snapshot backfilled at the pasted date
  const vh = S.kb.value_history;
  eq('snapshot recorded', vh.length, 1);
  eq('snapshot at pasted date', vh[0].date, '2026-08-10');
  // 1200*24.5 + 500*251 = 29400 + 125500 = 154900 ; cost 1200*23.1 + 500*245.5 = 27720 + 122750 = 150470
  eq('snapshot value', vh[0].value, 154900);
  eq('snapshot cost', vh[0].cost, 150470);

  sec('recordValueSnapshotFor');
  S.kb.value_history = [{ date: '2026-08-01', value: 1, cost: 1 }, { date: '2026-08-20', value: 3, cost: 3 }];
  recordValueSnapshotFor('2026-08-10');
  eq('inserted in date order', S.kb.value_history.map(e => e.date), ['2026-08-01', '2026-08-10', '2026-08-20']);
  recordValueSnapshotFor('2026-08-10');
  eq('same date upserts, no dupe', S.kb.value_history.length, 3);

  sec('applyPastePort — no price given');
  S.registry = { portfolio_name: 'T', last_updated: TODAY, stocks: [] };
  S.kb = { score_history: {}, catalyst_log: {}, guidance_tracker: {}, evidence_clips: [], value_history: [] };
  document.getElementById('pastePortText').value = 'HANA | 2000 | 38';
  previewPastePort();
  applyPastePort();
  const hana = S.registry.stocks.find(s => s.ticker === 'HANA');
  eq('shares set', hana.shares, 2000);
  eq('cost set', hana.avg_cost, 38);
  eq('no current_price invented', hana.current_price, undefined);
  eq('date defaults to today', hana.position_date, TODAY);
  eq('unpriced → no snapshot', S.kb.value_history.length, 0);

  sec('applyPastePort — price does not clobber on later paste without price');
  S.registry.stocks[0].current_price = 40;
  S.registry.stocks[0].price_updated = '2026-08-01T00:00:00.000Z';
  document.getElementById('pastePortText').value = 'HANA | 2500 | 39';
  previewPastePort();
  applyPastePort();
  eq('shares re-updated', S.registry.stocks[0].shares, 2500);
  eq('old price kept', S.registry.stocks[0].current_price, 40);

  sec('prompt template');
  S.registry.stocks = [{ ticker: 'HANA', shares: 1, avg_cost: 1 }, { ticker: 'BDMS', shares: 1, avg_cost: 1 }];
  const prompt = buildPastePortPrompt();
  ok('prompt names the format', /TICKER \| จำนวนหุ้น \| ต้นทุนเฉลี่ยต่อหุ้น \| ราคาตลาดต่อหุ้น/.test(prompt));
  ok('prompt carries today', prompt.includes(TODAY));
  ok('prompt lists owned tickers', /HANA, BDMS/.test(prompt));
  ok('prompt forbids commas', /ห้ามมีคอมมา/.test(prompt));
  // The template Claude is told to emit must round-trip through our own parser.
  const sample = '#วันที่ ' + TODAY + '\nHANA | 2000 | 38.00 | 35.75\nBDMS | 1000 | 22.50 | 24.10';
  const rt = parsePortfolioPaste(sample);
  eq('template round-trips: rows', rt.rows.length, 2);
  eq('template round-trips: no errors', rt.errors, []);
  eq('template round-trips: date', rt.defaultDate, TODAY);

  sec('render smoke test — the unified row list');
  S.registry = {
    portfolio_name: 'T', last_updated: TODAY, stocks: [
      { ticker: 'AAA', company: 'Alpha Co', sector: 'Tech', shares: 100, avg_cost: 10, current_price: 12, thesis_score: 78, thesis_status: '🟢', notes: 'a note', catalysts: [{ event: 'launch', status: 'in_progress' }], thesis_breakers: [] },
      { ticker: 'BBB', company: 'Beta Co', sector: 'Bank', shares: 50, avg_cost: 20, current_price: 18, thesis_score: 64, thesis_status: '🟡', notes: '', catalysts: [], thesis_breakers: [] },
      { ticker: 'WWW', company: 'Watch Co', sector: 'Food', shares: 0, avg_cost: 0, thesis_score: 70, thesis_status: '🟡', notes: '', catalysts: [], thesis_breakers: [] }
    ]
  };
  S.kb = {
    score_history: { AAA: [{ date: '2026-01-01', score: 70, delta: 0, reason: 'x' }, { date: '2026-02-01', score: 74, delta: 4, reason: 'x' }, { date: '2026-03-01', score: 78, delta: 4, reason: 'x' }] },
    catalyst_log: {}, guidance_tracker: {}, evidence_clips: [], value_history: []
  };
  S.plSort = { key: 'ticker', dir: 'asc' };
  S.stGroup = 'none';   // this section is about the row itself; grouping has its own
  try {
    renderMoneyDashboard();
    const rowsEl = document.getElementById('plRows');
    const rows = () => [...document.getElementById('plRows').querySelectorAll('.st-row')];
    ok('a row per stock incl. watch-only', rows().length === 3, rows().length);
    eq('rows in ticker order', rows().map(r => r.dataset.ticker), ['AAA', 'BBB', 'WWW']);

    // ── everything the old card showed must survive in the row ──
    const aaa = rows()[0];
    ok('row shows score', /\b78\b/.test(aaa.querySelector('.st-score').textContent));
    ok('score is colour-coded', aaa.querySelector('.st-score').classList.contains('g'));
    ok('row shows status emoji', aaa.querySelector('.st-emoji').textContent.length > 0);
    ok('row shows company + sector', /Alpha Co · Tech/.test(aaa.querySelector('.st-sub').textContent));
    ok('row has a sparkline canvas', !!aaa.querySelector('canvas[id="spark_AAA"]'));
    ok('row shows trend chip', /Up|Down|Stable/.test(aaa.querySelector('.chips').textContent));
    ok('row shows delta chip', /Δ/.test(aaa.querySelector('.chips').textContent));
    ok('row shows notes', /a note/.test(aaa.querySelector('.c-notes').textContent));
    ok('row shows catalysts', /launch/.test(aaa.querySelector('.cat-strip').textContent));
    ok('row has 3 actions', aaa.querySelectorAll('.st-acts .st-act').length === 3, aaa.querySelectorAll('.st-acts .st-act').length);

    // ── money columns ──
    ok('row shows value', /฿1,200/.test(aaa.querySelector('.st-money').textContent), aaa.querySelector('.st-money').textContent);
    ok('row shows baht P/L', /\+฿200/.test(aaa.querySelector('.st-money').textContent));
    ok('row shows percent', /20\.00%/.test(aaa.querySelector('.st-money').textContent));
    ok('row shows qty and cost', /100 × ฿12 · ทุน ฿1,000/.test(aaa.querySelector('.st-qty').textContent), aaa.querySelector('.st-qty').textContent);
    ok('watch-only row says Watch only', /Watch only/.test(rows()[2].querySelector('.st-money').textContent));
    ok('watch-only row has no fake value', !/฿/.test(rows()[2].querySelector('.st-money').textContent));

    // ── the old card grid is gone ──
    ok('#stockGrid removed from the page', document.getElementById('stockGrid') === null);
    ok('no .card elements left', document.querySelectorAll('.card').length === 0);

    // ── hero + charts kept ──
    ok('hero still rendered', !!document.querySelector('.md-hero'));
    ok('value chart canvas kept', !!document.getElementById('valueChart'));
    ok('allocation chart canvas kept', !!document.getElementById('allocChart'));
    ok('list header counts stocks', /หุ้นทั้งหมด \(3\)/.test(document.getElementById('moneyDash').textContent),
       document.querySelector('.md-card-t')?.textContent);

    const bar = document.getElementById('plSortBar');
    ok('5 sort chips', bar.querySelectorAll('.sort-chip').length === 5, bar.querySelectorAll('.sort-chip').length);
    ok('active chip marked', bar.querySelectorAll('.sort-chip.on').length === 1);
    ok('active chip shows direction', /↑/.test(bar.querySelector('.sort-chip.on').textContent));

    // clicking a chip re-sorts the DOM
    bar.querySelector('[data-key="value"]').click();
    eq('click chip re-sorts by value desc', rows().map(r => r.dataset.ticker), ['AAA', 'BBB', 'WWW']);
    document.getElementById('plSortBar').querySelector('[data-key="value"]').click();
    eq('second click flips to asc', rows().map(r => r.dataset.ticker), ['WWW', 'BBB', 'AAA']);
    document.getElementById('plSortBar').querySelector('[data-key="score"]').click();
    // scores: AAA 78, WWW 70, BBB 64
    eq('score sort works from the UI', rows().map(r => r.dataset.ticker), ['AAA', 'WWW', 'BBB']);

    // ── row actions ──
    S.plSort = { key: 'ticker', dir: 'asc' }; renderStockRows();
    rows()[1].querySelector('.st-act.edit').click();
    ok('✏️ opens details modal', !document.getElementById('editDetailsModal').classList.contains('hidden'));
    eq('details modal prefilled ticker', document.getElementById('edTicker').value, 'BBB');
    eq('details modal prefilled shares', document.getElementById('edShares').value, '50');
    eq('details modal prefilled cost', document.getElementById('edAvgCost').value, '20');
    closeM('editDetailsModal');

    rows()[0].querySelector('.st-act.score').click();
    ok('★ opens the score modal', !document.getElementById('editModal').classList.contains('hidden'));
    ok('★ score modal targets that ticker', /AAA/.test(document.getElementById('editTitle').textContent),
       document.getElementById('editTitle').textContent);
    closeM('editModal');

    // clicking the row body (not a button) opens the detail view
    rows()[0].click();
    ok('row click opens detail modal', !document.getElementById('detailModal').classList.contains('hidden'));
    ok('detail modal is for that ticker', /AAA/.test(document.getElementById('detailTitle').textContent));
    closeM('detailModal');

    // action buttons must not also trigger the row's openDetail
    rows()[1].querySelector('.st-act.edit').click();
    ok('action click does not open detail too', document.getElementById('detailModal').classList.contains('hidden'));
    closeM('editDetailsModal');
  } catch (e) {
    fail++; L.push('  FAIL render smoke threw → ' + e.message + '\n' + e.stack);
  }

  sec('watch-only portfolio still lists stocks');
  try {
    S.registry = { portfolio_name: 'T', last_updated: TODAY, stocks: [
      { ticker: 'WWW', company: 'Watch Co', sector: '—', shares: 0, avg_cost: 0, thesis_score: 70, catalysts: [], thesis_breakers: [] }
    ] };
    renderMoneyDashboard();
    ok('no hero when nothing is held', !document.querySelector('.md-hero'));
    ok('but the row still renders', document.querySelectorAll('.st-row').length === 1);
    ok('and it explains how to get the charts', /Shares \+ Avg Cost/.test(document.getElementById('moneyDash').textContent));
  } catch (e) { fail++; L.push('  FAIL watch-only render threw → ' + e.message); }

  sec('empty portfolio does not crash');
  try {
    S.registry = { portfolio_name: 'T', last_updated: TODAY, stocks: [] };
    renderMoneyDashboard();
    ok('empty renders placeholder', /ยังไม่มีหุ้น/.test(document.getElementById('moneyDash').innerHTML));
  } catch (e) { fail++; L.push('  FAIL empty portfolio threw → ' + e.message); }

  sec('layout: nothing pushes the page sideways');
  try {
    // Seed a realistic list, then check the document itself does not scroll
    // horizontally. The nav button strip scrolls on its own instead.
    S.registry = {
      portfolio_name: 'T', last_updated: TODAY, stocks: [
        { ticker: 'ADVANC', company: 'Advanced Info Service', sector: 'Telecom', shares: 500, avg_cost: 245.5, current_price: 251, thesis_score: 78, notes: 'ประเมินว่ากระแสเงินสดยังแข็งแรงและปันผลสม่ำเสมอ', catalysts: [{ event: '5G subscriber growth', status: 'in_progress' }], thesis_breakers: [] },
        { ticker: 'BDMS', company: 'Bangkok Dusit Medical Services', sector: 'Healthcare', shares: 1000, avg_cost: 22.5, current_price: 24.1, thesis_score: 75, notes: '', catalysts: [], thesis_breakers: [] }
      ]
    };
    S.kb = { score_history: {}, catalyst_log: {}, guidance_tracker: {}, evidence_clips: [], value_history: [] };
    document.getElementById('dashboard').classList.remove('hidden');
    renderMoneyDashboard();
    const de = document.documentElement;
    ok('document does not scroll horizontally', de.scrollWidth <= de.clientWidth + 1,
       'scrollWidth ' + de.scrollWidth + ' vs clientWidth ' + de.clientWidth);
    const wide = [...document.querySelectorAll('#moneyDash *')]
      .filter(e => e.getBoundingClientRect().width > de.clientWidth + 1)
      .map(e => e.className);
    ok('no element in the list is wider than the viewport', wide.length === 0, wide.join(' | '));
  } catch (e) { fail++; L.push('  FAIL layout check threw → ' + e.message); }


  // ══════════════════ XD watch ══════════════════
  sec('xdSymbolFor / xdDaysUntil');
  eq('SET ticker gets .BK', xdSymbolFor('BDMS'), { sym: 'BDMS.BK', isDR: false });
  eq('DR maps to underlying', xdSymbolFor('XIAOMI80'), { sym: '1810.HK', isDR: true });
  eq('DR MSFT80 -> MSFT', xdSymbolFor('MSFT80'), { sym: 'MSFT', isDR: true });
  eq('symbol with dot passes through', xdSymbolFor('MC.PA'), { sym: 'MC.PA', isDR: false });
  eq('days ahead', xdDaysUntil('2026-08-26', '2026-08-19'), 7);
  eq('days today', xdDaysUntil('2026-08-19', '2026-08-19'), 0);
  eq('days past is negative', xdDaysUntil('2026-03-09', '2026-08-19'), -163);
  eq('days null date', xdDaysUntil(null, '2026-08-19'), null);
  eq('days garbage date', xdDaysUntil('not-a-date', '2026-08-19'), null);

  sec('xdProjectNext');
  eq('empty history', xdProjectNext([], '2026-08-19'), null);
  eq('annual payer rolls to next year',
     xdProjectNext(['2024-03-09', '2025-03-10', '2026-03-09'], '2026-08-19').date, '2027-03-09');
  {
    // twice-yearly payer: Sep slot is nearer than the Mar slot
    const p = xdProjectNext(['2025-03-12', '2025-09-09', '2026-03-10'], '2026-08-19');
    eq('twice-yearly picks the nearer slot', p.date, '2026-09-09');
    eq('basis cites the matching slot', p.basis, ['2025-09-09']);
  }
  eq('slot later this year is kept, not pushed a year',
     xdProjectNext(['2025-12-01'], '2026-08-19').date, '2026-12-01');
  eq('slot already passed this year rolls forward',
     xdProjectNext(['2026-03-09'], '2026-08-19').date, '2027-03-09');

  sec('xdEstCash — DR must never produce a baht figure');
  eq('plain stock multiplies out', xdEstCash(0.45, 6500, false), 2925);
  eq('DR returns null', xdEstCash(0.91, 63000, true), null);
  eq('no dps', xdEstCash(null, 6500, false), null);
  eq('zero shares', xdEstCash(0.45, 0, false), null);

  sec('buildXdRows');
  {
    const stocks = [
      { ticker: 'CPF', shares: 6500 }, { ticker: 'M', shares: 8700 },
      { ticker: 'CPN', shares: 1000 }, { ticker: 'XIAOMI80', shares: 14554 },
      { ticker: 'NOSHARES', shares: 0 }
    ];
    const items = {
      CPF: { xd: '2026-08-31', dps: 0.45, conf: 'confirmed', pay: '2026-09-11' },
      M:   { xd: '2026-08-26', dps: 0.40, conf: 'confirmed' },
      CPN: { xd: '2026-03-09', dps: 2.40, conf: 'estimated' },   // already past
      XIAOMI80: { xd: '2026-09-01', dps: 0.5, conf: 'estimated', isDR: true, sym: '1810.HK' },
      NOSHARES: { xd: '2026-08-20', dps: 1, conf: 'confirmed' }
    };
    const r = buildXdRows(stocks, items, '2026-08-19');
    eq('upcoming sorted by nearest', r.up.map(x => x.ticker), ['M', 'CPF', 'XIAOMI80']);
    eq('past XD moved out of upcoming', r.none.map(x => x.ticker), ['CPN']);
    eq('zero-share holding excluded entirely',
       r.up.concat(r.none).some(x => x.ticker === 'NOSHARES'), false);
    eq('cash uses share count', r.up[0].cash, 3480);
    eq('CPF cash', r.up[1].cash, 2925);
    eq('DR row carries no cash', r.up[2].cash, null);
    eq('DR row shows no per-share baht', r.up[2].dps, null);
    eq('total excludes the DR', r.total, 6405);
    eq('days computed', r.up[0].days, 7);
  }
  {
    const r = buildXdRows([{ ticker: 'AAA', shares: 100 }], {}, '2026-08-19');
    eq('missing item degrades to none bucket', r.none.map(x => x.ticker), ['AAA']);
    eq('missing item total is zero', r.total, 0);
  }
  eq('no stocks at all', buildXdRows([], {}, '2026-08-19').total, 0);

  sec('renderXD');
  {
    const prevReg = S.registry, prevXd = S.xd;
    S.registry = { stocks: [{ ticker: 'CPF', shares: 6500 }, { ticker: 'MSFT80', shares: 63000 }] };
    S.xd = { fetched_at: '2026-08-19T10:00:00.000Z', items: {
      CPF: { xd: '2099-08-31', dps: 0.45, conf: 'confirmed' },
      MSFT80: { xd: '2099-08-20', conf: 'confirmed', isDR: true, sym: 'MSFT',
                note: 'อ้างอิง MSFT' }
    } };
    renderXD();
    const h = document.getElementById('xdContent').innerHTML;
    ok('renders the ticker', h.indexOf('CPF') !== -1);
    ok('renders the confirmed badge', h.indexOf('ยืนยันแล้ว') !== -1);
    ok('renders a baht total', h.indexOf('฿2,925') !== -1);
    ok('DR row renders without a baht amount', h.indexOf('฿28,530') === -1);
    ok('DR caveat is shown', h.indexOf('หุ้นแม่') !== -1);
    S.xd = null;
    renderXD();
    ok('empty state when never fetched',
       document.getElementById('xdContent').innerHTML.indexOf('ยังไม่ได้ดึงข้อมูล') !== -1);
    S.registry = prevReg; S.xd = prevXd;
  }

  // ══════════════════ net worth: icons, groups, donut legend ══════════════════
  sec('nwIconFor');
  eq('crypto category', nwIconFor('Crypto'), '🪙');
  eq('thai crypto', nwIconFor('คริปโต'), '🪙');
  eq('cash', nwIconFor('Cash / เงินฝาก'), '💵');
  eq('gold', nwIconFor('Gold / ทอง'), '🥇');
  eq('fund', nwIconFor('Fund / กองทุน'), '📊');
  eq('property', nwIconFor('Property / อสังหาฯ'), '🏠');
  eq('insurance', nwIconFor('ประกันชีวิต'), '🛡️');
  eq('car', nwIconFor('รถยนต์'), '🚗');
  eq('loan', nwIconFor('Loan / สินเชื่อ'), '💳');
  // Debt keywords win over the noun they attach to — a housing loan is a debt.
  eq('housing loan is not a house', nwIconFor('สินเชื่อบ้าน'), '💳');
  eq('case insensitive', nwIconFor('BITCOIN'), '🪙');
  eq('unknown asset falls back', nwIconFor('ของอย่างอื่น'), '💎');
  eq('unknown liability falls back', nwIconFor('อย่างอื่น', 'liability'), '💳');
  eq('empty', nwIconFor(''), '💎');
  eq('asset icon reads name too', nwAssetIcon({ name: 'ทองคำแท่ง', cat: 'อื่นๆ' }), '🥇');
  eq('asset icon reads ticker too', nwAssetIcon({ name: 'เหรียญ A', cat: 'อื่นๆ', ticker: 'ETH' }), '🪙');
  eq('asset icon prefers category match', nwAssetIcon({ name: 'ก้อนที่ 1', cat: 'Crypto' }), '🪙');

  sec('nwByCat');
  {
    const A = [
      { id: 'x1', cat: 'Crypto', qty: 2, manual_price: 100, price_mode: 'manual' },
      { id: 'x2', cat: 'Cash', qty: 1, manual_price: 900, price_mode: 'manual' },
      { id: 'x3', cat: 'Crypto', qty: 1, manual_price: 500, price_mode: 'manual' },
      { id: 'x4', qty: 1, manual_price: 50, price_mode: 'manual' }
    ];
    const g = nwByCat(A);
    eq('biggest category first', g.map(c => c.cat), ['Cash', 'Crypto', 'อื่นๆ']);
    eq('category sums', g.map(c => c.sum), [900, 700, 50]);
    eq('items inside sorted by value', g[1].list.map(a => a.id), ['x3', 'x1']);
    eq('blank category buckets to อื่นๆ', g[2].list.length, 1);
    eq('no assets', nwByCat([]), []);
  }

  sec('renderNetWorth — collapsible groups');
  {
    const prevReg = S.registry, prevAsset = S.assetReg, prevOpen = S.nwOpen, prevView = S.view;
    S.registry = { stocks: [{ ticker: 'CPF', shares: 1000, avg_cost: 20, current_price: 25, thesis_status: '🟢' }] };
    S.assetReg = {
      version: 1, snapshots: [], settings: { usdthb_override: 35 },
      assets: [
        { id: 'a1', kind: 'asset', cat: 'Crypto', name: 'Bitcoin', ticker: 'BTC', price_mode: 'auto', fetched_price: 100, qty: 10, price_cur: 'USD' },
        { id: 'a2', kind: 'asset', cat: 'Cash / เงินฝาก', name: 'บัญชีออมทรัพย์', price_mode: 'manual', manual_price: 50000, qty: 1, price_cur: 'THB' },
        { id: 'a3', kind: 'asset', cat: 'Cash / เงินฝาก', name: 'ฝากประจำ', price_mode: 'manual', manual_price: 25000, qty: 1, price_cur: 'THB' },
        { id: 'a4', kind: 'liability', cat: 'Loan / สินเชื่อ', name: 'สินเชื่อบ้าน', price_mode: 'manual', manual_price: 20000, qty: 1, price_cur: 'THB' }
      ]
    };
    S.nwOpen = {};
    renderNetWorth();
    const lists = document.getElementById('nwLists');
    const grps = () => [...lists.querySelectorAll('.nw-grp')];

    eq('one group per kind', grps().length, 4);
    eq('groups ordered: stocks, biggest category first, debts last',
       grps().map(g => g.dataset.key), ['stocks', 'cat:Cash / เงินฝาก', 'cat:Crypto', 'liab']);
    eq('everything starts collapsed', grps().filter(g => g.classList.contains('open')).length, 0);

    const cash = grps()[1];
    ok('group header shows the group value', cash.innerHTML.indexOf('฿75,000') !== -1);
    ok('group header shows how many items', cash.innerHTML.indexOf('2 รายการ') !== -1);
    ok('group header shows a percent', cash.innerHTML.indexOf('>56%<') !== -1);
    ok('group header shows the category icon', cash.innerHTML.indexOf('💵') !== -1);
    ok('debt group is marked and negative', grps()[3].className.indexOf('liab') !== -1 && grps()[3].innerHTML.indexOf('−฿20,000') !== -1);
    ok('rows carry a per-asset icon', grps()[2].innerHTML.indexOf('nw-row-ic">🪙') !== -1);

    // one tap on a header opens just that group
    cash.querySelector('.nw-grp-h').click();
    eq('tap expands only that group', grps().filter(g => g.classList.contains('open')).map(g => g.dataset.key), ['cat:Cash / เงินฝาก']);
    eq('open state is remembered', Object.keys(S.nwOpen), ['cat:Cash / เงินฝาก']);
    ok('expanded group lists its items', cash.querySelectorAll('.nw-grp-b .nw-row').length === 2);
    cash.querySelector('.nw-grp-h').click();
    eq('tapping again collapses it', S.nwOpen, {});

    // expand all / collapse all
    const btn = document.getElementById('nwExpandBtn');
    eq('button starts as expand-all', btn.textContent, '⊕ ขยายทั้งหมด');
    btn.click();
    eq('expand all opens every group', grps().filter(g => g.classList.contains('open')).length, 4);
    eq('button flips to collapse-all', btn.textContent, '⊖ ยุบทั้งหมด');
    btn.click();
    eq('collapse all closes every group', grps().filter(g => g.classList.contains('open')).length, 0);
    eq('button flips back', btn.textContent, '⊕ ขยายทั้งหมด');

    // a half-open list still offers "expand all"
    grps()[0].querySelector('.nw-grp-h').click();
    eq('partly open still offers expand-all', btn.textContent, '⊕ ขยายทั้งหมด');
    renderNetWorth();
    eq('re-render keeps what was expanded', grps().filter(g => g.classList.contains('open')).map(g => g.dataset.key), ['stocks']);
    S.nwOpen = {};
    renderNetWorth();

    sec('donut legend — value + percent + icon');
    const parts = nwAllocParts(netWorthTotals(), S.assetReg.assets.filter(a => a.kind !== 'liability'));
    eq('slices are stock + one per category, biggest first', parts.map(p => p.label), ['Cash / เงินฝาก', 'Crypto', 'หุ้น (พอร์ต SET/DR)']);
    eq('slice values', parts.map(p => p.v), [75000, 35000, 25000]);
    eq('slices carry icons', parts.map(p => p.icon), ['💵', '🪙', '⚔️']);
    eq('slices know where they point', parts.map(p => p.act), ['cat:Cash / เงินฝาก', 'cat:Crypto', 'stocks']);
    const leg = document.getElementById('nwAllocLegend');
    ok('legend renders a row per slice', leg.querySelectorAll('.dn-li').length === 3);
    ok('legend prints baht values', leg.innerHTML.indexOf('฿75,000') !== -1 && leg.innerHTML.indexOf('฿25,000') !== -1);
    ok('legend prints percents', leg.innerHTML.indexOf('55.6%') !== -1);
    ok('legend prints icons', leg.innerHTML.indexOf('💵') !== -1 && leg.innerHTML.indexOf('⚔️') !== -1);
    ok('legend percents add up to 100', (() => {
      const ps = [...leg.querySelectorAll('.dn-pct')].map(e => parseFloat(e.textContent));
      return Math.abs(ps.reduce((a, b) => a + b, 0) - 100) < 0.2;
    })());
    ok('legend entries are tappable', leg.querySelector('.dn-li').getAttribute('data-act') !== null);
    // the stock donut on the หุ้น tab uses the same legend
    eq('stock slices', allocParts(portfolioTotals().held).map(p => [p.label, p.v, p.icon, p.act]), [['CPF', 25000, '🟢', 'CPF']]);
    eq('legend html carries value and percent',
       donutLegendHtml([{ label: 'A', icon: '🪙', v: 25 }, { label: 'B', icon: '💵', v: 75 }], 100, 'x')
         .match(/(฿25|฿75|25\.0%|75\.0%)/g), ['฿25', '25.0%', '฿75', '75.0%']);

    sec('ทรัพย์สินอื่น breakdown');
    renderNwBreakdown('assets');
    let bh = document.getElementById('nwBreakBody').innerHTML;
    ok('title names the summary', document.getElementById('nwBreakTitle').textContent.indexOf('ทรัพย์สินอื่น') !== -1);
    ok('total of ทรัพย์สินอื่น (stocks excluded)', bh.indexOf('฿110,000') !== -1);
    ok('every kind is listed', bh.indexOf('Cash / เงินฝาก') !== -1 && bh.indexOf('Crypto') !== -1);
    ok('kind values', bh.indexOf('฿75,000') !== -1 && bh.indexOf('฿35,000') !== -1);
    ok('kind share of ทรัพย์สินอื่น', bh.indexOf('68.2%') !== -1);
    ok('items inside each kind', bh.indexOf('บัญชีออมทรัพย์') !== -1 && bh.indexOf('฿50,000') !== -1);
    ok('debts are not counted here', bh.indexOf('สินเชื่อบ้าน') === -1);
    ok('footer puts it next to หุ้น', bh.indexOf('฿135,000') !== -1);
    // 110k of 135k gross — measured against total assets, so it can never top 100%
    ok('header shares against total assets', bh.indexOf('81.5%') !== -1);
    ok('items link back to editing', bh.indexOf('nwBreakEdit') !== -1);
    renderNwBreakdown('liab');
    bh = document.getElementById('nwBreakBody').innerHTML;
    ok('debt view totals debts', bh.indexOf('−฿20,000') !== -1);
    ok('debt view lists the debt', bh.indexOf('สินเชื่อบ้าน') !== -1);
    ok('debt view drops assets', bh.indexOf('บัญชีออมทรัพย์') === -1);
    S.assetReg.assets = [];
    renderNwBreakdown('assets');
    ok('empty state', document.getElementById('nwBreakBody').innerHTML.indexOf('ยังไม่มี') !== -1);

    S.registry = prevReg; S.assetReg = prevAsset; S.nwOpen = prevOpen; S.view = prevView;
    document.getElementById('nwLists').innerHTML = '';
    document.getElementById('nwDash').innerHTML = '';
  }

  // ══════════════════ stock list: grouping / expand / collapse ══════════════════
  sec('stSectorIcon');
  eq('bank', stSectorIcon('Banking'), '🏦');
  eq('thai bank', stSectorIcon('ธนาคาร'), '🏦');
  eq('healthcare', stSectorIcon('Healthcare'), '🏥');
  eq('technology', stSectorIcon('Technology'), '💻');
  eq('energy', stSectorIcon('Energy & Utilities'), '⚡');
  eq('petro before energy keywords', stSectorIcon('Petrochemicals'), '⛽');
  eq('food', stSectorIcon('Food & Beverage'), '🍽️');
  eq('property', stSectorIcon('Property Development'), '🏢');
  eq('unknown sector', stSectorIcon('Zzz'), '🏭');
  eq('blank sector', stSectorIcon(''), '🏭');

  sec('stGroupOf');
  {
    const prev = S.stGroup;
    const held = { ticker: 'AAA', sector: 'Banking', thesis_score: 80, shares: 10, avg_cost: 5 };
    const watch = { ticker: 'WWW', sector: '—', thesis_score: 50, shares: 0, avg_cost: 0 };
    S.stGroup = 'sector';
    eq('by sector', [stGroupOf(held).key, stGroupOf(held).name], ['sec:Banking', 'Banking']);
    eq('sector placeholder — becomes its own group', stGroupOf(watch).name, 'ไม่ระบุกลุ่ม');
    S.stGroup = 'status';
    eq('by status — strong', stGroupOf(held).key, 'sc:แข็งแกร่ง / ดี (75+)');
    eq('by status — watchlist band', stGroupOf(watch).key, 'sc:เฝ้าระวัง (45–59)');
    eq('status icon follows the score', stGroupOf(watch).icon, '🟠');
    S.stGroup = 'held';
    eq('by holding — held', stGroupOf(held).key, 'hd:held');
    eq('by holding — watch only', stGroupOf(watch).key, 'hd:watch');
    S.stGroup = prev;
  }

  sec('stockGroups + renderStockRows');
  {
    const prevReg = S.registry, prevKb = S.kb, prevSort = S.plSort, prevMode = S.stGroup, prevClosed = S.stClosed;
    S.registry = { portfolio_name: 'T', last_updated: TODAY, stocks: [
      { ticker: 'AAA', company: 'Alpha', sector: 'Technology', shares: 100, avg_cost: 10, current_price: 12, thesis_score: 78, catalysts: [], thesis_breakers: [] },
      { ticker: 'CCC', company: 'Gamma', sector: 'Technology', shares: 10, avg_cost: 10, current_price: 12, thesis_score: 50, catalysts: [], thesis_breakers: [] },
      { ticker: 'BBB', company: 'Beta', sector: 'Banking', shares: 50, avg_cost: 20, current_price: 18, thesis_score: 64, catalysts: [], thesis_breakers: [] },
      { ticker: 'WWW', company: 'Watch', sector: 'Food', shares: 0, avg_cost: 0, thesis_score: 70, catalysts: [], thesis_breakers: [] }
    ] };
    S.kb = { score_history: {}, catalyst_log: {}, guidance_tracker: {}, evidence_clips: [], value_history: [] };
    S.stClosed = {};

    S.stGroup = 'sector';
    S.plSort = { key: 'value', dir: 'desc' };
    let g = stockGroups();
    eq('sector groups, biggest value first', g.map(x => x.name), ['Technology', 'Banking', 'Food']);
    eq('group totals', g.map(x => x.value), [1320, 900, 0]);
    eq('group counts', g.map(x => x.n), [2, 1, 1]);
    eq('rows inside keep the sort', g[0].list.map(x => x.ticker), ['AAA', 'CCC']);
    eq('group icons', g.map(x => x.icon), ['💻', '🏦', '🍽️']);

    S.plSort = { key: 'ticker', dir: 'asc' };
    eq('name sort orders groups alphabetically', stockGroups().map(x => x.name), ['Banking', 'Food', 'Technology']);
    S.plSort = { key: 'score', dir: 'desc' };
    // Technology averages (78+50)/2 = 64 — level with Banking's 64, so the tie
    // breaks on the group name; Food (70) leads.
    eq('score sort orders groups by average score', stockGroups().map(x => x.name), ['Food', 'Banking', 'Technology']);

    S.stGroup = 'status';
    S.plSort = { key: 'value', dir: 'desc' };
    eq('status groups', stockGroups().map(x => x.name), ['แข็งแกร่ง / ดี (75+)', 'ติดตาม (60–74)', 'เฝ้าระวัง (45–59)']);
    S.stGroup = 'held';
    eq('held groups', stockGroups().map(x => x.name), ['ถือครองอยู่', 'เฝ้าดู (Watch only)']);
    eq('held group counts', stockGroups().map(x => x.n), [3, 1]);

    // ── rendered list ──
    S.stGroup = 'sector';
    renderMoneyDashboard();
    // #plRows is replaced on every renderMoneyDashboard, so never hold the node
    const rowsEl = () => document.getElementById('plRows');
    const grps = () => [...rowsEl().querySelectorAll('.nw-grp')];
    const btn = () => document.getElementById('stExpandBtn');
    eq('one group per sector', grps().length, 3);
    eq('groups carry their key', grps().map(x => x.dataset.key), ['sec:Technology', 'sec:Banking', 'sec:Food']);
    // Unlike the net-worth list, stock groups start EXPANDED — nothing the user
    // could see before this feature is hidden by it.
    eq('everything starts expanded', grps().filter(x => !x.classList.contains('open')).length, 0);
    eq('every stock still has a row', rowsEl().querySelectorAll('.st-row').length, 4);
    eq('button offers collapse-all', btn().textContent, '⊖ ยุบทั้งหมด');
    ok('header shows count and value', grps()[0].innerHTML.indexOf('2 รายการ') !== -1 && grps()[0].innerHTML.indexOf('฿1,320') !== -1);

    grps()[0].querySelector('.nw-grp-h').click();
    eq('tap collapses just that group', grps().filter(x => !x.classList.contains('open')).map(x => x.dataset.key), ['sec:Technology']);
    eq('collapsed groups are remembered', Object.keys(S.stClosed), ['sec:Technology']);
    eq('button now offers expand-all', btn().textContent, '⊕ ขยายทั้งหมด');
    btn().click();
    eq('expand all reopens everything', grps().filter(x => !x.classList.contains('open')).length, 0);
    eq('nothing left collapsed', S.stClosed, {});
    btn().click();
    eq('collapse all closes everything', grps().filter(x => x.classList.contains('open')).length, 0);
    eq('all three are remembered as collapsed', Object.keys(S.stClosed).length, 3);
    renderMoneyDashboard();
    eq('re-render keeps them collapsed', grps().filter(x => x.classList.contains('open')).length, 0);
    ok('collapsed rows are still in the DOM', rowsEl().querySelectorAll('.st-row').length === 4);

    setStGroup('none');
    eq('ungrouped renders a flat list', grps().length, 0);
    eq('flat list still has every row', rowsEl().querySelectorAll('.st-row').length, 4);
    ok('no expand button when ungrouped', btn().classList.contains('hidden'));
    ok('grouping choice is a chip', document.getElementById('stGroupBar').querySelectorAll('.sort-chip').length === 4);
    ok('active grouping chip is marked', document.getElementById('stGroupBar').querySelector('.sort-chip.on').dataset.key === 'none');
    setStGroup('sector');
    ok('switching back regroups', grps().length === 3 && !btn().classList.contains('hidden'));
    // the two lists keep separate memories
    ok('stock groups and net-worth groups do not share state', grpEls('st').length === 3 && grpEls('nw').length === 0);

    S.registry = prevReg; S.kb = prevKb; S.plSort = prevSort; S.stGroup = prevMode; S.stClosed = prevClosed;
  }

  // ══════════════════ net worth: sorting ══════════════════
  sec('nwByCat sorting');
  {
    const A = [
      { id: 'x1', cat: 'Crypto', name: 'Bitcoin', qty: 2, manual_price: 100, price_mode: 'manual' },
      { id: 'x2', cat: 'Cash',   name: 'ออมทรัพย์', qty: 1, manual_price: 900, price_mode: 'manual' },
      { id: 'x3', cat: 'Crypto', name: 'Ethereum', qty: 1, manual_price: 500, price_mode: 'manual' },
      { id: 'x4', cat: 'Gold',   name: 'ทองแท่ง', qty: 1, manual_price: 50, price_mode: 'manual' }
    ];
    eq('value desc (default)', nwByCat(A, { key: 'value', dir: 'desc' }).map(c => c.cat), ['Cash', 'Crypto', 'Gold']);
    eq('value asc', nwByCat(A, { key: 'value', dir: 'asc' }).map(c => c.cat), ['Gold', 'Crypto', 'Cash']);
    eq('by count desc', nwByCat(A, { key: 'count', dir: 'desc' }).map(c => c.cat), ['Crypto', 'Cash', 'Gold']);
    eq('by name asc', nwByCat(A, { key: 'name', dir: 'asc' }).map(c => c.cat), ['Cash', 'Crypto', 'Gold']);
    eq('by name desc', nwByCat(A, { key: 'name', dir: 'desc' }).map(c => c.cat), ['Gold', 'Crypto', 'Cash']);
    // the same key orders the items inside a category
    eq('items follow value desc', nwByCat(A, { key: 'value', dir: 'desc' })[1].list.map(a => a.id), ['x3', 'x1']);
    eq('items follow value asc', nwByCat(A, { key: 'value', dir: 'asc' })[1].list.map(a => a.id), ['x1', 'x3']);
    eq('items follow name asc', nwByCat(A, { key: 'name', dir: 'asc' })[1].list.map(a => a.id), ['x1', 'x3']);
    eq('count sort falls back to value inside', nwByCat(A, { key: 'count', dir: 'desc' })[0].list.map(a => a.id), ['x3', 'x1']);
    eq('no sort given behaves as value desc', nwByCat(A).map(c => c.cat), ['Cash', 'Crypto', 'Gold']);
  }

  sec('Net Worth sort chips');
  {
    const prevReg = S.registry, prevAsset = S.assetReg, prevOpen = S.nwOpen, prevSort = S.nwSort;
    S.registry = { stocks: [] };
    S.assetReg = { version: 1, snapshots: [], settings: { usdthb_override: 35 }, assets: [
      { id: 'a1', kind: 'asset', cat: 'Crypto', name: 'Bitcoin', price_mode: 'manual', manual_price: 100, qty: 1, price_cur: 'THB' },
      { id: 'a2', kind: 'asset', cat: 'Crypto', name: 'Ethereum', price_mode: 'manual', manual_price: 50, qty: 1, price_cur: 'THB' },
      { id: 'a3', kind: 'asset', cat: 'Cash', name: 'ออมทรัพย์', price_mode: 'manual', manual_price: 900, qty: 1, price_cur: 'THB' },
      { id: 'a4', kind: 'liability', cat: 'Loan', name: 'สินเชื่อบ้าน', price_mode: 'manual', manual_price: 400, qty: 1, price_cur: 'THB' }
    ] };
    S.nwOpen = {}; S.nwSort = { key: 'value', dir: 'desc' };
    renderNetWorth();
    const keys = () => [...document.querySelectorAll('#nwLists .nw-grp')].map(g => g.dataset.key);
    eq('value desc by default', keys(), ['cat:Cash', 'cat:Crypto', 'liab']);
    eq('sort chips render', document.getElementById('nwSortBar').querySelectorAll('.sort-chip').length, 3);
    ok('active chip shows a direction arrow', /มูลค่า ↓/.test(document.getElementById('nwSortBar').textContent));

    setNwSort('value');
    eq('tapping the active chip flips direction', S.nwSort.dir, 'asc');
    eq('flipped order', keys(), ['cat:Crypto', 'cat:Cash', 'liab']);
    setNwSort('count');
    eq('count sort defaults to biggest first', S.nwSort, { key: 'count', dir: 'desc' });
    eq('most items first', keys(), ['cat:Crypto', 'cat:Cash', 'liab']);
    setNwSort('name');
    eq('name sort defaults A→Z', S.nwSort, { key: 'name', dir: 'asc' });
    eq('alphabetical', keys(), ['cat:Cash', 'cat:Crypto', 'liab']);
    // debts always sit at the bottom — they are not one of the categories
    ok('หนี้สิน stays last whatever the sort', keys()[keys().length - 1] === 'liab');
    setNwSort('name');
    eq('name flips to Z→A', keys(), ['cat:Crypto', 'cat:Cash', 'liab']);

    S.nwSort = { key: 'value', dir: 'desc' };
    renderNetWorth();
    S.nwOpen = { 'cat:Crypto': true };
    renderNetWorth();
    const crypto = [...document.querySelectorAll('#nwLists .nw-grp')].find(g => g.dataset.key === 'cat:Crypto');
    eq('items inside follow the same sort', [...crypto.querySelectorAll('.nw-row-nm')].map(e => e.textContent), ['Bitcoin', 'Ethereum']);
    setNwSort('value');
    const crypto2 = [...document.querySelectorAll('#nwLists .nw-grp')].find(g => g.dataset.key === 'cat:Crypto');
    eq('flipping the sort flips the items too', [...crypto2.querySelectorAll('.nw-row-nm')].map(e => e.textContent), ['Ethereum', 'Bitcoin']);

    S.registry = prevReg; S.assetReg = prevAsset; S.nwOpen = prevOpen; S.nwSort = prevSort;
    document.getElementById('nwLists').innerHTML = '';
    document.getElementById('nwDash').innerHTML = '';
  }

  // ══════════════════ today's move ══════════════════
  sec('stockDay / dayStats');
  {
    const daysAgo = d => new Date(Date.now() - d * 86400000).toISOString();
    eq('no previous close → no day move', stockDay({ current_price: 10, shares: 5 }), null);
    eq('no price yet → no day move', stockDay({ prev_close: 10, shares: 5 }), null);
    eq('zero prev close is not a divide', stockDay({ current_price: 10, prev_close: 0, shares: 5 }), null);
    let d = stockDay({ current_price: 10.5, prev_close: 10, shares: 100 });
    ok('percent up', Math.abs(d.pct - 5) < 1e-9, d.pct);
    ok('baht change uses shares', Math.abs(d.chg - 50) < 1e-9, d.chg);
    d = stockDay({ current_price: 9, prev_close: 10, shares: 100 });
    ok('percent down is negative', Math.abs(d.pct + 10) < 1e-9, d.pct);
    ok('baht change down', Math.abs(d.chg + 100) < 1e-9, d.chg);
    eq('watch-only still gets a percent, zero baht', stockDay({ current_price: 11, prev_close: 10, shares: 0 }).chg, 0);

    const prevReg = S.registry;
    S.registry = { stocks: [
      { ticker: 'AAA', shares: 100, avg_cost: 9, current_price: 10.5, prev_close: 10 },   // +50
      { ticker: 'BBB', shares: 50,  avg_cost: 20, current_price: 18,  prev_close: 20 },   // −100
      { ticker: 'NOP', shares: 10,  avg_cost: 5,  current_price: 6 },                     // no prev → skipped
      { ticker: 'WWW', shares: 0,   avg_cost: 0,  current_price: 3, prev_close: 2 }       // no shares → skipped
    ] };
    const ds = dayStats();
    eq('only holdings with both prices count', ds.n, 2);
    ok('portfolio day change in baht', Math.abs(ds.chg + 50) < 1e-9, ds.chg);
    ok('portfolio day percent off yesterday value', Math.abs(ds.pct - (-50 / 2000 * 100)) < 1e-9, ds.pct);
    ok('has a day move', ds.has);
    S.registry = { stocks: [{ ticker: 'AAA', shares: 100, avg_cost: 9, current_price: 10 }] };
    ok('no prev closes anywhere → nothing to show', !dayStats().has);
    S.registry = { stocks: [] };
    ok('empty portfolio is safe', !dayStats().has && dayStats().chg === 0);

    // applyQuote is what the price refresh writes
    const st = { ticker: 'AAA' };
    applyQuote(st, { price: 12, prev: 11 });
    eq('quote writes price', st.current_price, 12);
    eq('quote writes previous close', st.prev_close, 11);
    ok('quote stamps the time', !!st.price_updated);
    applyQuote(st, { price: 13, prev: 0 });
    eq('a quote without a prev close keeps the old one', st.prev_close, 11);
    eq('…but still updates the price', st.current_price, 13);
    S.registry = prevReg;
  }

  sec('price freshness');
  {
    const daysAgo = d => new Date(Date.now() - d * 86400000 - 60000).toISOString();
    eq('no timestamp', daysSinceISO(null), null);
    eq('garbage timestamp', daysSinceISO('not a date'), null);
    eq('same day', daysSinceISO(new Date().toISOString()), 0);
    eq('four days', daysSinceISO(daysAgo(4)), 4);
    eq('fresh price gets no badge', staleDays({ current_price: 10, price_updated: daysAgo(1) }), null);
    eq('three days old gets a badge', staleDays({ current_price: 10, price_updated: daysAgo(3) }), 3);
    eq('no price at all → no badge', staleDays({ price_updated: daysAgo(9) }), null);
  }

  // ══════════════════ chart ranges ══════════════════
  sec('rangeStartDate / filterByRange');
  eq('1 month back', rangeStartDate('1m', '2026-08-20'), '2026-07-21');
  eq('3 months back', rangeStartDate('3m', '2026-08-20'), '2026-05-22');
  eq('1 year back', rangeStartDate('1y', '2026-08-20'), '2025-08-20');
  eq('year to date', rangeStartDate('ytd', '2026-08-20'), '2026-01-01');
  eq('all time has no lower bound', rangeStartDate('all', '2026-08-20'), null);
  eq('unknown key behaves like all', rangeStartDate('zzz', '2026-08-20'), null);
  {
    const H = [
      { date: '2025-12-30', value: 100 }, { date: '2026-01-05', value: 110 },
      { date: '2026-07-25', value: 120 }, { date: '2026-08-19', value: 130 }
    ];
    eq('all keeps everything', filterByRange(H, 'all', '2026-08-20').length, 4);
    eq('ytd drops last year', filterByRange(H, 'ytd', '2026-08-20').map(h => h.date),
       ['2026-01-05', '2026-07-25', '2026-08-19']);
    eq('1m keeps only the last month', filterByRange(H, '1m', '2026-08-20').map(h => h.date),
       ['2026-07-25', '2026-08-19']);
    eq('filtering never mutates the source', H.length, 4);
    eq('empty history is safe', filterByRange([], '1m', '2026-08-20'), []);
    eq('entries without a date are dropped', filterByRange([{ value: 5 }], 'all', '2026-08-20'), []);

    const d = rangeDelta(filterByRange(H, 'ytd', '2026-08-20'), 'value');
    eq('range delta baht', d.chg, 20);
    ok('range delta percent', Math.abs(d.pct - (20 / 110 * 100)) < 1e-9, d.pct);
    eq('one point is not a delta', rangeDelta([{ date: 'x', value: 1 }], 'value'), null);
    eq('no points is not a delta', rangeDelta([], 'value'), null);
  }

  sec('range chips on the charts');
  {
    const prevReg = S.registry, prevKb = S.kb, prevRange = S.plRange, prevMode = S.stGroup;
    const iso = d => new Date(Date.now() - d * 86400000).toISOString().split('T')[0];
    S.stGroup = 'none';
    S.registry = { stocks: [{ ticker: 'AAA', company: 'A', sector: 'Tech', shares: 100, avg_cost: 10, current_price: 12, prev_close: 11, thesis_score: 70, catalysts: [], thesis_breakers: [] }] };
    S.kb = { score_history: {}, catalyst_log: {}, guidance_tracker: {}, evidence_clips: [],
             value_history: [
               { date: iso(200), value: 800, cost: 1000 },
               { date: iso(40),  value: 900, cost: 1000 },
               { date: iso(5),   value: 1100, cost: 1000 },
               { date: iso(0),   value: 1200, cost: 1000 }
             ] };
    S.plRange = 'all';
    renderMoneyDashboard();
    ok('hero shows today’s move', /วันนี้/.test(document.getElementById('moneyDash').textContent));
    ok('row shows today’s move', document.querySelector('.st-day') !== null);
    const bar = () => document.getElementById('plRangeBar');
    eq('a chip per range', bar().querySelectorAll('.sort-chip').length, 5);
    eq('active chip is the saved range', bar().querySelector('.sort-chip.on').dataset.k, 'all');
    const note = () => document.getElementById('valueChartNote');
    ok('all-time note spans the oldest point', note().textContent.indexOf(iso(200)) !== -1);

    setChartRange('pl', '1m');
    eq('choice is remembered', S.plRange, '1m');
    eq('chip follows the choice', bar().querySelector('.sort-chip.on').dataset.k, '1m');
    ok('note now starts inside the month', note().textContent.indexOf(iso(5)) !== -1);
    ok('note shows the change over the range', /\+฿100|\+฿100/.test(note().textContent), note().textContent);

    setChartRange('pl', '1y');
    ok('a year back reaches the older point', note().textContent.indexOf(iso(200)) !== -1);
    // a range with too few points explains itself instead of drawing a line
    S.kb.value_history = [{ date: iso(300), value: 800, cost: 1000 }, { date: iso(290), value: 850, cost: 1000 }];
    setChartRange('pl', '1m');
    ok('thin range says so', /เลือกช่วงที่กว้างขึ้น/.test(note().textContent), note().textContent);
    S.kb.value_history = [];
    setChartRange('pl', 'all');
    ok('no history at all keeps the old message', /ยังไม่มีข้อมูลย้อนหลัง/.test(note().textContent));

    S.registry = prevReg; S.kb = prevKb; S.plRange = prevRange; S.stGroup = prevMode;
  }

  // ══════════════════ contribution + warnings ══════════════════
  sec('contributionRows');
  {
    const prevReg = S.registry;
    S.registry = { stocks: [
      { ticker: 'WIN',  shares: 100, avg_cost: 10, current_price: 15 },  // +500 on cost 1000
      { ticker: 'LOSE', shares: 100, avg_cost: 20, current_price: 17 },  // −300 on cost 2000
      { ticker: 'FLAT', shares: 100, avg_cost: 10, current_price: 10 },  // 0 → dropped
      { ticker: 'WATCH', shares: 0,  avg_cost: 0 }                       // not held
    ] };
    const rows = contributionRows();
    eq('winners first, losers last', rows.map(r => r.ticker), ['WIN', 'LOSE']);
    eq('baht contribution', rows.map(r => Math.round(r.pl)), [500, -300]);
    // points are measured against total cost, so they add up to the portfolio return
    const tot = portfolioTotals();
    const sum = rows.reduce((a, r) => a + r.pts, 0);
    ok('points add up to the portfolio return', Math.abs(sum - tot.plPct) < 1e-9, sum + ' vs ' + tot.plPct);
    S.registry = { stocks: [] };
    eq('no holdings → no rows', contributionRows(), []);
    S.registry = prevReg;
  }

  sec('concentration + stale alerts');
  {
    const prevReg = S.registry, prevKb = S.kb;
    S.kb = { score_history: {}, catalyst_log: {}, guidance_tracker: {}, evidence_clips: [] };
    const fresh = new Date().toISOString();
    S.registry = { stocks: [
      { ticker: 'BIG', sector: 'Tech', shares: 100, avg_cost: 10, current_price: 10, thesis_score: 70, price_updated: fresh, catalysts: [] },
      { ticker: 'SM1', sector: 'Bank', shares: 10, avg_cost: 10, current_price: 10, thesis_score: 70, price_updated: fresh, catalysts: [] },
      { ticker: 'SM2', sector: 'Food', shares: 10, avg_cost: 10, current_price: 10, thesis_score: 70, price_updated: fresh, catalysts: [] }
    ] };
    let titles = getAlerts().map(a => a.title).join(' | ');
    ok('warns when one stock dominates', /BIG คิดเป็น 83%/.test(titles), titles);
    ok('warns when one sector dominates', /กลุ่ม Tech คิดเป็น 83%/.test(titles), titles);
    ok('fresh prices raise no clock alert', titles.indexOf('🕒') === -1, titles);

    S.registry.stocks = [
      { ticker: 'A', sector: 'Tech', shares: 10, avg_cost: 10, current_price: 10, thesis_score: 70, price_updated: fresh, catalysts: [] },
      { ticker: 'B', sector: 'Bank', shares: 10, avg_cost: 10, current_price: 10, thesis_score: 70, price_updated: fresh, catalysts: [] },
      { ticker: 'C', sector: 'Food', shares: 10, avg_cost: 10, current_price: 10, thesis_score: 70, price_updated: fresh, catalysts: [] },
      { ticker: 'D', sector: 'Energy', shares: 10, avg_cost: 10, current_price: 10, thesis_score: 70, price_updated: fresh, catalysts: [] },
      { ticker: 'E', sector: 'Retail', shares: 10, avg_cost: 10, current_price: 10, thesis_score: 70, price_updated: fresh, catalysts: [] }
    ];
    titles = getAlerts().map(a => a.title).join(' | ');
    ok('an evenly spread portfolio is quiet', titles.indexOf('⚖️') === -1, titles);

    // one sector only — nothing to compare against, so no sector warning
    S.registry.stocks = [
      { ticker: 'A', sector: 'Tech', shares: 10, avg_cost: 10, current_price: 10, thesis_score: 70, price_updated: fresh, catalysts: [] },
      { ticker: 'B', sector: 'Tech', shares: 10, avg_cost: 10, current_price: 10, thesis_score: 70, price_updated: fresh, catalysts: [] },
      { ticker: 'C', sector: 'Tech', shares: 10, avg_cost: 10, current_price: 10, thesis_score: 70, price_updated: fresh, catalysts: [] },
      { ticker: 'D', sector: 'Tech', shares: 10, avg_cost: 10, current_price: 10, thesis_score: 70, price_updated: fresh, catalysts: [] },
      { ticker: 'E', sector: 'Tech', shares: 10, avg_cost: 10, current_price: 10, thesis_score: 70, price_updated: fresh, catalysts: [] }
    ];
    ok('a single-sector portfolio does not warn about that sector',
       getAlerts().map(a => a.title).join(' | ').indexOf('กลุ่ม Tech') === -1);

    S.registry.stocks.forEach(s => { s.price_updated = new Date(Date.now() - 9 * 86400000).toISOString(); });
    titles = getAlerts().map(a => a.title).join(' | ');
    ok('old prices raise a clock alert', /🕒 ราคายังไม่ได้อัพเดต 9 วัน/.test(titles), titles);
    S.registry.stocks.forEach(s => { delete s.price_updated; });
    ok('never-fetched prices say so', /ยังไม่เคยดึงราคาตลาด/.test(getAlerts().map(a => a.title).join(' | ')));
    S.registry = prevReg; S.kb = prevKb;
  }

  // ══════════════════ trade log ══════════════════
  const near = (name, got, want, tol) => ok(name, Math.abs(got - want) <= (tol == null ? 0.005 : tol), 'got ' + got + ' want ' + want);

  sec('positionFromTrades — cost basis');
  {
    const prevLog = S.tradeLog, prevReg = S.registry, prevKb = S.kb;
    const log = ts => { S.tradeLog = { version: 1, trades: ts }; };

    log([{ id: '1', date: '2026-01-05', ticker: 'AAA', type: 'buy', qty: 100, price: 10, fee: 0 }]);
    let pos = positionFromTrades('AAA');
    eq('one buy: shares', pos.qty, 100);
    near('one buy: cost', pos.cost, 1000);
    near('one buy: average', pos.avgCost, 10);

    // fees are part of what the position cost
    log([{ id: '1', date: '2026-01-05', ticker: 'AAA', type: 'buy', qty: 100, price: 10, fee: 50 }]);
    near('buy fee joins the cost', positionFromTrades('AAA').avgCost, 10.5);
    near('buy fee counted as a fee too', positionFromTrades('AAA').fees, 50);

    // two buys average out
    log([
      { id: '1', date: '2026-01-05', ticker: 'AAA', type: 'buy', qty: 100, price: 10, fee: 0 },
      { id: '2', date: '2026-02-05', ticker: 'AAA', type: 'buy', qty: 100, price: 20, fee: 0 }
    ]);
    pos = positionFromTrades('AAA');
    eq('two buys: shares', pos.qty, 200);
    near('two buys: average', pos.avgCost, 15);

    // a partial sell realises against the average and leaves it alone
    log([
      { id: '1', date: '2026-01-05', ticker: 'AAA', type: 'buy',  qty: 100, price: 10, fee: 0 },
      { id: '2', date: '2026-02-05', ticker: 'AAA', type: 'buy',  qty: 100, price: 20, fee: 0 },
      { id: '3', date: '2026-03-05', ticker: 'AAA', type: 'sell', qty: 50,  price: 25, fee: 30 }
    ]);
    pos = positionFromTrades('AAA');
    eq('after a partial sell: shares', pos.qty, 150);
    near('average is untouched by a sell', pos.avgCost, 15);
    near('realised = (25 − 15) × 50 − 30', pos.realized, 470);
    near('remaining cost', pos.cost, 2250);

    // selling everything empties the position completely
    log([
      { id: '1', date: '2026-01-05', ticker: 'AAA', type: 'buy',  qty: 100, price: 10, fee: 0 },
      { id: '2', date: '2026-03-05', ticker: 'AAA', type: 'sell', qty: 100, price: 8,  fee: 0 }
    ]);
    pos = positionFromTrades('AAA');
    eq('sold out: no shares', pos.qty, 0);
    near('sold out: no cost left behind', pos.cost, 0);
    near('a loss is realised as a loss', pos.realized, -200);
    near('sold out: average resets', pos.avgCost, 0);

    // you cannot sell more than you hold
    log([
      { id: '1', date: '2026-01-05', ticker: 'AAA', type: 'buy',  qty: 100, price: 10, fee: 0 },
      { id: '2', date: '2026-03-05', ticker: 'AAA', type: 'sell', qty: 500, price: 12, fee: 0 }
    ]);
    pos = positionFromTrades('AAA');
    eq('oversell clamps to what is held', pos.qty, 0);
    near('oversell only realises the real shares', pos.realized, 200);

    // dividends are net of withholding and never touch the position
    log([
      { id: '1', date: '2026-01-05', ticker: 'AAA', type: 'buy', qty: 1000, price: 10, fee: 0 },
      { id: '2', date: '2026-05-05', ticker: 'AAA', type: 'div', qty: 1000, price: 0.5, tax: 50 }
    ]);
    pos = positionFromTrades('AAA');
    near('dividend net of tax', pos.dividends, 450);
    eq('dividend leaves the shares alone', pos.qty, 1000);
    near('dividend leaves the average alone', pos.avgCost, 10);
    near('withholding tax is not a fee', pos.fees, 0);

    // entry order does not matter; trade date does
    log([
      { id: '2', date: '2026-03-05', ticker: 'AAA', type: 'sell', qty: 50, price: 25, fee: 0 },
      { id: '1', date: '2026-01-05', ticker: 'AAA', type: 'buy',  qty: 100, price: 10, fee: 0 }
    ]);
    near('a sell typed first still sells what was bought earlier', positionFromTrades('AAA').realized, 750);
    eq('…and leaves the right number of shares', positionFromTrades('AAA').qty, 50);

    // same day: the order they were entered decides
    log([
      { id: '1', date: '2026-03-05', ticker: 'AAA', type: 'buy',  qty: 100, price: 10, fee: 0 },
      { id: '2', date: '2026-03-05', ticker: 'AAA', type: 'sell', qty: 100, price: 11, fee: 0 }
    ]);
    near('same-day buy then sell', positionFromTrades('AAA').realized, 100);

    // other tickers are not mixed in
    log([
      { id: '1', date: '2026-01-05', ticker: 'AAA', type: 'buy', qty: 100, price: 10, fee: 0 },
      { id: '2', date: '2026-01-05', ticker: 'BBB', type: 'buy', qty: 50,  price: 40, fee: 0 }
    ]);
    eq('AAA only counts AAA', positionFromTrades('AAA').qty, 100);
    eq('BBB only counts BBB', positionFromTrades('BBB').qty, 50);
    eq('lowercase ticker still matches', positionFromTrades('aaa').qty, 100);
    eq('unknown ticker is empty', positionFromTrades('ZZZ').n, 0);
    eq('no log at all is safe', (S.tradeLog = null, positionFromTrades('AAA').qty), 0);

    S.tradeLog = prevLog; S.registry = prevReg; S.kb = prevKb;
  }

  sec('tradeYearStats');
  {
    const prevLog = S.tradeLog;
    S.tradeLog = { version: 1, trades: [
      { id: '1', date: '2025-01-05', ticker: 'AAA', type: 'buy',  qty: 100, price: 10, fee: 20 },
      { id: '2', date: '2025-06-05', ticker: 'AAA', type: 'div',  qty: 100, price: 1, tax: 10 },
      { id: '3', date: '2026-03-05', ticker: 'AAA', type: 'sell', qty: 50, price: 20, fee: 30 },
      { id: '4', date: '2026-07-05', ticker: 'AAA', type: 'div',  qty: 50, price: 1, tax: 5 }
    ] };
    const st = tradeYearStats();
    near('realised lands in the year it was sold', st['2026'].realized, 50 * (20 - 10.2) - 30);
    eq('the buy year has no realised gain', st['2025'].realized, 0);
    near('dividends by year', st['2025'].dividends, 90);
    near('dividends the next year', st['2026'].dividends, 45);
    near('fees by year', st['2025'].fees, 20);
    eq('trade count by year', [st['2025'].n, st['2026'].n], [2, 2]);
    near('all-time realised', st.all.realized, 50 * (20 - 10.2) - 30);
    near('all-time dividends', st.all.dividends, 135);
    eq('years listed newest first', tradeYears(), ['2026', '2025']);
    S.tradeLog = prevLog;
  }

  sec('syncPositionsFromTrades');
  {
    const prevLog = S.tradeLog, prevReg = S.registry, prevKb = S.kb;
    S.kb = { score_history: {}, catalyst_log: {}, guidance_tracker: {}, evidence_clips: [] };
    S.registry = { portfolio_name: 'T', stocks: [
      { ticker: 'AAA', company: 'A', sector: 'Tech', shares: 999, avg_cost: 999, thesis_score: 70, catalysts: [], thesis_breakers: [] },
      { ticker: 'MAN', company: 'M', sector: 'Bank', shares: 40, avg_cost: 5, thesis_score: 70, catalysts: [], thesis_breakers: [] }
    ] };
    S.tradeLog = { version: 1, trades: [
      { id: '1', date: '2026-01-05', ticker: 'AAA', type: 'buy',  qty: 100, price: 10, fee: 0 },
      { id: '2', date: '2026-02-05', ticker: 'AAA', type: 'sell', qty: 40,  price: 15, fee: 0 },
      { id: '3', date: '2026-02-06', ticker: 'AAA', type: 'div',  qty: 60,  price: 1, tax: 6 },
      { id: '4', date: '2026-02-07', ticker: 'NEW', type: 'buy',  qty: 10,  price: 100, fee: 0 }
    ] };
    syncPositionsFromTrades();
    const aaa = S.registry.stocks.find(s => s.ticker === 'AAA');
    eq('shares come from the book', aaa.shares, 60);
    near('average cost comes from the book', aaa.avg_cost, 10);
    near('realised is stored on the stock', aaa.realized_pl, 200);
    near('dividends are stored on the stock', aaa.dividends_received, 54);
    eq('the stock is marked as book-driven', aaa.pos_source, 'trades');
    eq('position date follows the last trade', aaa.position_date, '2026-02-06');
    ok('a ticker only in the book gets created', !!S.registry.stocks.find(s => s.ticker === 'NEW'));
    eq('…with the position from the book', S.registry.stocks.find(s => s.ticker === 'NEW').shares, 10);
    const man = S.registry.stocks.find(s => s.ticker === 'MAN');
    eq('a hand-entered stock is left alone', [man.shares, man.avg_cost], [40, 5]);
    ok('…and is not marked book-driven', !fromTrades(man));

    // remove the trades → the stock goes back to being edited by hand
    S.tradeLog.trades = S.tradeLog.trades.filter(t => t.ticker !== 'AAA');
    syncPositionsFromTrades();
    ok('deleting every trade releases the stock', !fromTrades(S.registry.stocks.find(s => s.ticker === 'AAA')));
    ok('…and clears the derived numbers', S.registry.stocks.find(s => s.ticker === 'AAA').realized_pl === undefined);

    // opening balances for positions that predate the book
    S.tradeLog = { version: 1, trades: [] };
    syncPositionsFromTrades();
    const need = stocksNeedingOpening().map(s => s.ticker).sort();
    // NEW is in the list too: releasing it kept its last position, which is now
    // a hand-held one like any other.
    eq('hand-entered positions are offered an opening balance', need, ['AAA', 'MAN', 'NEW']);
    const op = openingTradeFor(S.registry.stocks.find(s => s.ticker === 'MAN'), '2026-08-20');
    eq('opening trade is a buy of the whole position', [op.type, op.qty, op.price], ['buy', 40, 5]);
    S.tradeLog.trades.push(op);
    syncPositionsFromTrades();
    const man2 = S.registry.stocks.find(s => s.ticker === 'MAN');
    eq('opening balance reproduces the position exactly', [man2.shares, man2.avg_cost], [40, 5]);
    eq('…and it is now book-driven', man2.pos_source, 'trades');
    eq('…so it is no longer offered', stocksNeedingOpening().map(s => s.ticker), ['AAA', 'NEW']);

    S.tradeLog = prevLog; S.registry = prevReg; S.kb = prevKb;
  }

  sec('วางพอร์ต never silently overwrites the book');
  {
    const prevLog = S.tradeLog, prevReg = S.registry, prevKb = S.kb, prevOff = S.offline, prevParsed = S.pasteParsed;
    S.offline = true;
    S.kb = { score_history: {}, catalyst_log: {}, guidance_tracker: {}, evidence_clips: [], value_history: [] };
    S.registry = { portfolio_name: 'T', stocks: [] };
    S.tradeLog = { version: 1, trades: [
      { id: '1', date: '2026-01-05', ticker: 'BOOK', type: 'buy', qty: 100, price: 10, fee: 0 }
    ] };
    syncPositionsFromTrades();
    S.registry.stocks.push({ ticker: 'HAND', company: 'H', sector: '—', shares: 10, avg_cost: 5, thesis_score: 70, catalysts: [], thesis_breakers: [] });

    S.pasteParsed = parsePortfolioPaste('#วันที่ 2026-08-01\nBOOK | 999 | 99 | 12\nHAND | 20 | 6 | 7');
    S.pasteOverwrite = false;
    applyPastePort();
    const book = S.registry.stocks.find(s => s.ticker === 'BOOK');
    const hand = S.registry.stocks.find(s => s.ticker === 'HAND');
    eq('a book-driven position survives the paste', [book.shares, book.avg_cost], [100, 10]);
    eq('…but its market price is still updated', book.current_price, 12);
    eq('a hand-entered position is updated as before', [hand.shares, hand.avg_cost], [20, 6]);

    // ticking the override hands the stock back to the pasted numbers
    S.pasteParsed = parsePortfolioPaste('#วันที่ 2026-08-02\nBOOK | 999 | 99 | 13');
    S.pasteOverwrite = true;
    applyPastePort();
    const book2 = S.registry.stocks.find(s => s.ticker === 'BOOK');
    eq('override wins when asked for', [book2.shares, book2.avg_cost], [999, 99]);
    eq('…and the stock stops following the book', book2.pos_source, 'manual-override');
    eq('…while the trades themselves are untouched', S.tradeLog.trades.length, 1);
    S.pasteOverwrite = false;

    S.tradeLog = prevLog; S.registry = prevReg; S.kb = prevKb; S.offline = prevOff; S.pasteParsed = prevParsed;
  }

  sec('trade log screen');
  {
    const prevLog = S.tradeLog, prevReg = S.registry, prevKb = S.kb, prevOff = S.offline;
    S.offline = true;
    S.kb = { score_history: {}, catalyst_log: {}, guidance_tracker: {}, evidence_clips: [], value_history: [] };
    S.registry = { portfolio_name: 'T', stocks: [
      { ticker: 'AAA', company: 'A', sector: 'Tech', shares: 0, avg_cost: 0, thesis_score: 70, catalysts: [], thesis_breakers: [] }
    ] };
    S.tradeLog = { version: 1, trades: [] };
    openTrades();
    ok('empty book explains itself', /ยังไม่มีรายการ/.test(document.getElementById('tradeList').textContent));

    // add a buy through the real form
    openTradeForm();
    document.getElementById('tfDate').value = '2026-02-01';
    document.getElementById('tfType').value = 'buy';
    document.getElementById('tfTicker').value = 'aaa';
    document.getElementById('tfQty').value = '100';
    document.getElementById('tfPrice').value = '10';
    document.getElementById('tfFee').value = '25';
    updateTradePreview();
    ok('form previews what it will cost', /1,025/.test(document.getElementById('tfPreview').textContent),
       document.getElementById('tfPreview').textContent);
    saveTradeForm();
    eq('the trade is in the book', S.tradeLog.trades.length, 1);
    eq('ticker is stored uppercase', S.tradeLog.trades[0].ticker, 'AAA');
    eq('the position follows immediately', S.registry.stocks.find(s => s.ticker === 'AAA').shares, 100);
    ok('the list shows it', /AAA · ซื้อ/.test(document.getElementById('tradeList').textContent));
    ok('the summary counts it', /รายการ/.test(document.getElementById('tradeSummary').textContent));

    // a sell shows what it realised
    openTradeForm();
    document.getElementById('tfDate').value = '2026-03-01';
    document.getElementById('tfType').value = 'sell';
    document.getElementById('tfTicker').value = 'AAA';
    document.getElementById('tfQty').value = '50';
    document.getElementById('tfPrice').value = '20';
    document.getElementById('tfFee').value = '0';
    saveTradeForm();
    eq('two entries now', S.tradeLog.trades.length, 2);
    eq('shares halved', S.registry.stocks.find(s => s.ticker === 'AAA').shares, 50);
    ok('the sell row shows realised gain', /กำไรที่รับรู้/.test(document.getElementById('tradeList').textContent));
    ok('newest entry is listed first',
       document.getElementById('tradeList').textContent.indexOf('2026-03-01') <
       document.getElementById('tradeList').textContent.indexOf('2026-02-01'));

    // a dividend prefills the 10% withholding
    openTradeForm();
    document.getElementById('tfQty').value = '50';
    document.getElementById('tfPrice').value = '2';
    document.getElementById('tfType').value = 'div';
    onTradeTypeChange();
    near('withholding prefilled at 10%', +document.getElementById('tfTax').value, 10);
    ok('fee field hides for dividends', document.getElementById('tfFeeGroup').classList.contains('hidden'));
    document.getElementById('tfDate').value = '2026-05-01';
    document.getElementById('tfTicker').value = 'AAA';
    saveTradeForm();
    near('dividend recorded net of tax', positionFromTrades('AAA').dividends, 90);

    // filters
    setTradeYear('2026');
    eq('all three are in 2026', filteredTrades().length, 3);
    setTradeTicker('AAA');
    eq('filtering by ticker keeps them', filteredTrades().length, 3);
    setTradeYear('all');
    eq('back to everything', filteredTrades().length, 3);

    // the detail modal shows the stock's own page of the book
    const dh = tradeDetailHtml(S.registry.stocks.find(s => s.ticker === 'AAA'));
    ok('detail shows the entry count', /3 รายการ/.test(dh), dh.slice(0, 120));
    ok('detail shows realised gain', /กำไรที่ขายจริง/.test(dh));
    ok('detail of an untouched stock offers to start one',
       /ยังไม่มีรายการ/.test(tradeDetailHtml({ ticker: 'ZZZ' })));

    // deleting the last trade of a ticker releases it
    S.tradeLog.trades = [];
    syncPositionsFromTrades();
    ok('no trades → not book-driven', !fromTrades(S.registry.stocks.find(s => s.ticker === 'AAA')));

    closeM('tradeModal');
    S.tradeLog = prevLog; S.registry = prevReg; S.kb = prevKb; S.offline = prevOff;
  }

  // ══════════════════ benchmark vs the index ══════════════════
  sec('benchParseChart');
  {
    const payload = { chart: { result: [{
      timestamp: [1754006400, 1754092800, 1754179200],
      indicators: { quote: [{ close: [1200, null, 1230] }] }
    }] } };
    const pts = benchParseChart(payload);
    eq('drops days with no close', pts.length, 2);
    eq('closes come through', pts.map(p => p.close), [1200, 1230]);
    ok('dates look like dates', /^\d{4}-\d{2}-\d{2}$/.test(pts[0].date), pts[0].date);
    eq('an error payload is empty, not a crash', benchParseChart({ chart: { error: 'x' } }), []);
    eq('null payload is empty', benchParseChart(null), []);
    eq('missing quotes is empty', benchParseChart({ chart: { result: [{ timestamp: [1] }] } }), []);
  }

  sec('benchOverlay / benchVerdict');
  {
    const prevBench = S.bench, prevRange = S.plRange;
    S.plRange = 'all';
    S.bench = { symbol: '^SET.BK', points: [
      { date: '2026-01-01', close: 1000 },
      { date: '2026-02-01', close: 1100 },
      { date: '2026-03-01', close: 1050 }
    ] };
    eq('close on an exact date', benchCloseOn('2026-02-01'), 1100);
    eq('close falls back to the last trading day before', benchCloseOn('2026-02-15'), 1100);
    eq('before the series starts there is nothing', benchCloseOn('2025-12-31'), null);

    const hist = [
      { date: '2026-01-01', value: 100000, cost: 90000 },
      { date: '2026-02-01', value: 120000, cost: 90000 },
      { date: '2026-03-01', value: 130000, cost: 90000 }
    ];
    const ov = benchOverlay(hist);
    // the same money put into the index on day one
    eq('overlay starts at the portfolio value', ov[0], 100000);
    near('overlay follows the index', ov[1], 110000);
    near('…and back down with it', ov[2], 105000);

    const v = benchVerdict(hist);
    near('portfolio return', v.port, 30);
    near('index return', v.bench, 5);
    near('difference is the alpha', v.diff, 25);
    ok('note says it beat the index', /ชนะดัชนี/.test(benchNoteHtml(hist)), benchNoteHtml(hist));

    // a portfolio that lags
    const lag = [{ date: '2026-01-01', value: 100000, cost: 90000 }, { date: '2026-02-01', value: 101000, cost: 90000 }];
    ok('note says it lagged', /แพ้ดัชนี/.test(benchNoteHtml(lag)));

    S.bench = null;
    eq('no index data → no overlay', benchOverlay(hist), null);
    eq('…and no verdict', benchVerdict(hist), null);
    ok('…so the note offers to fetch it', /ดึงดัชนี SET/.test(benchNoteHtml(hist)));
    S.bench = { symbol: 'x', points: [{ date: '2027-01-01', close: 1000 }] };
    eq('index history that starts after the range is unusable', benchOverlay(hist), null);
    S.bench = prevBench; S.plRange = prevRange;
  }

  // ══════════════════ dividends ══════════════════
  sec('last12Months');
  eq('twelve months ending this one', last12Months('2026-08-20').length, 12);
  eq('oldest is eleven months back', last12Months('2026-08-20')[0], '2025-09');
  eq('newest is this month', last12Months('2026-08-20')[11], '2026-08');
  eq('crossing the new year', last12Months('2026-01-15')[0], '2025-02');

  sec('divByMonth / divByTicker12m / forecast');
  {
    const prevLog = S.tradeLog, prevReg = S.registry, prevXd = S.xd;
    S.tradeLog = { version: 1, trades: [
      { id: 'd1', date: '2026-04-22', ticker: 'SCB',  type: 'div', qty: 500,  price: 5.5,  tax: 275 },
      { id: 'd2', date: '2026-08-06', ticker: 'BDMS', type: 'div', qty: 1000, price: 0.75, tax: 75 },
      { id: 'd3', date: '2024-05-05', ticker: 'SCB',  type: 'div', qty: 500,  price: 4,    tax: 200 },
      { id: 'b1', date: '2026-01-05', ticker: 'SCB',  type: 'buy', qty: 500,  price: 105,  fee: 0 }
    ] };
    const months = divByMonth('2026-08-20');
    eq('twelve buckets', months.length, 12);
    near('april dividend lands in april', months.find(m => m.month === '2026-04').amount, 2475);
    near('august dividend lands in august', months.find(m => m.month === '2026-08').amount, 675);
    eq('a month with nothing is zero, not missing', months.find(m => m.month === '2026-06').amount, 0);
    near('twelve-month total', divTotal12m('2026-08-20'), 3150);
    ok('an old dividend is outside the window', divTotal12m('2026-08-20') < 3150 + 1600);
    ok('buys are not dividends', divTrades().length === 3);

    const byTk = divByTicker12m('2026-08-20');
    near('per-stock received', byTk.SCB.received, 2475);
    near('per-share for the year', byTk.SCB.dps, 5.5);
    ok('the old year is excluded from per-stock too', Math.abs(byTk.SCB.dps - 5.5) < 1e-9);

    S.registry = { stocks: [
      { ticker: 'SCB',  shares: 500,  avg_cost: 105 },
      { ticker: 'BDMS', shares: 1000, avg_cost: 22.5 },
      { ticker: 'NEW',  shares: 200,  avg_cost: 10 },
      { ticker: 'DRX',  shares: 100,  avg_cost: 50 },
      { ticker: 'GONE', shares: 0,    avg_cost: 0 }
    ] };
    S.xd = { fetched_at: 'x', items: { NEW: { dps: 1.25, conf: 'confirmed' }, DRX: { dps: 3, isDR: true } } };
    const fc = divForecast12m('2026-08-20');
    eq('biggest expected first', fc.map(r => r.ticker), ['SCB', 'BDMS', 'NEW']);
    near('forecast repeats what it paid per share', fc[0].cash, 2750);
    eq('…from the book when there is history', fc[0].source, 'book');
    eq('a stock with no history falls back to XD', fc[2].source, 'xd');
    near('…on the shares held now', fc[2].cash, 250);
    ok('DRs are left out (issuer sets its own amount)', !fc.find(r => r.ticker === 'DRX'));
    ok('stocks no longer held are left out', !fc.find(r => r.ticker === 'GONE'));

    near('yield on cost', yieldOnCost({ ticker: 'SCB', shares: 500, avg_cost: 105 }, '2026-08-20'), 2475 / 52500 * 100);
    eq('no dividends → no yield on cost', yieldOnCost({ ticker: 'NEW', shares: 200, avg_cost: 10 }, '2026-08-20'), null);
    eq('no cost → no yield on cost', yieldOnCost({ ticker: 'SCB', shares: 0, avg_cost: 0 }, '2026-08-20'), null);

    // the screen
    renderDivBook();
    const h = document.getElementById('divBook').innerHTML;
    ok('shows the twelve-month total', h.indexOf('฿3,150') !== -1);
    ok('shows a bar per month', document.querySelectorAll('#divBook .dv-bar').length === 12);
    ok('lists the forecast', h.indexOf('SCB') !== -1 && h.indexOf('฿2,750') !== -1);
    ok('marks rows that came from XD instead of the book', h.indexOf('จาก XD') !== -1);
    ok('shows yield on cost', h.indexOf('4.71%') !== -1, 'yield row missing');

    S.tradeLog = { version: 1, trades: [] };
    renderDivBook();
    ok('with no dividends yet it says how to start',
       /ยังไม่มีปันผลในสมุด/.test(document.getElementById('divBook').textContent));

    S.tradeLog = prevLog; S.registry = prevReg; S.xd = prevXd;
  }

  sec('logging a dividend from the XD table');
  {
    const prevLog = S.tradeLog, prevReg = S.registry, prevOff = S.offline;
    S.offline = true;
    S.registry = { stocks: [{ ticker: 'CPF', company: 'C', sector: '—', shares: 6500, avg_cost: 20, thesis_score: 70, catalysts: [], thesis_breakers: [] }] };
    S.tradeLog = { version: 1, trades: [] };
    const btn = document.createElement('button');
    btn.dataset.tk = 'CPF'; btn.dataset.dps = '0.45'; btn.dataset.shares = '6500'; btn.dataset.date = '2026-08-31';
    logDividendFor(btn);
    eq('form opens as a dividend', document.getElementById('tfType').value, 'div');
    eq('ticker prefilled', document.getElementById('tfTicker').value, 'CPF');
    eq('shares prefilled', +document.getElementById('tfQty').value, 6500);
    eq('amount per share prefilled', +document.getElementById('tfPrice').value, 0.45);
    eq('XD date prefilled', document.getElementById('tfDate').value, '2026-08-31');
    near('10% withholding prefilled', +document.getElementById('tfTax').value, 292.5);
    saveTradeForm();
    near('saving it books the net amount', positionFromTrades('CPF').dividends, 6500 * 0.45 - 292.5);
    closeM('tradeModal');
    S.tradeLog = prevLog; S.registry = prevReg; S.offline = prevOff;
  }

  L.push('');
  L.push('PASS ' + pass + '   FAIL ' + fail);
  const pre = document.createElement('pre');
  pre.id = 'testout';
  pre.textContent = L.join('\n');
  document.body.appendChild(pre);

})();
