# CANCÚNIO

Private two-person travel decision guide for Emrys + Hannah: Cancún/Yucatán → Rio/Beyond.

## Architecture

- `index.html` — static page structure only.
- `styles.css` — presentation and responsive layout.
- `app.js` — browser state, filters, cards, detail sheet and preference UI.
- `*.seed.json` — travel content. Content is read-only at runtime.
- `src/worker.js` — authenticated API boundary and D1 preference persistence.
- `migrations/` — explicit D1 schema.
- `scripts/validate-data.mjs` — lightweight content integrity checks.

## Identity and preferences

Cloudflare Access authenticates the email. D1 maps that email to exactly one profile: `emrys` or `hannah`.

D1 is the source of truth for preferences. `want`, `maybe` and `skip` are stored per authenticated user and item key. Picks means `want` + `maybe`; `skip` is deliberately excluded. When both profiles choose `want`, the UI can show the shared 💥 state.

Legacy `preference` objects still present in seed JSON are ignored by the runtime and reported by the validator as cleanup warnings.

## Development checks

```bash
npm run validate
```

Run the migration before using a fresh D1 database, then deploy through Wrangler/Cloudflare as normal.

## Guardrails

Keep this small. It is a private travel side project, not a SaaS product. Prefer plain HTML/CSS/JS and explicit Worker APIs over frameworks or hidden synchronization tricks.
