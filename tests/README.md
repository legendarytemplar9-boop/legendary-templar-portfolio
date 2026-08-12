# Tests

```
python3 tests/run_tests.py
```

Prints one line per assertion and ends with `PASS n   FAIL n`. Exit code 0 means green.

## How it works

`tests.js` is appended to a throwaway copy of `index.html` and run in headless
Chrome, so the assertions exercise the **real** app code and the **real** DOM —
no npm, no puppeteer, no mocks of the functions under test. The harness collects
results into a `<pre id="testout">`, which `run_tests.py` scrapes out of
`--dump-dom` output.

Because it is the real page, tests can click actual buttons
(`bar.querySelector('[data-key="value"]').click()`) and assert on what the DOM
then contains, rather than calling handlers with made-up arguments.

## What is covered

- `ppNum` / `ppDate` / `ppStripThousands` / `ppSplit` — number, date and
  delimiter handling, including Thai Buddhist years and ฿ signs
- `parsePortfolioPaste` — happy paths, the messy shapes Claude emits (markdown
  tables, code fences, header rows), bad input, duplicates, JSON fallback
- Sorting — all four keys in both directions, tie-breaking, `setPlSort`
  toggle behaviour and localStorage persistence
- `applyPastePort` — updates existing holdings without clobbering
  company/sector/score, creates unknown tickers, seeds KB entries, records the
  value snapshot at the pasted date, leaves `current_price` alone when a paste
  omits it
- Render smoke tests — rows, sort chips, the per-row ✏️ button, and an empty
  portfolio not crashing

## Adding tests

Append to `tests.js` using the existing helpers: `sec('group name')` starts a
section, `ok(name, cond, extra)` asserts a boolean, `eq(name, got, want)`
compares by `JSON.stringify`. Seed state by assigning to `S.registry` / `S.kb`
directly and set `S.offline = true` so nothing tries to reach Google Drive.

## Gotchas

- Set `S.offline = true` before anything that calls `persistRegistryKB()`,
  or the test will try to talk to Drive.
- Chrome path is hardcoded to the macOS app bundle in `run_tests.py`.
- The generated `tests/_test_page.html` is gitignored; it is deleted on a
  green run and left behind on failure so you can open it in a browser.
