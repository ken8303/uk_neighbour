# UK power outage integration status

The Utilities category links to UK Power Networks, National Grid Electricity Distribution and the existing 105 network finder, Northern Ireland electricity and water providers. **No live outage API is connected.** A link or an empty list must never be presented as confirmation that an address has power.

## Sources proposed by the user

| Candidate | Intended role | Verification needed |
| --- | --- | --- |
| UK Power Networks Open Data Portal | First-party planned and unplanned power cuts in its licensed network areas | Current dataset ID, schema, authentication, licence, pagination, coordinates/areas, status semantics and publication timestamp |
| outages.uk Developers | Potential aggregator for additional UK network coverage | Current documentation, free-tier terms, authentication, actual network coverage, cursor pagination and ISO timestamps |
| National Grid Electricity Distribution data portal | First-party reports in its regional networks | Current dataset/API, licence, planned/unplanned and restored states, geography and update cadence |
| Gisual | Optional commercial multi-utility/telecoms intelligence | Contract, credentials, redistribution rights, UK coverage and costs; not enabled or purchased |

These are candidates supplied by the user, not claims of independently verified API availability. The reported UKPN 15-minute refresh, ENA NEO alignment and outages.uk free REST API require documentation verification. An ENA interface specification alone is not an accessible national data feed. UKPN and NGED are regional networks; neither alone covers the whole UK.

## Observed access blocker (5 November 2026)

The configured proxy returned HTTP 403 on CONNECT to the UKPN OpenDataSoft portal and outages.uk Developers. No provider payload or documentation was retrieved. No API endpoint/schema has been guessed or enabled. No key has been requested without checking the provider's actual requirements.

Proposed research domains, preserving existing allowlists:

- `ukpowernetworks.opendatasoft.com`
- `www.ukpowernetworks.co.uk`
- `outages.uk`
- `www.nationalgrid.co.uk`
- `connecteddata.nationalgrid.co.uk`
- `www.gisual.com`

Saving these additions was **not confirmed**: the environment draft service returned `draft_not_editable`. They are recorded here for a later editable environment draft; current network access is unchanged. No environment or website was published.

## Requirements for the connector after source verification

Use fixed provider URLs through the existing shared Node/Cloudflare handler; never send provider keys to the browser. Follow documented pagination with bounded pages and requests; disclose partial/truncated results. Honour Retry-After and documented polling limits (a claimed 15-minute publication cadence does not justify polling every minute).

Keep planned, ongoing, restored and cancelled events distinct. Keep source publication/verification times separate from incident start and estimated restoration times. Do not remove an ongoing incident merely because its start time is old, and do not mark it restored merely because its estimated restoration time has passed. Reject missing/invalid source freshness evidence instead of claiming current status.

Match explicit source geometry or valid reported coordinates to the selected radius. Mark point matches as approximate and disclose unlocated records. A nearby incident point is not confirmation that a particular home is affected. Preserve provider attribution, coverage limits and source links. Deduplicate provider/aggregator copies before counting events; retain conflicting or unknown status as uncertain.

Use stale-result retention and failure handling already in `src/LiveFeeds.jsx`. Zero matching reports, unsupported region, partial coverage and provider failure must be separate visible outcomes. Tests should exercise these outcomes, pagination failures, duplicates, restoration estimates, planned future events and source timestamps against real documented schemas before release.
