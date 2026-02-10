## Licensed broker reviews (data pipeline)

This folder is for **reviews you have a license to use** (exports from third‑party platforms) and/or reviews submitted directly to BrokerProReviews.

### Key rule
- **Do not scrape** reviews from third‑party sites.
- Only import reviews you **own** or are **licensed** to republish.

### How it works
1. Put your exported review files into `data/reviews/exports/`
2. Commit and push
3. GitHub Actions will:
   - Normalize exports into `data/reviews/normalized.json`
   - Rebuild the “Detailed Broker Reviews” block on `site1-dark-gradient/index.html`
   - Update rating counts used on the page (and can be extended to schema)

### Supported export format (v1)
Each file in `data/reviews/exports/` must be a JSON array of objects with this minimal shape:

```json
[
  {
    "brokerSlug": "exness",
    "rating": 5,
    "text": "Fast withdrawals for me, spreads ok on majors.",
    "date": "2026-02-01",
    "author": "Maria",
    "sourceName": "ExamplePlatform",
    "sourceUrl": "https://example.com/reviews/exness",
    "locale": "en",
    "country": "MX"
  }
]
```

Notes:
- `brokerSlug` must be one of: `exness`, `libertex`, `xm-group`, `pepperstone`
- `rating` is 1–5 (integer)
- `date` must be `YYYY-MM-DD`
- `author` will be anonymized to initials on the site
- `sourceName`/`sourceUrl` are displayed as “Source” so the site shows third‑party evidence

### Adding more brokers
Extend the slug list in:
- `scripts/reviews/reviews.config.mjs`

