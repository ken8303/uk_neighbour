# Nearby fuel comparison

The dashboard compares E10 petrol, E5 petrol and B7 diesel separately within the selected 10, 25 or 50 km radius. Prices are pence per litre; distance is straight-line distance. Directions open Google Maps.

The lowest price means **lowest reported by the connected feeds**, not every forecourt or a guaranteed pump price. Only reports less than 24 hours old qualify. Feed timestamps are labelled separately from station timestamps. Missing grades, implausible prices, invalid coordinates, old reports and conflicting duplicate prices are excluded. Partial source coverage and unavailable feeds are visible; unavailable data is never treated as a zero price.

## Source access status

Four public retailer JSON adapters are configured in `server/fuel.js`: ASDA, Sainsbury’s, Morrisons and Tesco. Their URLs and assumed schema (`last_updated`, `stations`, `location`, grade-keyed `prices` in pence per litre) have **not been verified live in this environment**: network policy blocked retailer hosts. These adapters are provisional. Verify current endpoints, schema, availability and permitted use against retailer documentation and current GOV.UK fuel-price guidance before relying on live coverage. This is not an authenticated integration with the government Fuel Finder service.

Additional network hosts have been saved in the environment configuration draft: `storelocator.asda.com`, `api.sainsburys.co.uk`, `www.morrisons.com`, `www.tesco.com`, and `www.gov.uk`. Saving that draft does not apply or publish it. Once access is available, verify each retailer against a real station and pump price; remove or update unsupported sources. There are no fabricated production station prices or API credentials.

## Runtime and privacy

`GET /api/alerts/fuel?lat=51.5&lon=-0.12&radius=25&fuel=E10` uses fixed upstream URLs. Public retailer documents are cached for five minutes in each server/Worker instance; the user's location is used only to filter those documents locally on the server. No location is added to retailer requests. The browser checks every five minutes while visible, online and automatic checks are enabled. A previous successful result may remain visibly marked after a failed refresh for up to ten minutes; it is not presented as a current lowest price.

The handler is shared by Vite, Node and the Cloudflare Worker. All-source failure returns HTTP 502 with an explicit unavailable result. Tests cover London timestamps, grade separation, radius and freshness filtering, duplicates, partial failure, caching, mobile layout and browser refresh failures using synthetic fixtures. Fixture results do not verify live retailer connectivity.
