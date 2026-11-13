# MARKET-DEX — verified free-first terminal

Standalone static site built for `denism2013/market-dex-website` and Cloudflare Pages (GitHub Pages is optional). No paid API required. Source code is licensed/redistributable only to the extent allowed by each provider.

## Data guarantees and limitations

- **Observed daily equity/ETF prices:** Yahoo Finance via the unofficial `yfinance` Python package, with source dates, unadjusted closes, OHLCV validation and transparent missingness. This is **not a live licensed quote feed**, and Yahoo may rate-limit collection or restrict reuse.
- **Treasury 3D yield surface:** official U.S. Treasury **daily constant-maturity par yields**, not ETF proxies, spot rates or forward rates. The original Treasury feed retains its recent history. A separate Federal Reserve H.15/FRED archive stores all available dated observations since 1990 across 11 series (DGS1MO through DGS30). Missing tenors remain missing; 2-month yields are not part of this FRED set. The surface *interpolates visually between observed points only*.
- **Technical analysis:** close and volume charts with 3M/6M/1Y/all windows, SMA20/50/200, Wilder RSI14, MACD(12,26,9), relative volume versus the previous 20 sessions, 20-day return and annualized realized volatility. Indicators are computed from full loaded history before chart filtering. Insufficient warm-up displays an em dash. Unadjusted closes can have corporate-action artifacts. The updater requests three years of bars; cached series keep their original shorter coverage during an outage.
- **History controls:** FRED/Treasury source selector, 1M/3M/1Y/5Y/10Y/all/custom dates. The 3D canvas preserves drag, zoom, keyboard, reset and auto-orbit controls and samples at most 100 actual dates for performance. Maturity/date axes are equally spaced for inspection and disclosed as not to scale.
- **Publication:** every Monday-Friday at **5 PM America/New_York**, using timezone-aware GitHub Actions cron; Actions runs may be delayed. Each value has its own **observation date**. The site refreshes `data/latest.json` on each opening and when the Refresh control is used.
- **Outages:** the updater retains previously verified observations with original as-of dates; it does not fabricate a fresh price. If both feeds fail, the last snapshot is untouched. The UI marks old dates as stale. Official U.S. Treasury data can publish on a different schedule from listed securities.
- **Universe:** phase-one curated 35 US securities and ETFs. It is not Russell 3000, global equity coverage, options order flow, or true real-time pricing. Missing features are shown as phased roadmap only.
- **No private credentials:** publication uses read-only open data sources and `GITHUB_TOKEN` for committing data changes; no key should be committed to the repository.

## Deploy

1. Commit these files to the existing public `denism2013/market-dex-website` repo, keeping everything at the root. The earlier `index.html` was only a Coming Soon placeholder.
2. **Cloudflare Dashboard → Workers & Pages → your existing Pages project**: confirm it is connected to `denism2013/market-dex-website` and that the production branch is `main`. For this plain HTML site, no framework or build command is needed; output directory is the repository root (`.`) if Cloudflare asks.
3. Publish or wait for its Git-linked deployment. Test the Cloudflare-provided `*.pages.dev` URL first, then verify your custom `market-dex.com` domain is linked to that Pages project. GitHub repo changes alone do **not** prove Cloudflare publication.
4. **GitHub → Actions → MARKET-DEX verified EOD refresh → Run workflow** once to populate the first yfinance price snapshot. Then the scheduled 5 PM ET job runs on business weekdays.
5. **GitHub → Settings → Actions → General → Workflow permissions → Read and write permissions** if the updater's commit step gets `403`. Cloudflare should redeploy automatically when the data commit lands on `main`.
6. Do not change `market-dex-data` or publish secrets. If desired, GitHub Pages can be enabled separately under GitHub → Settings → Pages.

## Local

Run `python -m http.server 8000` in the site directory and open `http://localhost:8000`. The `data/bootstrap.js` script supports direct-file opening after an updater run, though browsers restrict some `file://` features.

Install `pip install -r requirements.txt`, then run `python scripts/update_market_data.py` on a network-enabled machine. The script overwrites **only** `data/latest.json` and `data/bootstrap.js` after source validation; it does not modify the source applications.

## Integrating other dashboards

The existing 13 original applications are archived separately in the MARKET-DEX source package. The first release implements the shared Command, Research, Sector ETF, and official Treasury curve core. Later phases integrate VANTA options, ATLAS portfolio sphere, ORBITAL and the trading desk behind the same snapshot/schema, keeping legacy HTML available until verified parity.

## Source references

- US Treasury: https://home.treasury.gov/policy-issues/financing-the-government/interest-rate-statistics
- Download CSV: https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_yield_curve
- yfinance: https://ranaroussi.github.io/yfinance/
- GitHub Actions timezone-aware cron: https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#onschedule
## November 13, 2026 update

The top-of-page notice states the weekday 5 PM New York schedule, provider/publication delays, daily-close basis and original observation dates. `data/treasury-history.json` is collected independently by the same scheduled updater. FRED public dated table exports require no API key; parser accepts the official CSV representation too. Total FRED failure retains the previous archive without advancing collection time; partial failures are recorded by series. The initial backfill contains 9,221 dates from 1990-01-02 through 2026-11-10. Source: https://fred.stlouisfed.org/series/DGS10 (Board of Governors H.15 via FRED).

The exact supplied `market-dex-logo-cinematic(1).gif` is preserved as `assets/market-dex-logo.gif`; inspection found only one frame. Original WebP/PNG assets remain. The deployed baseline contained Command, Company Lens, Treasury 3D and Sector Rotation, with roadmap entries for other applications; this update deletes none of them and does not replace or migrate the separate `market-dex-data` ORBITAL applications.

Verification: `node --check app.js`, `node --check technical.js`, `node tests/technical.test.cjs`, `python -m unittest discover -s tests`. Preview checks cover range/source selection, custom/empty date ranges, ticker selection and 3D keyboard/reset/orbit controls. Live deployment must be verified separately from a successful GitHub push.
