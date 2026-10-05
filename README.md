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

## Visual overhaul review

The overhaul is developed on `astra-visual-overhaul`; do not merge into `main` until reviewed and approved. The production Worker, Access identity boundary, D1 schema, seed records, preference keys and matching rules are unchanged.

The interface uses a cream/forest-green travel journal system, responsive editorial typography, local destination photography, explicit Want/Maybe/Skip controls and one filtered list shared with the map. `styles.css` owns component tokens and responsive layouts; `spatial.css` owns Leaflet presentation. The previous unused Standouts DOM has been removed; its existing priority ordering remains in the main list.

### Local preview and regression checks

```bash
npm ci
npm run preview
```

Open `http://127.0.0.1:4173`. This **fixture-only** server uses an Emrys test profile and in-memory preferences, including one Hannah Want to exercise matching. Restarting it resets decisions. It does not connect to Access, D1 or production. It binds only to loopback and is excluded from deployed assets.

```bash
npx playwright install chromium
npm test
npm run validate
```

`npm test` starts its own fixture server on port 4174. It tests both profiles at desktop and mobile sizes, destination/content switching, Want/Maybe/Skip semantics, Matches, filters/search, save rollback, persistence after reload, keyboard dialogs, map pins, fallback states and narrow layouts. Screenshots are written to ignored `qa/`. Set `BROWSER_CHANNEL=msedge` to use installed Microsoft Edge instead of bundled Chromium. Production credentials are never used.

### Deployment

There is no frontend compilation step. Wrangler serves the static files and `src/worker.js` using the existing `wrangler.jsonc` and D1 binding. Development dependencies, fixture scripts and QA images are excluded in `.assetsignore`. This overhaul does not deploy or migrate the database. A production Access/D1 smoke check remains part of the approved deployment review.

### Destination photography

The local JPGs replace reliance on broken bundled WebPs and remote hero loading. Cancún: [ProtoplasmaKid / Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Canc%C3%BAn_-_Playa_Gaviota_Azul_-_09.jpg), [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Rio: [Acediscovery / Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Rio-panorama-Botafogo-Sugarloaf.jpg), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Resized source photographs are cropped to fit by CSS; credits are also visible in the footer. Existing card photographs and data attribution remain intact.
