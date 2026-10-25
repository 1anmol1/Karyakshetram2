# Platform feeds (industry platforms & brand locators)

One file per live category: `restaurant.json`, `qsr.csv`, `bakery.json`, `gym.csv` …
Or set `PLATFORM_FEED_URLS={"restaurant":"https://feed.example.com/pune-restaurants.json"}` (+ optional `PLATFORM_FEED_TOKEN`),
or POST `{ "rows": [...] }` to `/api/live/platform/:category`.

```json
[{ "name": "Cloud Kitchen X", "lat": 18.60, "lon": 73.76, "platform": "swiggy", "id": "sw-123", "status": "open" }]
```

`status` containing delisted / closed / unserviceable / inactive marks the outlet as no longer existing.

Typical feeds: Swiggy & Zomato (partner programme or a licensed dataset), Blinkit / Zepto / Instamart serviceability,
Practo / Healthians labs, Cult.fit & chain gym locators, OEM dealer locators, chain store locators (Croma, Bata, Tanishq …).
Swiggy, Zomato and similar platforms have no public API and their terms prohibit scraping, so the app takes these
as feeds rather than scraping them itself.
