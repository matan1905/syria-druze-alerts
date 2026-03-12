## RedAlert API Documentation

Source: `https://redalert.orielhaim.com/docs`](https://redalert.orielhaim.com/docs)

A free Service for Israel's real-time emergency alerts - missiles, earthquakes, hostile aircraft intrusions, terrorist infiltrations, and more. Built for developers who want to integrate life-saving data into their applications.

This service is provided free of charge as a public resource for the Israeli developer community and anyone building emergency-preparedness tools. No rate-limit tiers to purchase - just open data, openly served.

Maintained by [Oriel Haim](https://orielhaim.com/) - the sole developer behind this project. Follow for updates, status reports, and new feature announcements:

- [X (Twitter)](https://x.com/orielhaim)
- [LinkedIn](https://linkedin.com/in/orielhaim)
- [GitHub](https://github.com/orielhaim)

### Powered by Community Donations

Servers, bandwidth, and development time all cost money. This project stays alive thanks to generous donations from people who rely on it. Every contribution - big or small - helps keep the service running and free for everyone.

[Contact on WhatsApp to Donate](https://wa.me/972587625442)

#### Disclaimer

This is an independent community project and is not officially affiliated with, endorsed by, or connected to Israel's Home Front Command or any government body. The developer assumes no responsibility or liability for the accuracy, reliability, or timeliness of the data provided. There is no guarantee of continuous operation - the service is provided "as is" and may be discontinued or interrupted at any time without prior notice. Do not rely solely on this API for life-saving alerts. Always use official channels as your primary source.
  
---

## Public API Key (Beta)

Source: `https://redalert.orielhaim.com/docs/public-api`](https://redalert.orielhaim.com/docs/public-api)

The Public API key lets you embed RedAlert alerts and data directly into your website or app. Unlike private keys, a public key is tied to a specific origin (your domain) so it can be used safely in client-side code without exposing full access.

#### Access Required

The Public API is currently locked. Access requires administrator approval. If you need a public key for your project, contact through the dashboard or your account manager. Once approved, you can create a public key linked to your domain.

### How Origin Works

**What is origin?**

When you create a public key, you specify the domain where it will be used (for example, `myapp.com` or `https://www.myapp.com`). This is called the origin. The API only accepts requests that come from that exact domain.

**Why does it matter?**

Because public keys can be used in the browser, anyone could copy your key from the page source. By binding the key to your origin, RedAlert ensures that even if someone copies it, they cannot use it from their own site. Your key only works when requests come from your approved domain.

**What you need to provide**

When creating a public key, you will be asked for the origin of your application. Use the full domain where your app runs (e.g. `https://example.com`). Make sure it matches exactly what appears in the browser address bar when users visit your site.
  
---

## Statistics API

### Distribution Statistics

Source: `https://redalert.orielhaim.com/docs/stats/distribution`](https://redalert.orielhaim.com/docs/stats/distribution)

Get the distribution of alerts grouped by type (category) or by origin source. Useful for understanding the nature and source of threats over time, building pie charts, and calculating percentage breakdowns. Use `groupBy` to switch between category and origin views. The response includes `totalAlerts` so you can compute percentages client-side without extra requests.

**Endpoint**

- `GET /api/stats/distribution` — returns alert count breakdown by category

**Query Parameters**

| Parameter | Type | Description | Default | Required |
| --- | --- | --- | --- | --- |
| `startDate` | ISO 8601 | Filter alerts from this date onwards | all time | no |
| `endDate` | ISO 8601 | Filter alerts until this date | now | no |
| `origin` | string | Filter by alert origin(s), comma-separated (e.g. `gaza,lebanon`) | all origins | no |
| `groupBy` | enum | Group results by: `category` or `origin` | `category` | no |
| `category` | string | Filter by specific alert type (exact match) | - | no |
| `limit` | integer | Number of categories to return (1–100) | 50 | no |
| `offset` | integer | Number of results to skip for pagination | 0 | no |
| `sort` | enum | Sort results by field: `count` or `label` | `count` | no |
| `order` | enum | Sort direction: `asc` or `desc` | `desc` | no |

**Example Request**

Full distribution of all alert types, sorted by count:

```bash
GET /api/stats/distribution
```

**Response Structure**

Data:

| Field | Type | Description |
| --- | --- | --- |
| `data[].label` | string | Category name or origin name (depends on `groupBy`) |
| `data[].count` | number | Total number of alerts for this group |

Meta & pagination:

| Field | Type | Description |
| --- | --- | --- |
| `totalAlerts` | number | Sum of all counts in the current result - useful for calculating percentages client-side |
| `pagination.total` | number | Total number of distinct categories matching the filters |
| `pagination.limit` | number | Requested limit |
| `pagination.offset` | number | Requested offset |
| `pagination.hasMore` | boolean | Whether more results are available |

**Example Response (by Category, default)**

```json
{
"data": [
    {
"label": "missiles",
"count": 12500
    },
    {
"label": "hostileAircraftIntrusion",
"count": 320
    },
    {
"label": "earthQuake",
"count": 5
    }
  ],
"totalAlerts": 12825,
"pagination": {
"total": 3,
"limit": 50,
"offset": 0,
"hasMore": false
  }
}
```

**Categories**

The `category` field matches the alert types documented in the [Alert Types](https://redalert.orielhaim.com/docs/alert-types) section. Use the `category` parameter to filter for a specific type.

**Calculating Percentages**

The `totalAlerts` field is the sum of all `count` values across the current grouping. Divide any item's count by `totalAlerts` to get its percentage — works identically for both `groupBy=category` and `groupBy=origin`.

**Date Filtering**

Combine `startDate` and `endDate` to analyze distribution for specific campaigns or periods of conflict. For example, compare threat composition before and after a specific date.

**Sorting & Pagination**

Sort by `count` or `category` with `order=asc/desc`. Use `limit` and `offset` for pagination - check `hasMore` to know if additional pages exist.
  
---

### History Statistics

Source: `https://redalert.orielhaim.com/docs/stats/history`](https://redalert.orielhaim.com/docs/stats/history)

Retrieve detailed historical records of alerts with full city data. Each alert includes the list of cities that were targeted simultaneously. By default, only city IDs and names are returned - use the `include` parameter to add translations and coordinates as needed.

**Endpoint**

- `GET /api/stats/history` — returns paginated alert history with nested city data

**Query Parameters**

| Parameter | Type | Description | Default | Required |
| --- | --- | --- | --- | --- |
| `startDate` | ISO 8601 | Filter alerts from this date onwards | all time | no |
| `endDate` | ISO 8601 | Filter alerts until this date | now | no |
| `limit` | integer | Number of alerts to return (1–100) | 20 | no |
| `offset` | integer | Number of results to skip for pagination | 0 | no |
| `cityId` | integer | Filter by city ID (exact match) | - | no |
| `cityName` | string | Filter by city name in Hebrew (exact match) | - | no |
| `search` | string | Search by city name (partial match, 1–100 chars) | - | no |
| `category` | string | Filter by alert type (e.g. `missiles`, `drones`, `earthquakes`) | - | no |
| `origin` | string | Filter by alert origin(s), comma-separated (e.g. `gaza,lebanon`) | all origins | no |
| `sort` | enum | Sort results by field: `timestamp`, `type`, or `origin` | `timestamp` | no |
| `order` | enum | Sort direction: `asc` or `desc` | `desc` | no |
| `include` | string | Comma-separated optional fields: `translations`, `coords`, `polygons` | - (none) | no |

**The `include` Parameter**

By default, each city in the `cities` array only contains `id` and `name`. Use `include` to opt-in to additional fields. This significantly reduces response size when you don't need translations or coordinates.

| Value | Fields Added to Each City | Use Case |
| --- | --- | --- |
| `translations` | `translations.name` (en, ru, ar) | Multi-language alert feeds |
| `coords` | `lat`, `lng` | Plotting alerts on a map |
| `polygons` | `polygons` (GeoJSON) | City boundary / shape on map |

**City Filter Priority**

Three parameters filter by city: `cityId`, `cityName`, and `search`. Only one is applied at a time, in this priority order:

`cityId` → `cityName` → `search`

**Example Request**

Latest 20 alerts - minimal response:

```bash
GET /api/stats/history
```

**Response Structure**

Always included:

| Field | Type | Description |
| --- | --- | --- |
| `data[].id` | number | Unique alert ID |
| `data[].timestamp` | string | ISO 8601 timestamp of the alert |
| `data[].type` | string | Alert category (e.g. `missiles`) |
| `data[].origin` | string \| null | Alert origin / threat source (e.g. `gaza`, `lebanon`) |
| `data[].cities[].id` | number | City ID |
| `data[].cities[].name` | string | City name in Hebrew |

Optional - requires `include`:

| Field | Type | Description | `include` |
| --- | --- | --- | --- |
| `data[].cities[].translations` | object | Translated name in `en`, `ru`, `ar` | `translations` |
| `data[].cities[].lat` | number | Latitude coordinate | `coords` |
| `data[].cities[].lng` | number | Longitude coordinate | `coords` |
| `data[].cities[].polygons` | object | GeoJSON polygon for city boundary | `polygons` |

Pagination:

| Field | Type | Description |
| --- | --- | --- |
| `pagination.total` | number | Total number of matching alerts |
| `pagination.limit` | number | Requested limit |
| `pagination.offset` | number | Requested offset |
| `pagination.hasMore` | boolean | Whether more results are available |

**Example Response**

```json
{
"data": [
    {
"id": 10523,
"timestamp": "2023-11-15T14:30:00.000Z",
"type": "missiles",
"origin": "gaza",
"cities": [
        {
"id": 45,
"name": "תל אביב - יפו"
        },
        {
"id": 46,
"name": "רמת גן"
        }
      ]
    },
    {
"id": 10522,
"timestamp": "2023-11-15T14:25:00.000Z",
"type": "missiles",
"origin": "gaza",
"cities": [
        {
"id": 12,
"name": "אשדוד"
        }
      ]
    }
  ],
"pagination": {
"total": 5420,
"limit": 2,
"offset": 0,
"hasMore": true
  }
}
```

**Notes**

- `include=translations` adds multilingual city names.
- `include=coords` adds `lat` / `lng`.
- `include=polygons` adds GeoJSON boundaries.
- A single alert often targets multiple cities `cities` is an array).

---

### Cities Statistics

Source: `https://redalert.orielhaim.com/docs/stats/cities`](https://redalert.orielhaim.com/docs/stats/cities)

Get a breakdown of alerts by city. By default, responses are lean - only city name, zone, and count. Use the `include` parameter to opt-in to extra fields like translations and coordinates, keeping bandwidth low when you don't need them.

**Endpoint**

- `GET /api/stats/cities` — returns paginated city alert statistics

**Query Parameters**

| Parameter | Type | Description | Default | Required |
| --- | --- | --- | --- | --- |
| `startDate` | ISO 8601 | Filter alerts from this date onwards | all time | no |
| `endDate` | ISO 8601 | Filter alerts until this date | now | no |
| `limit` | integer | Number of cities to return (1–500) | 10 | no |
| `offset` | integer | Number of results to skip for pagination | 0 | no |
| `origin` | string | Filter by alert origin(s), comma-separated (e.g. `gaza,lebanon`) | all origins | no |
| `search` | string | Search by city name (partial match, 1–100 chars) | - | no |
| `zone` | string | Filter by zone/region name (exact match) | - | no |
| `sort` | enum | Sort results by field: `count`, `city`, or `zone` | `count` | no |
| `order` | enum | Sort direction: `asc` or `desc` | `desc` | no |
| `include` | string | Comma-separated list of optional fields: `translations`, `coords`, `polygons` | - (none) | no |

**The `include` Parameter**

By default the response only contains `city`, `cityZone`, and `count`. Additional fields must be explicitly requested via the `include` parameter to minimize response size and database load.

| Value | Fields Added | Use Case | Approx. Size Impact |
| --- | --- | --- | --- |
| `translations` | `translations.name`, `translations.zone` (en, ru, ar) | Multi-language UIs | +~200 bytes/city |
| `coords` | `lat`, `lng` | Map rendering | +~30 bytes/city |
| `polygons` | `polygons` (GeoJSON) | City boundary / shape on map | varies |

**Example Request**

Top 5 cities by alert count - minimal response, no extra fields:

```bash
GET /api/stats/cities?limit=5
```

**Response Structure**

Always included:

| Field | Type | Description |
| --- | --- | --- |
| `data[].city` | string | City name in Hebrew |
| `data[].cityZone` | string | Zone/region the city belongs to |
| `data[].count` | number | Total number of alerts for this city |

Optional - requires `include`:

| Field | Type | Description | `include` |
| --- | --- | --- | --- |
| `data[].translations` | object | Translated name & zone in `en`, `ru`, `ar` | `translations` |
| `data[].lat` | number | Latitude coordinate | `coords` |
| `data[].lng` | number | Longitude coordinate | `coords` |
| `data[].polygons` | object | GeoJSON polygon for city boundary | `polygons` |

Pagination:

| Field | Type | Description |
| --- | --- | --- |
| `pagination.total` | number | Total number of matching cities |
| `pagination.limit` | number | Requested limit |
| `pagination.offset` | number | Requested offset |
| `pagination.hasMore` | boolean | Whether more results are available |

**Example Response**

```json
{
"data": [
    {
"city": "אזור",
"cityZone": "דן",
"count": 1269
    },
    {
"city": "בית דגן",
"cityZone": "השפלה",
"count": 1268
    }
  ],
"pagination": {
"total": 1580,
"limit": 2,
"offset": 0,
"hasMore": true
  }
}
```

**Notes**

- `search` supports partial Hebrew city name matching.
- `zone` can be used to focus on regions like `דן`, `השפלה`, `הנגב`.
- Combine `sort=city&order=asc` for alphabetic lists in a zone.

---

## Shelter API

### Shelter Search

Source: `https://redalert.orielhaim.com/docs/shelter/search`](https://redalert.orielhaim.com/docs/shelter/search)

Find nearby shelters using geospatial search. This endpoint uses a spatial index (KDBush) for fast nearest-neighbor queries. Results are sorted by distance from the search center.

**Endpoint**

- `GET /api/shelter/search` — find shelters near a given location

**Query Parameters**

| Parameter | Type | Description | Default | Required |
| --- | --- | --- | --- | --- |
| `lat` | number | Latitude of the search center (-90 to 90) | - | yes |
| `lon` | number | Longitude of the search center (-180 to 180) | - | yes |
| `limit` | integer | Maximum number of results to return (1–500) | 10 | no |
| `radiusKm` | number | Search radius in kilometers | unlimited | no |
| `wheelchairOnly` | boolean | Filter to only return wheelchair accessible shelters | `false` | no |
| `shelterType` | string | Filter by shelter type (e.g., `"public"`, `"private"`) | - | no |
| `city` | string | Filter by city name | - | no |

**Example Request**

Find 10 nearest shelters to Tel Aviv:

```bash
GET /api/shelter/search?lat=32.0853&lon=34.7818
```

**Response Structure**

| Field | Type | Description |
| --- | --- | --- |
| `success` | boolean | Whether the request was successful |
| `count` | number | Number of results returned |
| `results[].id` | number | Unique shelter identifier |
| `results[].address` | string | Street address of the shelter |
| `results[].city` | string | City name |
| `results[].building_name` | string | Building name or description |
| `results[].lat` | number | Latitude coordinate |
| `results[].lon` | number | Longitude coordinate |
| `results[].distance_meters` | number | Distance from search center in meters |
| `results[].distance_km` | number | Distance from search center in kilometers |
| `results[].capacity` | number | Maximum capacity of the shelter |
| `results[].wheelchair_accessible` | boolean | Whether the shelter has wheelchair access |
| `results[].has_stairs` | boolean | Whether there are stairs to access the shelter |
| `results[].shelter_type` | string | Type of shelter (e.g., `public`, `private`) |
| `results[].shelter_type_he` | string | Shelter type in Hebrew |
| `results[].area_sqm` | number | Shelter area in square meters |
| `results[].is_official` | boolean | Whether this is an official shelter |
| `results[].notes` | string | Additional notes about the shelter |

**Example Response**

```json
{
"success": true,
"count": 10,
"results": [
    {
"id": 1234,
"address": "רחוב הרצל 15",
"city": "תל אביב",
"building_name": "מרכז קהילתי",
"lat": 32.0861,
"lon": 34.7892,
"distance_meters": 250,
"distance_km": 0.25,
"capacity": 150,
"wheelchair_accessible": true,
"has_stairs": false,
"shelter_type": "public",
"shelter_type_he": "ציבורי",
"area_sqm": 120,
"is_official": true,
"notes": "פתוח 24/7 בזמן חירום"
    },
    {
"id": 1235,
"address": "רחוב דיזנגוף 42",
"city": "תל אביב",
"building_name": "בניין מגורים",
"lat": 32.0845,
"lon": 34.785,
"distance_meters": 420,
"distance_km": 0.42,
"capacity": 50,
"wheelchair_accessible": false,
"has_stairs": true,
"shelter_type": "private",
"shelter_type_he": "פרטי",
"area_sqm": 40,
"is_official": false,
"notes": null
    }
  ]
}
```

**Notes**

- Distances use the Haversine formula and are returned in meters and kilometers.
- Results are sorted by distance ascending.
- `wheelchairOnly=true` restricts to accessible shelters.

---

## Data API

### Cities Catalog

Source: `https://redalert.orielhaim.com/docs/data/cities`](https://redalert.orielhaim.com/docs/data/cities)

Access the full catalog of cities and locations known to the system. This endpoint returns the raw location records (without alert statistics) and is ideal for building dropdowns, lookup tables, and map layers.

**Endpoint**

- `GET /api/data/cities` — returns a paginated list of cities/locations from the internal catalog

**Query Parameters**

| Parameter | Type | Description | Default | Required |
| --- | --- | --- | --- | --- |
| `search` | string | Search by city name (partial match, 1–100 chars) | - | no |
| `zone` | string | Filter by zone/region name (exact match) | - | no |
| `limit` | integer | Number of cities to return (1–500) | 100 | no |
| `offset` | integer | Number of results to skip for pagination | 0 | no |
| `include` | string | Comma-separated list of optional fields: `translations`, `coords`, `countdown` | - (none) | no |

**The `include` Parameter**

By default the response only contains `id`, `name`, and `zone`. Additional fields must be explicitly requested via the `include` parameter to minimize response size and database load.

| Value | Fields Added | Use Case |
| --- | --- | --- |
| `translations` | `translations.name`, `translations.zone` | Multi-language UIs and region labels |
| `coords` | `lat`, `lng` | Map rendering and spatial queries |
| `countdown` | `countdown` | Showing shelter countdown times or safety timers in your UI |

**Example Request**

First 100 cities with minimal fields:

```bash
GET /api/data/cities
```

**Response Structure**

Always included:

| Field | Type | Description |
| --- | --- | --- |
| `data[].id` | number | Internal location identifier |
| `data[].name` | string | City name in Hebrew |
| `data[].zone` | string \| null | Zone/region the city belongs to |

Optional - requires `include`:

| Field | Type | Description | `include` |
| --- | --- | --- | --- |
| `data[].translations` | object | Translated name & zone (e.g. `en`, `ru`, `ar`) | `translations` |
| `data[].lat` | number \| null | Latitude coordinate | `coords` |
| `data[].lng` | number \| null | Longitude coordinate | `coords` |
| `data[].countdown` | number \| null | Configured countdown time (seconds) for this location, if available | `countdown` |

Pagination:

| Field | Type | Description |
| --- | --- | --- |
| `pagination.total` | number | Total number of matching cities |
| `pagination.limit` | number | Requested limit |
| `pagination.offset` | number | Requested offset |
| `pagination.hasMore` | boolean | Whether more results are available |

**Notes**

- Use this endpoint to build city pickers, auto-complete inputs and other UI elements that need a consistent list of locations, independent of alert statistics.
- Combine `search` with `zone` for efficient filtered lookups.

---

## Alert Types

Source: `https://redalert.orielhaim.com/docs/alert-types`](https://redalert.orielhaim.com/docs/alert-types)

### Real Emergency Alerts

- `endAlert` — End alert
- `newsFlash` — Pre-alert news flash
- `terroristInfiltration` — Terrorist infiltration
- `hazardousMaterials` — Hazardous materials
- `hostileAircraftIntrusion` — Hostile aircraft
- `tsunami` — Tsunami warnings
- `earthQuake` — Earthquake alerts
- `radiologicalEvent` — Radiological incidents
- `missiles` — Missile/Rocket attacks

### Emergency Drills

- `terroristInfiltrationDrill` — Infiltration drill
- `hazardousMaterialsDrill` — Hazmat drill
- `hostileAircraftIntrusionDrill` — Aircraft drill
- `tsunamiDrill` — Tsunami drill
- `earthQuakeDrill` — Earthquake drill
- `radiologicalEventDrill` — Radiological drill
- `missilesDrill` — Missile drill
  