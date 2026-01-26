# BalanceBooks Trucking Tools Suite

Free calculators and converters for truckers and owner-operators. All tools run 100% client-side with no data uploaded to any server.

## 🛠️ Included Tools

| Tool | URL | Description |
|------|-----|-------------|
| **Tools Home** | `/` | Landing page with all tools |
| **Fuel Card Converter** | `/fuel-converter` | Convert fuel card CSVs from 8+ providers |
| **IFTA Calculator** | `/ifta-calculator` | Calculate quarterly fuel tax by state |
| **Load Profitability** | `/load-calculator` | Calculate true profit per load |
| **Cost Per Mile** | `/cost-per-mile` | Track operating expenses and break-even rate |
| **Deadhead Calculator** | `/deadhead-calculator` | Calculate cost of empty miles |
| **Per Diem Calculator** | `/per-diem` | Calculate tax deductions for meals |

## ⛽ Supported Fuel Cards

Each has its own SEO-optimized landing page:

- Love's (`/loves-converter`)
- Pilot Flying J (`/pilot-converter`)
- Comdata (`/comdata-converter`)
- EFS (`/efs-converter`)
- WEX (`/wex-converter`)
- Fuelman (`/fuelman-converter`)
- TCS (`/tcs-converter`)
- TA/Petro (`/ta-petro-converter`)

## 🚀 Deployment

### Option 1: GitHub Actions + Netlify (Recommended)

This repo includes automated CI/CD via GitHub Actions.

**One-time Setup:**

1. **Create Netlify Site**
   - Go to [app.netlify.com](https://app.netlify.com) → Add new site
   - Deploy manually first (drag any folder) to get Site ID

2. **Get Netlify Credentials**
   - **Site ID:** Site settings → General → Site ID
   - **Auth Token:** User settings → Applications → Personal access tokens → New access token

3. **Add GitHub Secrets**
   
   Go to your repo → Settings → Secrets and variables → Actions → New repository secret:
   
   | Secret Name | Value |
   |-------------|-------|
   | `NETLIFY_AUTH_TOKEN` | Your personal access token |
   | `NETLIFY_SITE_ID` | Your site ID (e.g., `a1b2c3d4-e5f6-...`) |

4. **Push to Main** → Auto-deploys! 🎉

Every push to `main` triggers deployment. PRs get preview URLs.

### Option 2: Netlify Drag & Drop (Fastest for first deploy)

1. Go to [app.netlify.com](https://app.netlify.com)
2. Drag this entire folder to the deploy area
3. Set custom domain: `tools.balancebooksapp.com`
4. Done! Live in ~60 seconds

### Option 3: Netlify CLI

```bash
npm install -g netlify-cli
netlify login
netlify deploy --prod --dir .
```

### DNS Configuration

Add CNAME record:
```
Type: CNAME
Name: tools
Value: [your-netlify-site].netlify.app
TTL: Auto
```

## 📁 File Structure

```
├── index.html                 # Tools landing page
├── manifest.json              # PWA manifest
├── netlify.toml               # Netlify config + redirects
├── .github/
│   └── workflows/
│       └── deploy.yml         # GitHub Actions auto-deploy
├── js/
│   └── integration.js         # App integration utilities
├── icons/
│   └── icon.svg               # App icon (convert to PNGs)
├── fuel-converter/
│   └── index.html             # Fuel card converter
├── ifta-calculator/
│   └── index.html             # IFTA tax calculator
├── load-calculator/
│   └── index.html             # Load profitability
├── cost-per-mile/
│   └── index.html             # Operating cost calculator
├── deadhead-calculator/
│   └── index.html             # Empty miles calculator
├── per-diem/
│   └── index.html             # Per diem tax calculator
├── loves-converter/           # SEO landing pages
├── pilot-converter/
├── comdata-converter/
├── efs-converter/
├── wex-converter/
├── fuelman-converter/
├── tcs-converter/
└── ta-petro-converter/
```

## 🔧 PWA Setup

The `manifest.json` enables "Add to Home Screen" functionality. To fully enable:

1. Generate PNG icons from `icons/icon.svg`:
   - icon-72.png, icon-96.png, icon-128.png
   - icon-144.png, icon-152.png, icon-192.png
   - icon-384.png, icon-512.png

2. Use a tool like [realfavicongenerator.net](https://realfavicongenerator.net)

3. Add service worker for offline capability (optional)

## 📊 Analytics (Optional)

Add Google Analytics to each tool by inserting before `</head>`:

```html
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>
```

Track custom events:
```javascript
// When user completes conversion
gtag('event', 'conversion_complete', {
  'tool': 'fuel-converter',
  'provider': 'loves',
  'rows': 150
});
```

## 🎯 SEO Notes

- Each fuel card has dedicated landing page for Google ranking
- Canonical URLs set for all pages
- Meta descriptions optimized for search intent
- Schema.org markup can be added for rich results

Target keywords:
- "Loves fuel card CSV converter"
- "Pilot Flying J statement export"
- "IFTA calculator trucking"
- "cost per mile owner operator"
- "trucker per diem calculator"

## 🔗 Integration with BalanceBooks Trucking App

Tools can send data directly to the main trucking app via localStorage:

| Tool | Button | Data Sent |
|------|--------|-----------|
| Fuel Converter | 🚀 Import to App | Fuel transactions |
| IFTA Calculator | 🚀 Send to BalanceBooks | Quarterly state data |
| Load Calculator | 💾 Save to BalanceBooks | Load profitability analysis |
| Cost Per Mile | 🔄 Sync to BalanceBooks | CPM settings |

**How it works:**
1. User clicks integration button
2. Data stored in `localStorage` key: `bb_tools_export`
3. Opens trucking app with `?import=tools` URL param
4. App detects import, shows confirmation modal
5. Data imported to appropriate section

See `INTEGRATION-DEPLOYMENT.md` for React hooks and components to add to your trucking app.

**Quick link buttons for the trucking app:**
```jsx
<button onClick={() => window.open('https://tools.balancebooksapp.com/fuel-converter', '_blank')}>
  📤 Import from Fuel Card
</button>
```

## 📝 License

Free for use. Built by BalanceBooks.

## 🤝 Support

- Website: [balancebooksapp.com](https://balancebooksapp.com)
- Trucking App: [trucking.balancebooksapp.com](https://trucking.balancebooksapp.com)
