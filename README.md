# Neighbour

A responsive website for finding official Environment Agency flood warnings and alerts near a browser location or UK postcode, with a seven-day weather forecast and an interactive map. The Environment Agency feed covers **England only**. Links to the other UK nations’ official flood services are included.

## Develop

Use Node.js 24.5+ (verified with Node 24.22) and npm. Node’s proxy-aware fetch is enabled by the npm scripts.

```sh
npm ci
npm run dev
```

For **Cloudflare deployment**, use Cloudflare Workers with Static Assets. Run `npm run cf:check` for a deployment dry run and `npm run cf:deploy` after authenticating with Wrangler. See [CLOUDFLARE.md](CLOUDFLARE.md) for CLI, Git build, routing and verification instructions. The Worker runs the alert APIs without a separate Node production server.

Standalone Node hosting is still supported: `npm run build` then `npm start` serves `dist/` and the same APIs on port 3000 (`PORT` can override it). Browser geolocation requires HTTPS or localhost. No application API keys are configured. All alert, postcode, flood-area, forecast and air-quality data requests now use the same-origin backend. The backend requests the fixed official/public provider URLs; browser-side API CORS is no longer a dependency. Only map tiles and clicked external source links go directly from the browser to third parties. Locations are not persisted by this app.

## Validation

```sh
npm run build
npm test
```

Browser tests require a development server on port 5173 (or `TEST_BASE_URL` for the local Cloudflare runtime) and Chromium at `/usr/bin/chromium`. They use explicit API fixtures to cover successful postcode and geolocation search, validation, empty results, service failures, denied location permission, refresh, official links, forecast coordinates and seven-day output, map markers, zoom/reset, separate service failures, and a 390px mobile layout. They do not verify external service availability.

The published environment can reach the weather forecast, Met Office warning and TfL rail services; live checks returned successful responses. The newly added air-quality endpoint is still blocked by policy, and its domain addition is saved in the configuration draft. Air-quality values are verified with fixtures until access is applied. Test data is never shipped to the application. Provider egress and map-tile loading must be verified separately on the deployed origin.

## Behaviour and limitations

- Searches request `/flood-monitoring/id/floods?lat=…&long=…&dist=…` from the Environment Agency.
- Active severity levels 1–3 are shown, ordered by severity. No-longer-in-force warnings are excluded.
- The service matches a radius to flood areas; this is not a property-level flood-risk assessment. The Leaflet/OpenStreetMap map shows the selected location, a distance circle, and published flood-area reference points. These points are not flood boundaries. Alerts with unavailable coordinates remain in the list; a map count reports how many could be located.
- Open-Meteo supplies seven daily forecasts in Europe/London time, with WMO conditions, high/low temperatures in °C, and maximum daily precipitation probability. Weather is not a flood prediction. It loads independently of flood alerts and can be refreshed separately.
- OpenStreetMap supplies the basemap (Web Mercator); circle distances use Leaflet metres. Wheel zoom is disabled to preserve page scrolling. Use zoom buttons, drag, or touch gestures; Reset view restores the radius extent. Tile failures show a message while coordinate overlays remain available. There is no tile prefetch or offline cache.
- Visible, online pages refresh warnings/traffic/rail every 60 seconds, floods every 120 seconds, forecasts/air every 10 minutes and police directories every 30 minutes. A pause switch, per-source refresh and Refresh all are available. No background push notifications are provided.
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

Validated Met Office/TfL public feed payloads are cached in process memory for 60 seconds, with bounded and explicitly labelled previous-result fallback during short outages. Coordinate-dependent police lookups are not cached. Feeds refresh independently with 8-second per-attempt upstream timeouts, one bounded retry for eligible transient failures, and explicit unavailable/stale states. No sample alerts are shipped. Source links and coverage remain available during failures. The map remains a flood-area map; other categories are listed separately.

Additional server egress hosts: `www.metoffice.gov.uk`, `api.tfl.gov.uk`, and `data.police.uk`. These were added to the configuration draft while preserving earlier domains. Live provider schemas, permissions, and availability still require verification after network changes are applied; all three returned proxy policy denials in this instance. Provider and browser test fixtures demonstrate integration logic, not live service readiness. Review provider terms before production use.

Validation for this change: 9 existing/new tests passed, including feed parsing and geographic matching, expired/future traffic filtering, safe official URLs, API input/error handling, neighbourhood lookup, source independence, filtering, refresh, UK coverage, forecast/map regressions, and mobile overflow. Production startup is `npm start`; development is `npm run dev`, both proxy-aware.

## Expanded environment, travel, health and utility coverage

- **Air quality:** Open-Meteo air-quality API (`air-quality-api.open-meteo.com/v1/air-quality`), using CAMS model data. Displays current modelled European AQI, PM₂.₅/PM₁₀ in µg/m³, and the peak available index in the next 24 hours. Current timestamps more than three hours from now are rejected; missing/partial hourly coverage is disclosed. European AQI is explicitly distinct from UK DAQI: ≤20 Good, ≤40 Fair, ≤60 Moderate, ≤80 Poor, ≤100 Very poor, >100 Extremely poor. An app advisory is shown for an index >60. This is not a local sensor observation or medical advice. Source/official health links remain available on failure.
- **UV and weather advisories:** use the first two daily Open-Meteo forecast entries. Rules are UV ≥3; high temperature ≥30°C; low ≤0°C; maximum gust ≥60 km/h; daily precipitation ≥25 mm; or WMO codes for snow, thunderstorm or freezing rain. These are disclosed app thresholds, **not official Met Office/UKHSA warning criteria**. Only the first qualifying day per type is shown. Missing forecast fields are listed rather than treated as a safe outcome. Rain totals are daily, not hourly intensity or a flood prediction. The forecast request explicitly selects °C, km/h and mm.
- **Rail and public transport:** TfL mode-status endpoint for Tube, DLR, Overground, Elizabeth line and tram. Current disruption entries are shown network-wide with that scope clearly labelled; good service and future-only validity periods are excluded. This is not a nearby-station match. The integration is enabled for locations within 60 km of central London as a coarse coverage gate; this is not a TfL service boundary. Other locations get National Rail and TfL source links without a false empty-area assessment.
- **Health and food:** official UKHSA weather-health dashboard, Food Standards Agency recalls/allergy alerts, and NHS heat advice. **Directory links only**, not imported regional alerts or location-matched recalls.
- **Power and water:** RG1 postcode searches request SSEN electricity reports and Thames Water published incident titles independently. SSEN uses reported coordinates and the selected radius; water matches RG1 in incident titles, not radius or property. Unknown formats and provider failures show unavailable status. Live provider verification is pending network access. Other postcodes use official provider links.

The existing alert filter includes public transport, health/food and utilities. Directory-only categories never issue a fake live API request or show a live refresh control. Air-quality failures do not hide weather advisories or other source results. On mobile, official flood results appear immediately after the location form, before the map and forecast-derived advisories. No notifications, subscriptions, paid accounts, provider keys, or live utility/medical incident feeds were added.

New egress requirement: `air-quality-api.open-meteo.com` (saved to the current environment draft, not applied or published by this change). The added forecast fields and TfL mode-status endpoint returned valid live responses; the air endpoint remains policy-blocked. Met Office also returned a successful, parseable feed. Full browser tests use fixtures and are separate from those live service checks. Cloudflare Workers deployment remains supported.

Cloudflare local-runtime limitation observed during the expanded live checks: the same TfL request succeeds through proxy-aware Node, but a minimal diagnostic Worker making only that HTTPS fetch returns a runtime DNS lookup failure (temporary failure in name resolution). The application correctly reports JSON 502 for that case. This reproduces without our feed parser and is separate from successful fixture-based runtime tests and bundle validation. Actual outbound provider access must still be checked after Cloudflare deployment; no live Cloudflare success is claimed.

## Live-feed refresh and freshness

- One shared React resource hook coordinates independent feeds. Normal foreground intervals are 60 seconds for warnings/traffic/rail, 120 seconds for floods, 10 minutes for forecasts/air and 30 minutes for police directory lookups. Failed fast-moving feeds back off up to five minutes. Polling stops in hidden tabs and offline; visibility/reconnection resumes enabled feeds. Pausing automatic refresh keeps manual controls available. No background push notifications or streaming connection is implied.
- Refreshes retain visible results instead of resetting maps and unrelated feeds. Failed results are explicitly marked as previous/out-of-date. Alert/flood results expire five minutes after their last successful verification; forecast and air client retention limits are 30 and 20 minutes, and police-directory results one hour. An expiry timer removes expired data even when automatic polling is paused. Switching location aborts the old requests and immediately hides the previous location’s data.
- Server public-feed caching deduplicates simultaneous upstream requests, validates bodies before storing them, and uses ETag/Last-Modified conditional revalidation where supported. Cache hits keep the original verification time; HTTP 304 advances verification time without changing payload retrieval time. Public payload fallback is capped at five minutes from source verification, and expiry is not extended by repeated fallback delivery. Traffic/rail time filtering still runs on each response. Coordinate-dependent police lookups remain uncached.
- Network/eligible 5xx failures retry once with a short delay; 429 and Retry-After responses are not immediately retried. Their retry window is retained in the isolate to prevent repeated requests during cooldown. Each upstream attempt times out after eight seconds. Browser resource requests bypass their HTTP cache; server caching handles public feed reuse.
- API responses include `freshness.state`, `cache`, `retrievedAt`, `verifiedAt` and optional `sourceUpdatedAt`. The UI distinguishes source verification from provider updates and shows report-issued/updated dates when available. `checkedAt` is the source verification time, not the current request time. Previous empty results do not claim to be a current absence of alerts. Stale flood overlays and forecast-derived advisories carry corresponding notices.

Live Node-adapter checks succeeded for Met Office weather, TfL road disruptions and TfL rail status, including stable verification timestamps on cache hits. The local Cloudflare runtime’s previously diagnosed DNS restriction still prevents a live Worker egress readiness claim; fixture tests and deployment dry runs remain separate evidence. Air-quality host access still depends on the pending environment-domain change. Validation now includes 23 tests, automatic refresh/pause/resume, offline recovery, stale expiry, delayed old-location responses, conditional revalidation, deduplication, malformed payload fallback and rate-limit cooldown.

## Direct provider acquisition and expanded road coverage

All data requests are now same-origin `/api/alerts/*` calls. The server/Worker retrieves source data directly using fixed allowlisted URLs, validates provider responses, normalizes them, and returns source freshness. The client no longer calls the provider APIs directly. This addresses browser CORS/connection problems and provides one place for timeouts, validation and service errors. It does not create official incident data in areas where a provider does not publish it.

New routes: `postcode?postcode=…`, `floods?lat=…&lon=…&radius=…`, `forecast`, `air`, and `flood-area` (with a validated `code`). Location-dependent data is not held in the public-feed cache. Forecasts work for coordinates beyond London and throughout the UK model coverage. Browser data queries no longer depend on vendor CORS; only OSM tiles remain external browser requests. The same handler is used by Node, Vite and Cloudflare. No arbitrary upstream URL can be supplied.

A separate `highways` route and England-major-road category were added for National Highways’ public unplanned-event RSS at `https://m.highwaysengland.co.uk/feeds/rss/UnplannedEvents.xml`. It radius-filters GeoRSS points, counts unlocated reports, rejects missing/older-than-six-hour publication times and does not claim local-road coverage. This is an **unverified live connector**: parser/route logic is tested with fixtures, but live schema/availability still needs checking after outbound access is applied. The category states that status explicitly and shows an unavailable message when blocked. The Traffic filter includes both this strategic-road source and TfL London roads.

Direct Node-provider smoke checks succeeded for postcode lookup, England flood queries and a seven-day forecast in Edinburgh. All 28 tests pass, including direct adapter unit tests, nationwide forecast coordinates, safe fixed upstreams and browser tests asserting no vendor API requests. Source-specific provider failures remain distinct from no matching incidents. Cloudflare local-runtime tests and deployment dry run validate the bundle, not live egress.

The current draft includes access additions for NERV, National Highways, Traffic Scotland, Traffic Wales, SEPA, Natural Resources Wales and BGS for reference/source research. Those settings are not active in this running environment; only the National Highways connector has been implemented among these prospective new providers. No SEPA/NRW/BGS adapter is claimed ready. Those feeds require live documentation/schema checks (and any required provider credentials) before implementation.

## Review fixes

- GPS flood searches now resolve country coverage through the same-origin `location` route using Postcodes.io reverse lookup. A nearby postcode can identify England, Scotland, Wales or Northern Ireland. Missing/failed coverage lookup returns a clear request to enter a postcode, and a known country outside England gets the England-only message before any flood request. Other feeds remain usable. This lookup is approximate near borders; the privacy text recommends postcode confirmation there. The provider query is fixed, bounded to a 2 km radius and does not cache coordinates.
- The Node HTTP adapter catches malformed request URLs and unexpected asynchronous errors. Invalid targets return JSON 400 instead of an unhandled rejection; the same process continues serving subsequent requests. Unexpected handler failures return a generic 500 or close an already-started response.
- Forecast rows and derived advisories use Europe/London calendar dates. Yesterday is filtered out immediately at London midnight, including while automatic refresh is paused. The first displayed row is labelled Today only if its date matches today; missing current-day coverage is explicit. Advisories assess today and tomorrow rather than arbitrary past/future entries. The midnight clock handles UK daylight-saving changes and refreshes the forecast at the boundary when automatic refresh is enabled.

Validation: all 35 tests pass, including malformed real HTTP request/continued-server-health checks, country lookup and GPS browser cases, failed/unknown coverage, midnight rollover with an America/Los_Angeles browser timezone, automatic/paused refresh behaviour, and both UK daylight-saving transitions. Browser fixtures pin their calendar date so these regression tests remain deterministic after the sample dates pass.

Nearby fuel comparison supports E10, E5 and B7, update times, partial source coverage and directions. See [fuel prices](FUEL-PRICES.md) for the provisional retailer adapters and live-access limitations.

For RG1 postcode searches (including RG1 7PR), `/api/alerts/power` and `/api/alerts/water` accept coordinates, radius and `postcode`. They use fixed provider URLs and independent 60-second refreshes, conditional caching and up to five minutes of explicitly labelled stale fallback. SSEN response field mapping and Thames Water HTML extraction remain unverified against live responses in this environment. Network policy must allow `external.distribution.prd.ssen.co.uk` and `www.thameswater.co.uk`. No credentials are configured or required by the adapters. An empty result is not an all-clear; water incidents listed only inside report details may be missing. SSEN open data attribution: Scottish and Southern Electricity Networks, CC BY 4.0 (https://data.ssen.co.uk/@ssen-distribution/realtime_outage_dataset).
