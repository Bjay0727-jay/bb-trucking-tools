# BalanceBooks Tools → Trucking App Integration

Cross-origin data transfer from `tools.balancebooksapp.com` to `trucking.balancebooksapp.com`.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     FREE TOOLS SUITE                            │
│              tools.balancebooksapp.com                          │
│                                                                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │  Fuel    │ │  IFTA    │ │  Load    │ │  Cost    │          │
│  │Converter │ │Calculator│ │Calculator│ │ Per Mile │          │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘          │
│       │            │            │            │                  │
│  ┌────┴─────┐ ┌────┴─────┐     │            │                  │
│  │  Per     │ │ Deadhead │     │            │                  │
│  │  Diem   │ │Calculator│     │            │                  │
│  └────┬─────┘ └────┬─────┘     │            │                  │
│       │            │            │            │                  │
│       └────────────┴─────┬──────┴────────────┘                  │
│                          │                                      │
│              BB_INTEGRATION.sendToApp()                         │
│                          │                                      │
└──────────────────────────┼──────────────────────────────────────┘
                           │
             ┌─────────────┴──────────────┐
             │  postMessage (cross-origin) │
             │  URL hash fallback (#bbdata)│
             └─────────────┬──────────────┘
                           │
┌──────────────────────────┼──────────────────────────────────────┐
│                          │                                      │
│              BALANCEBOOKS TRUCKING APP                          │
│              trucking.balancebooksapp.com                       │
│                          │                                      │
│              BB_INTEGRATION.listenForImport()                   │
│                          │                                      │
│  ┌──────────┐ ┌─────────▼────┐ ┌──────────┐ ┌──────────┐      │
│  │  Fuel    │ │   Import     │ │  IFTA    │ │   Load   │      │
│  │   Log    │ │   Handler    │ │ Reports  │ │  Tracker │      │
│  └──────────┘ └──────────────┘ └──────────┘ └──────────┘      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## How It Works

1. User clicks **"Send to BalanceBooks"** on any tool page
2. Tool builds a structured JSON payload and calls `BB_INTEGRATION.sendToApp(payload, route)`
3. Confirmation dialog shows a summary of data being sent
4. **Primary path:** Opens trucking app in a new tab, sends payload via `window.postMessage` with origin validation. Retries every 500ms until the trucking app acknowledges (max 30s).
5. **Fallback path:** If popup is blocked, encodes payload in URL hash (`#bbdata=...`) and navigates in the same tab.
6. Trucking app calls `BB_INTEGRATION.listenForImport(callback)` to receive data via either method.

### Why not localStorage?

`localStorage` is per-origin. `tools.balancebooksapp.com` and `trucking.balancebooksapp.com` are different origins, so they cannot share `localStorage`. `postMessage` is the standard cross-origin browser communication API.

---

## Shared Library: `js/integration.js` (v2.0)

Both apps can include this file. It provides:

### Sender API (used by tools site)

```js
BB_INTEGRATION.sendToApp(payload, route, silent)
```

- `payload` — Object with `source` key identifying the tool
- `route` — Trucking app route: `fuel`, `ifta`, `loads`, `settings`, `expenses`
- `silent` — If `true`, skips the confirmation dialog

### Receiver API (used by trucking app)

```js
BB_INTEGRATION.listenForImport(function(payload) {
    // payload.source tells you which tool sent the data
    console.log(payload.source, payload);
});
```

Handles both `postMessage` (popup) and URL hash (same-tab fallback). Sends an acknowledgment back to the sender to stop retries.

---

## Payload Reference

### Fuel Converter → `/fuel`

```json
{
    "source": "fuel-converter",
    "version": "2.0",
    "timestamp": "2025-01-15T10:30:00.000Z",
    "provider": "loves",
    "rowCount": 45,
    "data": [
        {
            "date": "2025-01-10",
            "location": "Love's #301",
            "city": "Dallas",
            "state": "TX",
            "gallons": 120.5,
            "pricePerGallon": 3.45,
            "totalAmount": 415.73,
            "fuelType": "Diesel",
            "odometer": "234567",
            "truckStop": "loves"
        }
    ],
    "summary": {
        "gallons": 1250.5,
        "amount": 4312.50
    }
}
```

### IFTA Calculator → `/ifta`

```json
{
    "source": "ifta-calculator",
    "version": "2.0",
    "timestamp": "2025-01-15T10:30:00.000Z",
    "quarter": "Q1",
    "year": 2025,
    "states": [
        { "abbr": "TX", "miles": 2500, "gallons": 400 },
        { "abbr": "OK", "miles": 800, "gallons": 130 }
    ],
    "summary": {
        "totalMiles": 3300,
        "totalGallons": 530,
        "mpg": 6.5,
        "totalTaxOwed": "42.15",
        "statesWithActivity": 2
    }
}
```

### Load Calculator → `/loads`

```json
{
    "source": "load-calculator",
    "version": "2.0",
    "timestamp": "2025-01-15T10:30:00.000Z",
    "load": {
        "lineHaul": 3200,
        "fuelSurcharge": 250,
        "loadedMiles": 1200,
        "deadheadMiles": 75,
        "fuelPrice": 3.50,
        "mpg": 6.5,
        "costPerMile": 0.45,
        "dispatchFee": 320,
        "grossRevenue": 3450,
        "netProfit": 1850,
        "rpmGross": 2.71,
        "rpmNet": 1.45,
        "profitMargin": 53.6,
        "verdict": "Good Load"
    }
}
```

### Cost Per Mile → `/settings`

```json
{
    "source": "cost-per-mile",
    "version": "2.0",
    "timestamp": "2025-01-15T10:30:00.000Z",
    "settings": {
        "monthlyMiles": 10000,
        "fixedCosts": {
            "truckPayment": 1800,
            "insurance": 800,
            "permits": 150,
            "eld": 35,
            "parking": 200
        },
        "variableCosts": {
            "fuel": 5385,
            "maintenance": 500,
            "tires": 200,
            "def": 50,
            "tolls": 150
        },
        "calculated": {
            "fixedTotal": 2985,
            "variableTotal": 6285,
            "totalMonthly": 9270,
            "totalCPM": 0.927,
            "fixedCPM": 0.2985,
            "variableCPM": 0.6285,
            "breakEvenRate": 0.927,
            "recommendedRate20": 1.159,
            "recommendedRate30": 1.324
        }
    }
}
```

### Per Diem → `/expenses`

```json
{
    "source": "per-diem",
    "version": "2.0",
    "timestamp": "2025-01-15T10:30:00.000Z",
    "perDiem": {
        "dailyRate": 69,
        "fullDays": 250,
        "partialDays": 24,
        "fullDaysAmount": 17250,
        "partialDaysAmount": 1242,
        "totalDeduction": 18492,
        "deductibleAmount": 14793.6,
        "taxBracket": 0.22,
        "stateRate": 0.05,
        "savings": {
            "federal": 3254.59,
            "state": 739.68,
            "selfEmployment": 2263.42,
            "total": 6257.69
        }
    }
}
```

### Deadhead Calculator → `/loads`

```json
{
    "source": "deadhead-calculator",
    "version": "2.0",
    "timestamp": "2025-01-15T10:30:00.000Z",
    "deadhead": {
        "miles": 150,
        "fuelPrice": 3.50,
        "mpg": 6.5,
        "otherCostsPerMile": 0.35,
        "hourlyRate": 25,
        "gallonsUsed": 23.1,
        "hours": 2.7,
        "costs": {
            "fuel": 80.77,
            "operating": 52.50,
            "time": 68.18,
            "total": 201.45
        },
        "minLoadRate": 201.45
    }
}
```

---

## Implementing the Receiver (Trucking App)

### 1. Include `integration.js`

Copy `js/integration.js` into the trucking app, or load it from the tools CDN:

```html
<script src="https://tools.balancebooksapp.com/js/integration.js"></script>
```

### 2. Listen for imports

Call once on app startup:

```js
BB_INTEGRATION.listenForImport(function(payload) {
    switch (payload.source) {
        case 'fuel-converter':
            importFuelTransactions(payload.data, payload.summary);
            break;
        case 'ifta-calculator':
            importIFTAData(payload.quarter, payload.year, payload.states, payload.summary);
            break;
        case 'load-calculator':
            importLoad(payload.load);
            break;
        case 'cost-per-mile':
            updateCPMSettings(payload.settings);
            break;
        case 'per-diem':
            importPerDiem(payload.perDiem);
            break;
        case 'deadhead-calculator':
            importDeadhead(payload.deadhead);
            break;
    }
});
```

### 3. Validate incoming data

```js
function validateImportData(data) {
    var validSources = [
        'fuel-converter', 'ifta-calculator', 'load-calculator',
        'cost-per-mile', 'per-diem', 'deadhead-calculator'
    ];
    if (!validSources.includes(data.source)) {
        throw new Error('Invalid import source: ' + data.source);
    }

    // Reject data older than 1 hour
    var importTime = new Date(data.timestamp);
    if (Date.now() - importTime.getTime() > 3600000) {
        throw new Error('Import data expired');
    }

    return true;
}
```

---

## Security

- **Origin validation:** `listenForImport()` only accepts `postMessage` events from `https://tools.balancebooksapp.com`
- **No eval/innerHTML:** Payloads are plain JSON objects, never injected as HTML
- **Timestamp expiry:** Receiver should reject payloads older than 1 hour
- **Source whitelist:** Receiver should validate `payload.source` against known tool names
- **URL hash cleanup:** Hash data is removed from the URL bar via `history.replaceState` after reading

---

## Testing Checklist

- [ ] Fuel converter → `/fuel` import
- [ ] IFTA calculator → `/ifta` import
- [ ] Load calculator → `/loads` import
- [ ] Cost per mile → `/settings` import
- [ ] Per diem → `/expenses` import
- [ ] Deadhead calculator → `/loads` import
- [ ] postMessage transfer works across subdomains
- [ ] URL hash fallback works when popup blocked
- [ ] Acknowledgment stops retry interval
- [ ] Data validation rejects invalid/expired imports
- [ ] Confirmation dialog shows correct summary per tool
