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

  L.push('');
  L.push('PASS ' + pass + '   FAIL ' + fail);
  const pre = document.createElement('pre');
  pre.id = 'testout';
  pre.textContent = L.join('\n');
  document.body.appendChild(pre);

})();
