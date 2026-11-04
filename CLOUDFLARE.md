# Deploy Neighbour to Cloudflare

This repository targets **Cloudflare Workers with Static Assets**. The Worker serves the alert APIs and the built React app on the same HTTPS origin. It does not run `server/start.js` or need a separate Node server in production. A static-only Pages upload would omit the alert APIs; choose a Worker project for this configuration.

## Deploy from your computer

Install Node.js 24.22.1 (pinned in `.node-version`) and run these commands from the repository root:

```sh
npm ci
npm run cf:check
npx wrangler login
npm run cf:deploy
```

`cf:check` builds the frontend and bundles the Worker without publishing or requiring a Cloudflare login. `wrangler login` authenticates your Cloudflare account through the browser. Choose the intended account if prompted. `cf:deploy` builds and deploys; Wrangler prints the resulting workers.dev URL. If `uk-neighbour` is already used in your account, change `name` in `wrangler.jsonc` before deployment. No domain, account ID, or credential values are committed.

No database, KV, R2, or application secret bindings are required by the current integrations. Do not copy the onboarding machine’s proxy settings to Cloudflare. Workers make ordinary HTTPS subrequests to the fixed provider URLs.

## Deploy from Git using Cloudflare Workers Builds

Commit and push the repository, including the lockfile, `cloudflare/`, `server/`, and `wrangler.jsonc`. In Cloudflare’s Workers & Pages area, create/import a **Worker** connected to that repository and branch.

Use:

| Setting | Value |
| --- | --- |
| Root directory | Repository root |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Node version | `24.22.1` (`.node-version`, or `NODE_VERSION` in build settings) |

The build environment must install the lockfile dependencies, including development dependencies (Wrangler and Vite). Do not set `NODE_ENV=production` for the dependency-install step. Cloudflare’s integration handles deployment authentication. Do not use `npm start` as a Cloudflare build or deploy command.

## Local Cloudflare runtime

```sh
npm run cf:dev
```

This builds the site and starts Wrangler’s local Workers runtime on port 8787. For tests on a Linux machine with Chromium at `/usr/bin/chromium`, keep that server running and run:

```sh
TEST_BASE_URL=http://127.0.0.1:8787 npm test
```

The default `npm run dev` and `npm start` remain available for Vite development and standalone Node hosting. Both use the same alert request handler as Cloudflare.

## Routing and runtime

- `wrangler.jsonc` bundles `cloudflare/worker.js` and uploads `dist/` through the `ASSETS` binding.
- `/api` and `/api/*` always run the Worker before static assets. Unknown APIs return JSON 404s; invalid queries return JSON 400s, unsupported methods return 405s, and provider failures return 502s. They never fall back to HTML.
- The Worker API uses web-standard Request/Response APIs. The Node HTTP adapter is not included in its entry point.
- `nodejs_compat` is enabled for bundled library compatibility. The compatibility date is pinned in configuration.
- Browser location permission works on the deployed HTTPS domain. Users can enter a postcode instead.
- Responses containing location-dependent API results have `Cache-Control: no-store`. Public weather/traffic payloads may be held in an individual Worker isolate for up to 60 seconds; this is an optional in-memory cache, not durable storage or a cross-isolate guarantee.

## Verify after deployment

1. Open the workers.dev URL and confirm the form, forecast and map render.
2. Search a valid postcode, then check each alert category separately. Verify live provider responses and source coverage; empty results are not an all-clear.
3. Check location permission, denied permission, radius selection, map zoom/reset, forecast refresh and narrow mobile layouts.
4. Confirm `/api/alerts/weather` without parameters returns JSON 400 and `/api/unknown` returns JSON 404.
5. If a provider blocks Cloudflare egress, inspect Worker logs and retain the unavailable state. Do not replace it with fake alerts. Browser-side flood/forecast/postcode APIs also need working CORS; map tiles need to load from OpenStreetMap.
6. A custom domain can be added in the deployed Worker’s domain settings. Retest geolocation permission on the new origin.

## Verification completed in this workspace

- Production Vite build and Wrangler deployment dry run passed.
- Wrangler’s actual local Workers runtime served HTML and the built JavaScript successfully.
- Runtime API checks returned the expected JSON 400, 404 and 405 responses, including empty-coordinate validation. A blocked provider returned JSON 502.
- All 12 tests passed with the three browser flows targeting the local Workers runtime, including desktop/mobile interaction coverage. The tests use provider fixtures; they do not prove live upstream availability.

No Cloudflare deployment or account authentication was performed. Live provider requests are still blocked by this workspace’s outbound policy. Cloudflare-side upstream access, provider schema/permission changes, and browser CORS must be checked on the deployed origin. Existing coverage limitations remain: flood data is England-only, live traffic covers TfL roads in London, weather entries without polygons are not confirmed local, and safety is official links plus police-neighbourhood lookup rather than live incidents.

Reference: https://developers.cloudflare.com/workers/static-assets/
