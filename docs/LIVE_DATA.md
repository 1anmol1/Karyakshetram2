# Live competitor data

**10 live categories** (fetched automatically): grocery, pharmacy, qsr, cafe, fuel, bank, ev, restaurant, bakery, gym.
**All 30 categories** have a source catalogue and a real-time feasibility score in the Trust Center
(`server/src/data/liveSources.js`). The other 20 still score on the simulated layer, and the UI labels them that way.

## Keys
| Variable | Where | Purpose |
|---|---|---|
| `GOOGLE_PLACES_KEY` | server only (Render env, `server/.env`) | Google Places API (New): competitors + businessStatus closures. **Never commit it.** |
| `VITE_GOOGLE_MAPS_KEY` | client build | Google Maps JavaScript API basemap under the hex layer. Restrict it to your site's HTTP referrers in Google Cloud. |
| `OCM_API_KEY` | server | Open Charge Map (EV) |
| `PLATFORM_FEED_URLS` / `PLATFORM_FEED_TOKEN` | server | Swiggy/Zomato partner exports, brand locator feeds |

## Connectors
| Connector | Type | How | Real-time | Closure signal |
|---|---|---|---|---|
| OpenStreetMap Overpass | Map | Always on, free | 70% | missing from latest pull (map-only records) |
| Google Places API (New) | Public API | `GOOGLE_PLACES_KEY` (paid) | 92% | `businessStatus` CLOSED_* |
| Open Charge Map | Public API | EV, `OCM_API_KEY` | 75% | `IsOperational=false` |
| Government registrations | Govt | `data/registry/<key>.csv/json` or `POST /api/live/registry/:cat` | 35–80% | cancelled/suspended licence |
| Industry platforms & brand locators | Platform | `data/platform/<key>.json/csv`, `PLATFORM_FEED_URLS`, or `POST /api/live/platform/:cat` | 45–90% | delisted / unserviceable |

Registers mapped: FSSAI, FDA Maharashtra, RBI branch master/IFSC, PESO + OMC locators, BEE, NABL, BIS hallmark, GST,
Udyam, MCA, Shop & Establishment (Gumasta), VAHAN, MahaRERA, WDRA/MIDC, India Post, UDISE+/AISHE, Vet Council.
Platforms mapped: Swiggy, Zomato, Blinkit/Zepto/Instamart, Justdial, Practo/Healthians, IndiaMART, Cult.fit,
Tata Power EZ/Statiq/ChargeZone, NoBroker/99acres/MagicBricks, myHQ/Awfis/WeWork, plus OEM and chain store locators.
Swiggy, Zomato, Blinkit and Justdial have no public API and their terms prohibit scraping. They come in as partner or
licensed feeds; the app never scrapes them itself.

Google Places cost: each live category makes up to `GOOGLE_PLACES_TILES² × 3` Text Search calls per sync
(3 → max 27 calls per category, 270 per full sync). At 12-hourly syncs that is about 16k calls a month, so watch billing
or raise `LIVE_REFRESH_HOURS`.

## Feasibility
`feasibility = 0.4·map coverage + 0.25·govt registration + 0.2·freshness + 0.15·platform & brand signal` (assessed estimates for Pune).

Live: fuel 88 · bank 86 · restaurant 78 · qsr 78 · pharmacy 75 · cafe 73 · bakery 69 · grocery 68 · ev 63 · gym 58.
Mapped only: mall 73 · auto 72 · jewellery 66 · diagnostics 63 · electronics 62 · coworking 61 · courier 60 · fashion 58 ·
mobile 57 · footwear 56 · convenience 55 · warehouse 55 · salon 54 · dairy 54 · qcommerce 53 · furniture 53 · hardware 50 ·
pet 49 · carwash 49 · coaching 46.

## Merge & lifecycle
* Records within 60 m with matching names are treated as one business; each keeps every source that confirmed it.
* A closed signal from any source → closed with a reason. Seen again after an automatic closure → reopened. What-if closures stick until restored.
* Simulated POIs are deleted only after a successful live pull. A failure keeps the previous data and logs warnings.
* After every sync: Node state reloads, caches clear, and `POST /ml/reload` goes to the Python service.

## API
`GET /api/live/status[?category=]` · `POST /api/live/refresh[?category=]` · `POST /api/live/registry/:category` ·
`POST /api/live/platform/:category` · `POST /api/live/competitors/:id/status` · `GET /api/live/competitors/closed`

## Model retraining
* Placeholder engine (what runs on Render): no retraining needed. Competition is scored relative to the city median.
* Python RandomForest: trained on simulated counts and revenue. The `competitor_scale` drift guard rescales live counts
  into the training range. Retrain once real revenue/outcome labels exist.
