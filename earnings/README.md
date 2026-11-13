# Earnings Intelligence Lab (Cloudflare Pages)
- Entry: `/earnings/` linked from Company Lens in the primary site.
- `functions/api/earnings.js` invokes Workers AI through `context.env.AI`. Requires a Cloudflare Pages **Workers AI binding named `AI`**, in preview AND production, followed by redeploy.
- No app storage, cookies, localStorage, sessionStorage, Analytics events, persistent transcript tables, or transcript logging. The report and transcript exist in browser memory and Worker/AI inference memory only. Explicit Clear Session wipes current UI; closing the tab discards it.
- Provider-side retention, billing telemetry, error logs, network instrumentation and compliance settings are governed by the configured Cloudflare account; before public use, disable Workers Logs/observability and request/body capture, check AI service retention terms, enforce rate limits, bot challenge and spend caps via Cloudflare dashboard. Application code alone CANNOT guarantee global zero retention.
- Input accepts paste or .txt, 500–180,000 characters; PDF/DOCX text may be pasted after extraction. Long transcripts are split into 12k-character segments and then synthesized, with model output limitations and source uncertainty disclosed.
- Public quote context: `data/market-preview.json`, curated tickers only, observation dates. Worker marks browser-supplied values unverified; for production financial provenance improve with independent Worker-side snapshot fetch and schema validation.
- No fabricated consensus, SEC corroboration, event reaction or price targets. AI may still make mistakes: human review required.
- Security: POST JSON only, same-origin check (when Origin present), size validation, no-store, no secrets in browser, transcript regarded as untrusted prompt content. CSRF/bot/rate limits should additionally be configured at Cloudflare edge.
## Acceptance test
1. Existing command, Company Lens, Treasury, Internals, Global, Experimental views and audio still navigate and render.
2. Lab reachable from left navigation, Company Lens action and URL `/earnings/`.
3. Text file imported locally; invalid and over-size formats rejected; paste and character count work.
4. AI missing: clear 503 configuration message, no false successful result.
5. With AI binding, transcript returns grounded output; missing consensus is labeled missing.
6. No transcript appears in Git commits, published assets, network query params, local/session storage, Worker logs or analytics.
7. Closing tab or Clear Session discards the transcript and report; TXT/JSON exports require explicit click.
8. Cloudflare WAF, logging and usage limits reviewed before production deployment.
