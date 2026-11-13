# MARKET-DEX — verified free-first terminal

Standalone static site built for `denism2013/market-dex-website` and Cloudflare Pages (GitHub Pages is optional). No paid API required. Source code is licensed/redistributable only to the extent allowed by each provider.

## Data guarantees and limitations

- **Observed daily equity/ETF prices:** Yahoo Finance via the unofficial `yfinance` Python package, with source dates, unadjusted closes, OHLCV validation and transparent missingness. This is **not a live licensed quote feed**, and Yahoo may rate-limit collection or restrict reuse.
- **Treasury 3D yield surface:** official U.S. Treasury **daily constant-maturity par yields**, not ETF proxies, spot rates or forward rates. Uses at least 10 validated maturities and up to 64 business days of published history. The surface *interpolates visually between observed points only*.
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