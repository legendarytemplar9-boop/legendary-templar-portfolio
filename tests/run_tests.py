#!/usr/bin/env python3
"""Run tests/tests.js against the real index.html in headless Chrome.

    python3 tests/run_tests.py

No npm, no puppeteer: tests.js is appended to a throwaway copy of index.html,
Chrome renders it with --dump-dom, and the results are scraped out of the
<pre id="testout"> the harness leaves behind. Exit code 0 = all green.
"""
import html as H
import pathlib
import re
import subprocess
import sys

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent
SRC = ROOT / "index.html"
TESTJS = HERE / "tests.js"
OUT = HERE / "_test_page.html"        # generated, gitignored
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"


def main() -> int:
    if not pathlib.Path(CHROME).exists():
        print(f"!! Chrome not found at {CHROME}", file=sys.stderr)
        return 3

    page = SRC.read_text()
    if "</body>" not in page:
        print("!! index.html has no </body> to inject into", file=sys.stderr)
        return 3
    OUT.write_text(page.replace("</body>", "<script>\n" + TESTJS.read_text() + "\n</script>\n</body>"))

    proc = subprocess.run(
        [CHROME, "--headless", "--disable-gpu", "--no-sandbox",
         "--virtual-time-budget=4000", "--dump-dom", OUT.as_uri()],
        capture_output=True, text=True, timeout=120,
    )

    m = re.search(r'<pre id="testout">(.*?)</pre>', proc.stdout, re.S)
    if not m:
        # No output element means the page threw before the harness finished.
        print("!! no test output — the page probably threw", file=sys.stderr)
        print(proc.stdout[:3000], file=sys.stderr)
        print(proc.stderr[-3000:], file=sys.stderr)
        return 2

    report = H.unescape(m.group(1))
    print(report)
    green = bool(re.search(r"FAIL 0$", report.strip()))
    # Keep the generated page on failure so it can be opened in a real browser.
    if green:
        OUT.unlink(missing_ok=True)
    else:
        print(f"\nfailed page kept for debugging: {OUT}", file=sys.stderr)
    return 0 if green else 1


if __name__ == "__main__":
    sys.exit(main())
