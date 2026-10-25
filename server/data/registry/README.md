# Registry files (businesses that are not on the map)

One CSV per live category: `grocery.csv`, `pharmacy.csv`, `qsr.csv`, `cafe.csv`, `fuel.csv`, `bank.csv`, `ev.csv`.

```
name,lat,lon,regNo,status
Ganesh Medicals,18.6012,73.7811,MH-PZ1-20-12345,active
Shree Medical,18.5501,73.8001,MH-PZ1-19-55555,cancelled
```

* `status` containing closed / cancelled / suspended / revoked / surrendered removes the matching map POI (within 60 m, same name).
* A row with no matching map POI is added as an offline (registry-only) competitor.
* Sources: FSSAI FoSCoS (food), FDA Maharashtra drug licences (pharmacy), RBI branch master / IFSC (bank),
  PESO + oil-company outlet locators (fuel), BEE / operator lists (EV). Registries give addresses; geocode
  to lat/lon before adding (pincode centroid is acceptable for a first pass).
* Rows can also be POSTed: `POST /api/live/registry/:category` with `{ "rows": [ ... ] }` (logged-in user).
