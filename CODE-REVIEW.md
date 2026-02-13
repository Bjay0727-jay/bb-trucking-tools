# Code Review: BalanceBooks Trucking Tools

**Reviewed:** 2026-02-05
**Scope:** Full codebase review — security, bugs, architecture, performance, accessibility, SEO, Netlify config, PWA, and integration with [balancebooks-trucking](https://github.com/Bjay0727-jay/balancebooks-trucking)

---

## Summary

This is a well-built static site — vanilla HTML/CSS/JS with no build step, hosted on Netlify. The tools are practical, the UI is polished, and the client-side-only architecture is a strong trust signal for the target audience (owner-operators handling sensitive financial data). Below are actionable recommendations organized by severity.

---

## 1. Security Issues

### 1a. XSS via innerHTML with user-supplied CSV data (HIGH)

**Files:** `fuel-converter/index.html:1332-1345`, `fuel-converter/index.html:1575-1603`

The fuel converter renders parsed CSV data directly into the DOM using `innerHTML` without sanitization. A malicious CSV could contain HTML/JS payloads in cell values.

```js
// fuel-converter/index.html:1590 — user CSV data inserted raw
return `<td class="${cls}">${val}</td>`;
```

**Recommendation:** Escape HTML entities before inserting into the DOM. Create a utility:
```js
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
```
Then use `escapeHtml(val)` everywhere user data is inserted via `innerHTML`. Alternatively, use `textContent` and DOM APIs instead of string templates.

### 1b. CSP allows `unsafe-inline` scripts (MEDIUM)

**File:** `netlify.toml:16`

```
script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com
```

All JavaScript is inline in every HTML file, so `unsafe-inline` is required in the current architecture. This weakens the CSP significantly.

**Recommendation:** Long-term, extract JavaScript into separate `.js` files and use nonce-based CSP or hashes. Short-term, this is acceptable for a static site with no user accounts, but be aware it allows any injected script to execute.

### 1c. localStorage data transfer has no origin validation (MEDIUM)

**File:** `js/integration.js:29`, `ifta-calculator/index.html:960`, `load-calculator/index.html:868`

Data is written to `localStorage` with a well-known key (`bb_tools_export`) and then the receiving app is expected to read it. Any script running on the same origin can read or tamper with this data.

**Recommendation:** Add a HMAC or checksum to the payload so the receiving app can verify integrity. At minimum, the timestamp-based expiry (mentioned in INTEGRATION.md) should be enforced in the tools themselves, not just documented.

### 1d. Base64 URL encoding is not encryption (LOW)

**File:** `fuel-converter/index.html:1709`

```js
const encoded = btoa(unescape(encodeURIComponent(jsonStr)));
```

This uses `btoa()` which is just encoding, not encryption. Anyone can decode the URL hash. This is fine since the data isn't secret, but the code comment says "Encode data for URL transfer (base64)" which could mislead future developers into thinking it provides security.

**Recommendation:** Add a comment clarifying this is for URL-safe transport, not security.

---

## 2. Bugs

### 2a. IFTA `sendToBalanceBooks()` uses wrong `data-field` attribute (HIGH)

**File:** `ifta-calculator/index.html:907-908`

```js
const milesInput = document.querySelector(`input[data-state="${abbr}"][data-field="miles"]`);
const gallonsInput = document.querySelector(`input[data-state="${abbr}"][data-field="gallons"]`);
```

But the inputs are created with `data-type`, not `data-field`:

```html
<input ... data-state="${code}" data-type="miles" ...>
```

This means `sendToBalanceBooks()` will **always find null** for every input, and the function will always trigger the "Please enter miles and gallons" alert, making the BalanceBooks integration completely non-functional for IFTA.

**Fix:** Change `data-field` to `data-type` in both selectors:
```js
const milesInput = document.querySelector(`input[data-state="${abbr}"][data-type="miles"]`);
const gallonsInput = document.querySelector(`input[data-state="${abbr}"][data-type="gallons"]`);
```

### 2b. IFTA MPG calculation uses running totals before they're accumulated (MEDIUM)

**File:** `ifta-calculator/index.html:916`

Inside the loop that builds `stateData`, the code calculates MPG using `totalMiles` and `totalGallons`, but these are being accumulated *within the same loop*:

```js
const mpg = totalMiles > 0 && totalGallons > 0 ? totalMiles / totalGallons : 6.5;
```

On the first iteration, both are 0, so it falls back to 6.5. On subsequent iterations, it uses partial totals. This means the tax calculation varies depending on the order states are processed.

**Fix:** Use the `avgMpg` input value (already used in the `calculate()` function) instead:
```js
const mpg = parseFloat(document.getElementById('avgMpg').value) || 6.5;
```

### 2c. `getCurrentQuarter()` always returns current quarter, ignoring user selection (LOW)

**File:** `ifta-calculator/index.html:978-984`

The quarter selector buttons update the UI but `sendToBalanceBooks()` calls `getCurrentQuarter()` which returns the calendar quarter, not the selected one.

**Fix:** Read the active quarter button instead:
```js
function getSelectedQuarter() {
    const btn = document.querySelector('.quarter-btn.active');
    return btn ? btn.dataset.q : getCurrentQuarter();
}
```

### 2d. Mobile menu button has no corresponding `.mobile-nav` element (LOW)

**File:** `index.html:567`

```html
<button class="mobile-menu-btn" onclick="document.querySelector('.mobile-nav').classList.toggle('open')">
```

There is no `.mobile-nav` element in the DOM, and no CSS for `.mobile-menu-btn`. This button does nothing and may throw a console error on click.

**Fix:** Either implement the mobile navigation or remove the button.

### 2e. Fuel converter accepts `.xls`/`.xlsx` but parses them as text (LOW)

**File:** `fuel-converter/index.html:1221-1228`

Excel binary files are read as text via `FileReader.readAsText()`, which will produce garbled output. The toast message says "For best results, save as CSV first" but then tries to parse anyway.

**Fix:** Either remove `.xls`/`.xlsx` from the accepted types, or add a proper Excel parser (e.g., SheetJS). At minimum, show an error instead of attempting to parse.

---

## 3. Code Architecture / Maintainability

### 3a. Massive CSS duplication across all pages (~3,500+ lines repeated)

Every HTML file contains a near-identical copy of the base styles (CSS variables, body, header, footer, container, buttons, etc.). This means any design change must be made in 15+ files.

**Recommendation:** Extract shared CSS into a single `styles/shared.css` file. Each tool can then have a small `<style>` block for tool-specific styles. This reduces total CSS by ~60% and makes design updates trivial.

### 3b. No shared JavaScript utilities

Each tool reimplements common patterns: number formatting, confirmation dialogs, BalanceBooks integration, toast notifications, etc. The `js/integration.js` exists but is not imported by any tool — they all implement integration inline.

**Recommendation:**
- Create `js/shared.js` for common utilities (formatting, toasts, etc.)
- Actually use `js/integration.js` via `<script src="/js/integration.js">` instead of duplicating the integration code in every file.

### 3c. Inline JavaScript makes individual tools 800-1700+ lines

The fuel converter is 1,777 lines in a single HTML file. This makes it hard to test, debug, or collaborate on.

**Recommendation:** Extract JavaScript into per-tool `.js` files (e.g., `fuel-converter/app.js`). This also enables future use of linters, minifiers, and testing tools.

### 3d. No shared HTML template/component for header and footer

Each page has its own header/footer HTML. Some link the logo to `/`, some to `/fuel-converter`, and some to `https://balancebooksapp.com`. This inconsistency hurts navigation.

**Recommendation:** Standardize header/footer. All logos should link to `/` (the tools home). Consider a simple build step (e.g., Eleventy or a shell script) to inject shared partials, or use JavaScript to inject the header/footer.

---

## 4. Performance

### 4a. Google Fonts loaded synchronously blocks rendering

**All files:** Every page loads Google Fonts synchronously:
```html
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:..." rel="stylesheet">
```

This is render-blocking. Users on slow connections will see a blank page until fonts load.

**Recommendation:** Add `font-display: swap` or load fonts asynchronously:
```html
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" media="print" onload="this.media='all'">
```

### 4b. No HTML caching headers configured

**File:** `netlify.toml`

Caching is configured for icons, CSS files, and `manifest.json`, but not for HTML pages. Since this is a static site with infrequent changes, HTML could benefit from short cache times (e.g., 1 hour).

**Recommendation:** Add:
```toml
[[headers]]
  for = "/*.html"
  [headers.values]
    Cache-Control = "public, max-age=3600"
```

### 4c. PapaParse loaded on every page load even when not needed (MINOR)

**File:** `fuel-converter/index.html:11`

PapaParse is loaded on the fuel converter page on initial load, but it's only needed after the user uploads a file. Consider lazy-loading it.

---

## 5. Accessibility

### 5a. No skip navigation link

No page has a skip-to-content link, which is important for keyboard/screen reader users.

**Recommendation:** Add at the top of each page:
```html
<a href="#main" class="sr-only">Skip to main content</a>
```

### 5b. Color contrast issues in dark theme

Several text elements use `var(--navy-400)` (#64748b) on `var(--navy-900)` (#0a1628) backgrounds. This yields a contrast ratio of approximately 3.9:1, which fails WCAG AA for normal text (requires 4.5:1).

**Recommendation:** Use `var(--navy-300)` (#94a3b8) as the minimum for body text, which gives ~5.4:1 contrast.

### 5c. Form inputs lack associated `<label>` elements

Many inputs use visual labels (text near the input) but don't use `<label for="...">` or wrap inputs in `<label>`. Screen readers can't associate these.

**Recommendation:** Ensure every `<input>` has a `<label>` with a matching `for` attribute pointing to the input's `id`.

### 5d. Interactive elements lack focus styles

All `:focus` styles only change border color. There are no visible focus indicators for buttons, links, or cards.

**Recommendation:** Add a visible focus ring:
```css
:focus-visible {
    outline: 2px solid var(--orange-500);
    outline-offset: 2px;
}
```

### 5e. IFTA state grids create 96+ inputs with no grouping

The IFTA calculator renders 48 states x 2 grids (miles + gallons) = 96 inputs. There's no `<fieldset>`, `<legend>`, or ARIA grouping, making it very difficult for screen reader users.

---

## 6. SEO

### 6a. Missing `<title>` in some Open Graph tags

Some tools (load-calculator, cost-per-mile, deadhead-calculator, per-diem) have no `og:url` or `og:type` meta tags. The landing page has them, but sub-tools are inconsistent.

**Recommendation:** Add `og:url` and `og:type` to all tool pages.

### 6b. No structured data (Schema.org)

The README mentions this as a TODO. For a tools site, `WebApplication` or `SoftwareApplication` schema would help with rich results.

### 6c. SEO landing pages use both meta refresh AND JavaScript redirect

**File:** `loves-converter/index.html:12,31`

```html
<meta http-equiv="refresh" content="0;url=/fuel-converter?provider=loves">
```
```js
window.location.href = '/fuel-converter?provider=loves';
```

Double redirects can confuse search engines. The `?provider=loves` parameter isn't even consumed by the fuel converter — there's no code that reads `URLSearchParams` for `provider`.

**Recommendation:** Either implement the provider parameter in the fuel converter (to auto-select the format) or remove it from the redirect URLs. Use server-side redirects (in `netlify.toml`) instead of client-side for better SEO.

### 6d. Fuel converter doesn't read the `?provider=` parameter

As noted above, SEO pages redirect to `/fuel-converter?provider=loves` etc., but the fuel converter JavaScript never reads URL parameters. This is a missed opportunity to auto-detect the format.

**Recommendation:** Add to fuel converter init:
```js
const params = new URLSearchParams(window.location.search);
const provider = params.get('provider');
if (provider) {
    detectedFormat = provider;
    // Update UI to show detected format
}
```

---

## 7. Integration Issues (with balancebooks-trucking)

### 7a. `js/integration.js` is never loaded by any tool

The shared integration module exists but isn't referenced by any HTML file. Every tool has its own inline integration code instead. This means the shared module is dead code.

**Recommendation:** Either import it in each tool (`<script src="/js/integration.js"></script>`) and refactor the inline code to use it, or remove the file to avoid confusion.

### 7b. Inconsistent integration patterns across tools

| Tool | Integration Method | Confirmation | Destination Route |
|------|--------------------|-------------|-------------------|
| Fuel Converter | Base64 URL hash | `confirm()` | `/?import=tools#data=...` |
| IFTA Calculator | localStorage | `confirm()` | `/ifta?import=tools` |
| Load Calculator | localStorage | `confirm()` | `/loads?import=tools` |
| Cost Per Mile | localStorage | `confirm()` | `/settings?import=cpm` |
| Deadhead | None (just links) | N/A | Homepage |
| Per Diem | None (just links) | N/A | Homepage |

The fuel converter uses a completely different transfer mechanism (URL hash with base64) than the other tools (localStorage). This means the receiving app needs to support two different import methods.

**Recommendation:** Standardize on one approach. localStorage is simpler and has no size limitations from URL length. The fuel converter should use the same localStorage pattern as the other tools.

### 7c. Import parameter inconsistency

Cost Per Mile uses `?import=cpm` while all other tools use `?import=tools`. The receiving app needs to handle both.

**Recommendation:** Standardize on `?import=tools` and use the `source` field in the payload to differentiate.

### 7d. No error handling for `window.open()` popup blocking

All tools use `window.open()` to open BalanceBooks. Modern browsers block popups unless triggered by a direct user action. While `confirm() -> window.open()` generally works, there's no fallback if the popup is blocked.

**Recommendation:** Add a fallback link:
```js
const win = window.open(url, '_blank');
if (!win) {
    // Show a clickable link instead
}
```

---

## 8. Netlify Configuration

### 8a. SPA fallback returns 404 status (CORRECT but worth noting)

**File:** `netlify.toml:108-111`

```toml
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 404
```

This is correct — showing the homepage with a 404 status for unknown URLs. Good for SEO. Just ensure the homepage handles this gracefully (it currently doesn't indicate "page not found").

### 8b. Missing redirect for `/load-calculator`

The `netlify.toml` has redirects for all tools *except* `/load-calculator`:

Looking again — it IS present at line 46-49. All tools are covered. No issue here.

### 8c. CSS cache headers won't match inline styles

```toml
[[headers]]
  for = "*.css"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"
```

There are no external `.css` files in the project — all styles are inline `<style>` tags. This header rule has no effect.

**Recommendation:** Remove this rule (it's misleading) or extract CSS into external files to benefit from caching.

---

## 9. PWA Issues

### 9a. PNG icons don't exist

**File:** `manifest.json:12-59`

The manifest references 8 PNG icons (`icon-72.png` through `icon-512.png`) but only an SVG exists in `/icons/`. This will cause PWA install prompts to fail.

**Recommendation:** Generate the PNG icons from the SVG. This can be done with a simple script or online tool.

### 9b. No service worker

The manifest enables PWA features but there's no service worker registered. This means:
- No offline support
- No "Add to Home Screen" prompt on mobile
- The "works offline" claim in the fuel converter description is false

**Recommendation:** Add a basic caching service worker for offline support. Since all tools are client-side only, full offline functionality is achievable.

### 9c. Shortcut icons don't exist

**File:** `manifest.json:67,74,81`

References to `fuel-96.png`, `ifta-96.png`, `load-96.png` — none of these files exist.

---

## 10. General Recommendations

### 10a. Add a `404.html` page

The catch-all redirect sends users to `index.html` with a 404 status, but the homepage gives no indication that the requested page doesn't exist.

### 10b. Add the GitHub Actions workflow

The README references `.github/workflows/deploy.yml` for CI/CD but the file doesn't exist. This should be created for automated deployments on push.

### 10c. Per Diem rate may need updating

**File:** `per-diem/index.html:537`

The `$69/day` rate is noted as "2024-2025 IRS DOT Rate." IRS rates change annually — consider adding a comment or configuration to make this easy to update, and add the effective date range clearly.

### 10d. IFTA tax rates need a maintenance strategy

**File:** `ifta-calculator/index.html:694-743`

48 state tax rates are hardcoded. These change quarterly. There's no indication of when they were last updated or where to get current rates.

**Recommendation:** Add a comment with the source and last-updated date. Consider loading rates from a JSON file to make updates easier.

### 10e. Header navigation is inconsistent

| Page | Logo links to | Shows "All Tools" | Shows header CTA |
|------|--------------|-------------------|------------------|
| index.html | `/` | N/A | Yes |
| fuel-converter | `balancebooksapp.com` | No | Yes |
| ifta-calculator | `/fuel-converter` | No | Yes |
| load-calculator | `/fuel-converter` | No | Yes |
| cost-per-mile | `/` | No | No |
| deadhead | `/` | No | No |
| per-diem | `/` | No | No |

**Recommendation:** All tool pages should have the logo linking to `/` (tools home) and show a consistent "Back to All Tools" link.

---

## Priority Summary — Status

| Priority | Issue | Status |
|----------|-------|--------|
| **P0** | IFTA `sendToBalanceBooks()` broken (wrong data attribute) | FIXED |
| **P0** | XSS via innerHTML in fuel converter | FIXED |
| **P1** | IFTA MPG uses running totals (wrong calculation) | FIXED |
| **P1** | Quarter selector ignored in export | FIXED |
| **P1** | PWA icons missing (install failures) | FIXED — 8 PNG sizes generated |
| **P1** | `js/integration.js` is dead code | FIXED — loaded by all 4 tools |
| **P2** | Inconsistent integration patterns | FIXED — all tools use localStorage + BB_INTEGRATION |
| **P2** | Accessibility gaps | FIXED — focus-visible, skip nav, sr-only |
| **P2** | .xls/.xlsx parsed as garbled text | FIXED — rejected with clear error |
| **P2** | Footer nav inconsistent | FIXED — all tools link to all others |
| **P2** | Header nav inconsistent (logo targets) | FIXED — all logos link to / |
| **P2** | Open Graph meta tags missing | FIXED — og:title/desc/url/type on all tools |
| **P2** | Fuel converter ignores ?provider= param | FIXED — auto-detects from SEO pages |
| **P3** | Service worker for offline | FIXED — sw.js with network-first strategy |
| **P3** | GitHub Actions CI/CD | FIXED — .github/workflows/deploy.yml |
| **P3** | netlify.toml dead CSS cache rule | FIXED — replaced with JS/HTML/SW rules |
| | | |
| **P3** | CSS duplication across tool pages | FIXED — shared.css extracted, inline CSS trimmed to page-specific overrides |
| **P3** | SEO structured data (Schema.org) | FIXED — JSON-LD WebApplication on all 6 tool pages + WebSite on index |
| **P3** | Shortcut icons (fuel-96.png etc.) | FIXED — fuel-96, ifta-96, load-96 generated |
| **P3** | 404.html page | FIXED — custom 404 with tool links, netlify.toml updated |
| **P3** | Per Diem / IFTA rate maintenance strategy | FIXED — data/rates.json with metadata + review dates |
