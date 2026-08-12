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
      { ticker: 'BBB', shares: 100, avg_cost: 10, current_price: 12, thesis_score: 70 }, // cost 1000 val 1200 pl +200
      { ticker: 'AAA', shares: 100, avg_cost: 50, current_price: 45, thesis_score: 70 }, // cost 5000 val 4500 pl -500
      { ticker: 'CCC', shares: 200, avg_cost: 20, current_price: 30, thesis_score: 70 }, // cost 4000 val 6000 pl +2000
      { ticker: 'ZZZ', shares: 0, avg_cost: 0, thesis_score: 70 }                        // not held → excluded
    ]
  };
  S.kb = { score_history: {}, catalyst_log: {}, guidance_tracker: {}, evidence_clips: [], value_history: [] };

  const tickersBy = (key, dir) => { S.plSort = { key, dir }; return sortedPlRows().map(s => s.ticker); };
  eq('excludes unheld', tickersBy('value', 'desc').includes('ZZZ'), false);
  eq('value desc', tickersBy('value', 'desc'), ['CCC', 'AAA', 'BBB']);
  eq('value asc', tickersBy('value', 'asc'), ['BBB', 'AAA', 'CCC']);
  eq('cost desc', tickersBy('cost', 'desc'), ['AAA', 'CCC', 'BBB']);
  eq('cost asc', tickersBy('cost', 'asc'), ['BBB', 'CCC', 'AAA']);
  eq('pl desc', tickersBy('pl', 'desc'), ['CCC', 'BBB', 'AAA']);
  eq('pl asc', tickersBy('pl', 'asc'), ['AAA', 'BBB', 'CCC']);
  eq('ticker asc', tickersBy('ticker', 'asc'), ['AAA', 'BBB', 'CCC']);
  eq('ticker desc', tickersBy('ticker', 'desc'), ['CCC', 'BBB', 'AAA']);

  eq('stats value', plRowStats(S.registry.stocks[0]).value, 1200);
  eq('stats pl', plRowStats(S.registry.stocks[1]).pl, -500);
  eq('stats pct', Math.round(plRowStats(S.registry.stocks[2]).pct), 50);
  eq('no price → value falls back to cost', plRowStats({ shares: 10, avg_cost: 5 }).value, 50);

  // tie-break stability
  S.registry.stocks = [
    { ticker: 'DDD', shares: 10, avg_cost: 10, current_price: 10 },
    { ticker: 'AAA', shares: 10, avg_cost: 10, current_price: 10 }
  ];
  eq('ties break alphabetically', tickersBy('value', 'desc'), ['AAA', 'DDD']);

  sec('setPlSort toggle');
  S.plSort = { key: 'value', dir: 'desc' };
  setPlSort('value'); eq('same key flips to asc', S.plSort, { key: 'value', dir: 'asc' });
  setPlSort('value'); eq('flips back to desc', S.plSort, { key: 'value', dir: 'desc' });
  setPlSort('ticker'); eq('ticker defaults asc', S.plSort, { key: 'ticker', dir: 'asc' });
  setPlSort('pl'); eq('money defaults desc', S.plSort, { key: 'pl', dir: 'desc' });
  setPlSort('cost'); eq('cost defaults desc', S.plSort, { key: 'cost', dir: 'desc' });
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

  sec('render smoke test');
  S.registry = {
    portfolio_name: 'T', last_updated: TODAY, stocks: [
      { ticker: 'AAA', company: 'A', sector: 'X', shares: 100, avg_cost: 10, current_price: 12, thesis_score: 70, thesis_status: '🟡', catalysts: [], thesis_breakers: [] },
      { ticker: 'BBB', company: 'B', sector: 'Y', shares: 50, avg_cost: 20, current_price: 18, thesis_score: 70, thesis_status: '🟡', catalysts: [], thesis_breakers: [] }
    ]
  };
  S.plSort = { key: 'ticker', dir: 'asc' };
  try {
    renderMoneyDashboard();
    const rowsEl = document.getElementById('plRows');
    ok('rows rendered', rowsEl && rowsEl.querySelectorAll('.md-row').length === 2,
       rowsEl ? rowsEl.querySelectorAll('.md-row').length : 'no #plRows');
    ok('edit button per row', rowsEl.querySelectorAll('.md-row-acts .nw-act').length === 2);
    ok('edit button targets ticker',
       rowsEl.querySelector('.md-row-acts .nw-act').dataset.ticker === 'AAA',
       rowsEl.querySelector('.md-row-acts .nw-act')?.dataset.ticker);
    const bar = document.getElementById('plSortBar');
    ok('4 sort chips', bar.querySelectorAll('.sort-chip').length === 4, bar.querySelectorAll('.sort-chip').length);
    ok('active chip marked', bar.querySelectorAll('.sort-chip.on').length === 1);
    ok('active chip shows direction', /↑/.test(bar.querySelector('.sort-chip.on').textContent));
    ok('row shows cost', /ทุน/.test(rowsEl.innerHTML));
    ok('row shows baht P/L', /฿/.test(rowsEl.innerHTML));

    // clicking a chip re-sorts the DOM
    bar.querySelector('[data-key="value"]').click();
    const order = [...document.getElementById('plRows').querySelectorAll('.md-row b')].map(b => b.textContent);
    eq('click chip re-sorts by value desc', order, ['AAA', 'BBB']);
    bar.querySelector('[data-key="value"]').click();
    const order2 = [...document.getElementById('plRows').querySelectorAll('.md-row b')].map(b => b.textContent);
    eq('second click flips to asc', order2, ['BBB', 'AAA']);

    // edit button opens the details modal prefilled
    document.getElementById('plRows').querySelector('.nw-act').click();
    ok('edit opens details modal', !document.getElementById('editDetailsModal').classList.contains('hidden'));
    eq('modal prefilled ticker', document.getElementById('edTicker').value, 'BBB');
    eq('modal prefilled shares', document.getElementById('edShares').value, '50');
    eq('modal prefilled cost', document.getElementById('edAvgCost').value, '20');
  } catch (e) {
    fail++; L.push('  FAIL render smoke threw → ' + e.message + '\n' + e.stack);
  }

  sec('empty portfolio does not crash');
  try {
    S.registry = { portfolio_name: 'T', last_updated: TODAY, stocks: [] };
    renderMoneyDashboard();
    ok('empty renders placeholder', /ยังไม่มีหุ้น/.test(document.getElementById('moneyDash').innerHTML));
  } catch (e) { fail++; L.push('  FAIL empty portfolio threw → ' + e.message); }

  L.push('');
  L.push('PASS ' + pass + '   FAIL ' + fail);
  const pre = document.createElement('pre');
  pre.id = 'testout';
  pre.textContent = L.join('\n');
  document.body.appendChild(pre);
})();
