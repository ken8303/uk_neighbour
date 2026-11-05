# Transport sources

All seven requested source families are listed in **Public transport → Transport data sources & access** with individual access status. Listing a provider does not connect its data. Unknown prices and plan limits are not advertised as verified offers.

## Connected

- Existing TfL Tube, DLR, Overground, Elizabeth line and tram statuses remain available.
- TfL bus route statuses now use fixed `https://api.tfl.gov.uk/Line/Mode/bus/Status` through `/api/alerts/buses`. An anonymous live check returned HTTP 200 and 675 route records on 5 November 2026. This verifies that endpoint's accessibility from this environment, not deployed Cloudflare egress or exhaustive data completeness.

Bus and rail requests fail independently. Requests share the validated public-feed cache, bounded retries, rate-limit handling, foreground polling, manual/global refresh and stale-result expiry already used by other alerts. No new key or binding is required for anonymous TfL access. Bus requests outside 60 km of central London return unsupported coverage without fetching TfL. This radius is an app eligibility heuristic, not a precise network boundary.

Current planned works are labelled; future-only validity periods and Good Service entries are excluded. Bus route reports are explicitly network/route-level, not nearest-stop matches. Route filtering is exact and case-insensitive (e.g. `25`, `N15`). At most 20 reports are displayed without a route filter, with a visible count and narrowing instruction. Vehicle positions and a separate future-planned-works feed are not implemented. Cycle-hire availability and in-app journey planning are now connected as described below. Nearby-stop arrival predictions are now available as described below.

## Awaiting access or clarification

| Source | Current implementation | Needed for live integration |
| --- | --- | --- |
| National Rail Data Marketplace / Disruptions | Provider link and not-connected status | Accessible product documentation, licence/registration, actual endpoint/schema and authentication |
| National Rail Darwin / LDBWS | Developer link and not-connected status | Product-specific account/access, schema and station identifiers; do not conflate train-running and engineering-information feeds |
| TransportAPI | Provider link and commercial-account status | Chosen plan, credentials and permitted redistribution; pricing and coverage unverified |
| NextBuses / SIRI | Traveline data link and not-connected status | Exact current service, SIRI profile, credentials and stop coverage; “National Data Library” association not verified |
| DfT Create Transport Disruption Data | DfT organisation link and not-connected status | Current platform/product documentation, feed discovery and operator coverage; a publishing tool is not necessarily a nationwide aggregation API |
| Buses & Trains API | Named entry with no fabricated link | Exact provider URL from the user; quoted free-tier limits and pricing remain unverified |

Rail Data Marketplace and TransportAPI documentation returned HTTP 403 at the configured proxy CONNECT step. No payload schema, commercial subscription or provider credentials have been invented. These are concrete blockers to completing all live integrations.

Potential additional research hosts: `raildata.org.uk`, `www.nationalrail.co.uk`, `www.transportapi.com`, `www.travelinedata.org.uk`. Do not replace existing network settings. The environment draft service was uneditable during the preceding outage-source task; no new transport-domain settings were saved or published here.

Future authenticated services must keep credentials server-side, use fixed upstream endpoints, obey licence/rate limits and documented pagination, separate planned/current disruptions, and identify source coverage and missing/stale data. The shared Cloudflare handler currently uses anonymous public APIs; authenticated services need explicitly designed runtime bindings before they can be claimed as connected.

## Nearby stops and departure predictions

Open **Public transport → Nearby stops & live departures · London** after choosing a location. The board makes no stop or prediction requests until opened; closing it stops its polling and switching location/stop rejects previous responses. Bus stops and rail stations are searched separately within 1 km. The ten nearest valid returned stops are offered; distances are straight-line, not walking directions. The stop ID is shown to distinguish same-name platforms or road directions. Partial provider stop lists are disclosed. The search is limited to the same approximate 60 km London eligibility check; it is not a nationwide stop database.

The public `GET /StopPoint` search and `/StopPoint/{id}/Arrivals` endpoints both returned HTTP 200 on 5 November 2026. Real JSON responses were inspected for nearby bus stops, Westminster station and their predictions. No provider credentials are needed for these anonymous endpoints. This does not verify deployed Cloudflare access or every station: National Rail departures are not supplied by this board merely because a rail station appears in a TfL stop search.

Same-origin `/api/alerts/stops?lat=51.5&lon=-0.12&radius=25&kind=bus` and `/api/alerts/departures?stop=490005646D` use fixed TfL hosts. Coordinates go to TfL only when the board is open. These requests are not retained in a server cache. Stop lookup refreshes every ten minutes and the selected prediction board every 30 seconds while visible, online and enabled. Manual/global refresh and pause use the existing feed controls. Other stop boards are not prefetched.

Predictions use absolute `expectedArrival` times and TfL report timestamps, not a frozen time-to-station countdown. Reports older than two minutes, implausibly future reports, elapsed time-to-live and past arrivals are excluded. Predictions are limited to the next two hours and sorted by arrival time, with at most ten shown. Arrival estimates are not guarantees. The UI updates elapsed times every 15 seconds and removes elapsed predictions. After a failed refresh, retained predictions are explicitly marked and show absolute times; retained results expire after one minute from source verification. Empty predictions never claim that services are suspended.

Source access is still blocked for the remaining national and commercial services. Retrying the environment settings save again returned `draft_not_editable`; no new domains have been activated. [provider-network-proposal.json](provider-network-proposal.json) preserves a proposed additive allowlist (including the existing domains) for a later editable environment draft. It contains no credentials and is not loaded by the app. Review current settings before applying it, since an allowlist replacement could otherwise overwrite newer domain changes.

## Cycle hire and journey planning

Both are opt-in tools under Public transport. No additional provider account or secret is required. Endpoints returned HTTP 200 on 5 November 2026 and their real JSON fields were inspected. Completed adapter checks returned eight eligible nearby cycle stations and three current journey options for the test coordinates; these are observations from that check, not promised availability or coverage.

**Cycle hire:** `/api/alerts/cycle-hire` retrieves the fixed public TfL `/BikePoint` list and filters locally to 1 km. The shared public-source cache is reused without sending the user's coordinates upstream. Up to ten stations are sorted by distance. Installed/unlocked status, numeric bike/dock counts, consistent totals and property report times within five minutes are required. Real zero counts remain zero. Missing values are not converted to zero. Closed, malformed and old nearby reports are counted as excluded. Older unchanged inventories may be excluded conservatively: an HTTP response alone is not proof of a new station report. The open board refreshes every minute; previous successful data is visibly marked after failure and expires after two minutes from source verification. Bikes and docking spaces are not reserved. Directions leave the site for Google Maps.

**Journey planner:** enter a destination postcode and submit to plan from the selected origin. The postcode is resolved through the existing fixed Postcodes.io adapter; the server sends origin and destination coordinates to TfL's fixed `/Journey/JourneyResults/{from}/to/{to}` endpoint. Neither the coordinates nor returned itineraries are cached by this connector. Both endpoints of the route must lie within the app's approximate 60 km London eligibility area. This is a deliberate coverage restriction, not a claim that TfL supports no other journeys.

At most three complete route options are shown with durations, London start/arrival times, leg summaries and reported disruption/planned-work notices. Malformed legs invalidate their whole itinerary; they are never silently removed. No fares, access guarantee, booking or turn-by-turn map is provided. Source times without an offset are parsed in Europe/London, including BST; the same strict parser is now shared with fuel timestamps. While the submitted planner remains open, valid routes refresh every two minutes when automatic refresh is enabled. Results expire after two minutes; changing the starting location or closing the planner aborts pending work and clears its request. A destination is not sent to TfL until the user submits it.

Tests cover fixed hosts, input validation, unsupported regions, private journey queries not being cached, inventory freshness/zero counts, complete-route validation, London summer time, opt-in fetches, postcode errors, route notices, independent failures and mobile overflow. These do not verify access to the still-unconnected national/commercial providers.

## Great Britain rail station finder

A new opt-in station finder works beyond London, using 2,609 reference records for England, Scotland and Wales. Search by station name or CRS code without a postcode, or use the existing selected-location radius (10, 25 or 50 km) to find nearby stations. The first 20 reference matches are shown; nearby matches are sorted by straight-line distance, while exact CRS/name matches are ranked ahead of name fragments. The dataset does not cover Northern Ireland or all local light-rail systems. It does not verify current station opening, facilities, accessibility or service availability.

Data is the **unmodified** `stations.json` from David Wheatley's `uk-railway-stations`, pinned to commit `67dff87f51bdb782ddfcce1d8b10a88f059bf380` dated **7 October 2026**, retrieved 5 November 2026. David Wheatley, Trainline EU and upstream source contributors are attributed in the UI and downloadable provenance. The raw JSON, full ODbL licence and attribution are served under `/data/`; the app source does not silently turn this snapshot into live departure data. Station searches are performed locally in the shared Node/Worker handler and send no coordinates to a new external provider.

`/api/alerts/rail-stations?search=EDB` supports nationwide reference search without coordinates. `/api/alerts/rail-stations?lat=55.95&lon=-3.19&radius=10` finds nearby Scottish reference stations. Responses explicitly include `liveDeparturesConnected: false` and pinned dataset metadata. This endpoint is independent of TfL's London eligibility check and needs no token.

Further source research reached the public OpenRailData OpenLDBWS Python example at `https://github.com/openraildata/openldbws-example-python`. Its README and example describe a registered token, a 2021-11-01 WSDL and the GetDepartureBoard operation. This establishes a documented integration path, not current provider availability or permission. Direct access to `https://lite.realtime.nationalrail.co.uk/OpenLDBWS/` was again blocked at proxy CONNECT with 403. No authenticated SOAP endpoint, unverified schema parser or token binding has been added merely from that example. The current provider terms, WSDL and usable credential still need verification. Proposed research access for `lite.realtime.nationalrail.co.uk` and `realtime.nationalrail.co.uk` is preserved in the local network proposal; it has not been saved to the uneditable environment draft or activated.
