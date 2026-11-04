# Neighbour

A responsive website for finding official Environment Agency flood warnings and alerts near a browser location or UK postcode, with a seven-day weather forecast and an interactive map. The Environment Agency feed covers **England only**. Links to the other UK nations’ official flood services are included.

## Develop

Use Node.js 24.5+ (verified with Node 24.22) and npm. Node’s proxy-aware fetch is enabled by the npm scripts.

```sh
npm ci
npm run dev
```

For **Cloudflare deployment**, use Cloudflare Workers with Static Assets. Run `npm run cf:check` for a deployment dry run and `npm run cf:deploy` after authenticating with Wrangler. See [CLOUDFLARE.md](CLOUDFLARE.md) for CLI, Git build, routing and verification instructions. The Worker runs the alert APIs without a separate Node production server.

Standalone Node hosting is still supported: `npm run build` then `npm start` serves `dist/` and the same APIs on port 3000 (`PORT` can override it). Browser geolocation requires HTTPS or localhost. No application API keys are configured. Met Office RSS, TfL traffic, and police neighbourhood lookups use the same-origin backend; flood, forecast, postcode and map requests remain browser-side. The browser needs HTTPS access to `environment.data.gov.uk`, `api.postcodes.io`, `api.open-meteo.com`, and `tile.openstreetmap.org`; API services must allow cross-origin requests. Locations are not persisted by this app.

## Validation

```sh
npm run build
npm test
```

Browser tests require a development server on port 5173 (or `TEST_BASE_URL` for the local Cloudflare runtime) and Chromium at `/usr/bin/chromium`. They use explicit API fixtures to cover successful postcode and geolocation search, validation, empty results, service failures, denied location permission, refresh, official links, forecast coordinates and seven-day output, map markers, zoom/reset, separate service failures, and a 390px mobile layout. They do not verify external service availability.

Live API access was blocked by the onboarding environment’s domain policy. Required domain additions have been saved to the environment configuration draft but are not yet active. Live feed responses and CORS must be verified after those changes are applied. Test data is never shipped to the application.

## Behaviour and limitations

- Searches request `/flood-monitoring/id/floods?lat=…&long=…&dist=…` from the Environment Agency.
- Active severity levels 1–3 are shown, ordered by severity. No-longer-in-force warnings are excluded.
- The service matches a radius to flood areas; this is not a property-level flood-risk assessment. The Leaflet/OpenStreetMap map shows the selected location, a distance circle, and published flood-area reference points. These points are not flood boundaries. Alerts with unavailable coordinates remain in the list; a map count reports how many could be located.
- Open-Meteo supplies seven daily forecasts in Europe/London time, with WMO conditions, high/low temperatures in °C, and maximum daily precipitation probability. Weather is not a flood prediction. It loads independently of flood alerts and can be refreshed separately.
- OpenStreetMap supplies the basemap (Web Mercator); circle distances use Leaflet metres. Wheel zoom is disabled to preserve page scrolling. Use zoom buttons, drag, or touch gestures; Reset view restores the radius extent. Tile failures show a message while coordinate overlays remain available. There is no tile prefetch or offline cache.
- Search or refresh fetches current results. No background push notifications or automatic monitoring are provided.
- A postcode outside England produces a coverage message for the flood service while other services continue. Device-location flood searches use the England-only feed; they cannot assess flooding elsewhere.
- No results does not imply safety. Follow official advice and call 999 in immediate danger.
- Data attribution: Environment Agency flood and river level data under the Open Government Licence v3.0. Postcode geocoding: Postcodes.io. Weather: Open-Meteo (CC BY 4.0 attribution). Map data: OpenStreetMap contributors (ODbL attribution).

## Data and map source ledger

| Layer | Source | Coverage / units | Refresh and fallback |
| --- | --- | --- | --- |
| Flood alerts | Environment Agency flood-monitoring API | England; active severities 1–3 | On search/refresh; failure shown separately |
| Flood reference points | EA `/id/floodAreas/{code}` | Published WGS84 lat/long, not polygons | Up to four simultaneous lookups; missing points counted and alerts retained in list |
| Search area | Leaflet geodesic circle | User-selected radius, km converted to metres | Recomputed per search; not a flood-risk boundary |
| Weather | Open-Meteo `/v1/forecast` | Selected coordinate, 7 days, °C and rain probability % | On search/forecast refresh; model update timing varies, no offline values substituted |
| Basemap | Standard OpenStreetMap raster tiles | Web Mercator street map | Only visible tiles at current zoom; no bulk downloads; failures explicitly reported |

Provider availability, CORS, and applicable usage limits must be checked before production deployment. Open-Meteo's free endpoint is intended for non-commercial use; commercial deployment requires the provider's appropriate plan. Provider requests are bounded to 20 seconds and previous searches cannot overwrite newer forecast results. No source is treated as proof of property-level safety.

## Visual verification

Concept: `/workspace/generated_images/exec-9882607d-d244-43e1-b0de-fa486eb1a0a0.png`. Playwright with system Chromium was used because no Browser plugin was available. The concept and final screenshots were inspected with `view_image` at desktop 1440×1000 and mobile 390×844 (full-page captures); the concept is a combined desktop/mobile board, so there is no single matching native browser viewport.

Comparison ledger: white/navy/teal palette retained; existing header and location-form typography retained; map and forecast aligned in the right desktop column; mobile stacks form, map, forecast and alerts; forecast columns keep legible high/low temperatures and weather icons with horizontal keyboard scrolling; radius and flood points are separate map layers. The visible headline and controls retain their original copy; the introduction intentionally adds weather forecasts. Intentional differences from generated concept: preserve the existing form and 10/25/50 km options, include provider/privacy details, and show an explicit tile-failure notice. Full map visual fidelity cannot be verified until live street tiles are accessible. Fixed during verification: missing component imports, Leaflet bounds calculation, reset animations, and forecast readability. Two browser tests pass using explicit fixtures; no live-data success is claimed.

## Other alert categories

- **Severe weather:** Met Office UK warning RSS (`https://www.metoffice.gov.uk/public/data/PWSCache/WarningsRSS/Region/UK`). Published GeoRSS polygons are matched against the search radius (point-in-polygon or approximate local segment distance). Entries without usable geometry remain explicitly labelled “UK feed · location not supplied”; they are not asserted to affect the selected location. The current feed may include future warnings; users must open the source for exact areas and validity times. Warnings are not inferred from the Open-Meteo forecast.
- **Traffic and road closures:** TfL `/Road/All/Disruption`. Includes current disruptions with a reported point within the radius; expired/future and explicitly resolved reports are excluded. Coordinates are longitude-first WGS84. This covers TfL roads in London, not all UK roads, all London roads, or complete disruption shapes. Official links for England, Scotland, Wales and Northern Ireland cover locations outside this integration.
- **Local safety and emergencies:** data.police.uk `/api/locate-neighbourhood` followed by the official neighbourhood detail endpoint resolves a local police page when available. This is a directory lookup, **not a real-time incident feed**. The UI also links to GOV.UK emergency alerts and council updates. No monthly crime data or historical incidents are presented as live alerts.

Met Office/TfL public feed payloads are cached in process memory for up to 60 seconds. Coordinate-dependent police lookups are not cached. Feeds refresh independently, with 15-second upstream timeouts and explicit unavailable states. No sample alerts are shipped. Source links and coverage remain available during failures. The map remains a flood-area map; other categories are listed separately.

Additional server egress hosts: `www.metoffice.gov.uk`, `api.tfl.gov.uk`, and `data.police.uk`. These were added to the configuration draft while preserving earlier domains. Live provider schemas, permissions, and availability still require verification after network changes are applied; all three returned proxy policy denials in this instance. Provider and browser test fixtures demonstrate integration logic, not live service readiness. Review provider terms before production use.

Validation for this change: 9 existing/new tests passed, including feed parsing and geographic matching, expired/future traffic filtering, safe official URLs, API input/error handling, neighbourhood lookup, source independence, filtering, refresh, UK coverage, forecast/map regressions, and mobile overflow. Production startup is `npm start`; development is `npm run dev`, both proxy-aware.
