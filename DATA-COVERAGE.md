# Direct-data status and remaining work

| Source | Coverage / type | Acquisition | Evidence |
| --- | --- | --- | --- |
| Postcodes.io | UK postcode lookup | Same-origin backend, fixed provider API | Live Node check passed |
| Open-Meteo weather | Coordinate-based model forecasts, including outside London | Same-origin backend | Live Edinburgh seven-day forecast passed |
| Environment Agency | England flood warnings and flood-area reference points | Same-origin backend | Live England query passed; no claim of other-nation coverage |
| Open-Meteo/CAMS air quality | Modelled European AQI | Same-origin backend | Fixture tested; new host still blocked here |
| Met Office | UK warning RSS; some entries lack local geometry | Same-origin backend | Live Node feed checks passed |
| TfL | London roads and selected rail modes | Same-origin backend | Live Node checks passed; not nationwide |
| National Highways | England strategic-road incidents | Same-origin RSS adapter | Fixture tested; live endpoint/schema verification pending access |
| Police | Neighbourhood directory | Same-origin backend | Not a live incident feed |
| Health, food, power, water | Official provider information | Clearly labelled links | No incident feed or automated scraping claimed |
| Scotland/Wales/BGS source research | Prospective regional feeds | Not implemented yet | Network access and provider documentation required |

“Direct” means the app's server requests the provider rather than relying on each browser to fetch third-party APIs. It cannot bypass provider authentication or supply incident reports that are not public. Cloudflare's deployed outbound access must be tested separately from this environment's Node adapter; local workerd currently has a DNS limitation.

The current environment-settings draft preserves the existing domains and adds `nerv.app`, `m.highwaysengland.co.uk`, `www.traffic.gov.scot`, `traffic.wales`, `floodline.sepa.org.uk`, `api.naturalresources.wales`, and `www.earthquakes.bgs.ac.uk` for design/source investigation. Review/save/apply the relevant settings before those sources can be verified. No environment publication has been performed by the agent.

Visual target: the user requested both a NERV-like experience and visual style. The named reference remains unreadable under current network policy. Screenshots or working reference access are needed before source-faithful visual concepts; an original map-first design is an alternative only if the user chooses that direction. Existing app functionality and prior live-feed improvements have been preserved.

## Fuel prices

E10, E5 and B7 comparisons use provisional public retailer JSON adapters for ASDA, Sainsbury’s, Morrisons and Tesco. Live access remains unverified because their hosts are blocked by this environment's active policy. Comparisons include only qualifying reports from connected sources; they do not cover every station. See [fuel source status and validation](FUEL-PRICES.md).

## Power outage sources

UKPN and NGED power-cut links are available under Utilities. Their live feeds, outages.uk and Gisual remain unconnected pending documentation/access verification. The attempted research-domain draft update could not be saved (`draft_not_editable`). See [power outage status and proposed domains](POWER-OUTAGES.md).

## Transport expansion

TfL bus route status is connected alongside the existing TfL rail modes. An anonymous live endpoint check returned 200 on 5 November 2026; deployed Worker access remains to be checked. All seven requested transport source families appear in the transport source catalog, but only TfL status data is connected. See [transport access status and remaining blockers](TRANSPORT-SOURCES.md).

Nearby TfL stop searches and arrival predictions are also connected, with real bus and Westminster station JSON verified on 5 November 2026. The board is opt-in, searches within 1 km, polls only the selected stop and expires stale predictions. It is not a national departure service. The research-domain draft still cannot be saved; proposed settings are preserved in `provider-network-proposal.json` without activation.

TfL cycle-hire availability and London-area public transport journey planning are now connected. Both raw endpoints and completed adapters were checked against live JSON on 5 November 2026. Tools load only when opened (journeys also require submission); inventory freshness, route completeness and provider coverage remain explicit. National/commercial source blockers are unchanged.

The GB rail station finder uses a pinned, licensed public reference dataset (2,609 records; source commit dated 7 October 2026). It supports England, Wales and Scotland, including nearby Scottish/Welsh matches outside TfL coverage. It is not live departures or a station-opening/accessibility check. National Rail provider access is still blocked. The raw dataset, ODbL licence and source attribution are distributed with the site.
