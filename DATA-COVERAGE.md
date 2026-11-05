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
| Health, food | Official provider information | Clearly labelled links | No incident feed imported |
| Power (RG1 only) | SSEN Power Track API | Reported point within radius | Adapter implemented; live schema verification blocked by network policy; other providers excluded |
| Water (RG1 only) | Thames Water published incident page | RG1 in incident title | HTML adapter; live verification blocked; not radius matching or complete supply outage coverage |
| Scotland/Wales/BGS source research | Prospective regional feeds | Not implemented yet | Network access and provider documentation required |

“Direct” means the app's server requests the provider rather than relying on each browser to fetch third-party APIs. It cannot bypass provider authentication or supply incident reports that are not public. Cloudflare's deployed outbound access must be tested separately from this environment's Node adapter; local workerd currently has a DNS limitation.

The current environment-settings draft preserves the existing domains and adds `nerv.app`, `m.highwaysengland.co.uk`, `www.traffic.gov.scot`, `traffic.wales`, `floodline.sepa.org.uk`, `api.naturalresources.wales`, and `www.earthquakes.bgs.ac.uk` for design/source investigation. Review/save/apply the relevant settings before those sources can be verified. No environment publication has been performed by the agent.

Visual target: the user requested both a NERV-like experience and visual style. The named reference remains unreadable under current network policy. Screenshots or working reference access are needed before source-faithful visual concepts; an original map-first design is an alternative only if the user chooses that direction. Existing app functionality and prior live-feed improvements have been preserved.

## Fuel prices

E10, E5 and B7 comparisons use provisional public retailer JSON adapters for ASDA, Sainsbury’s, Morrisons and Tesco. Live access remains unverified because their hosts are blocked by this environment's active policy. Comparisons include only qualifying reports from connected sources; they do not cover every station. See [fuel source status and validation](FUEL-PRICES.md).
