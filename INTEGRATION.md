# BalanceBooks Tools ↔ Main App Integration Configuration

Complete integration guide for connecting the free tools suite with BalanceBooks for Trucking.

---

## 🔗 Integration Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     FREE TOOLS SUITE                             │
│              tools.balancebooksapp.com                          │
│                                                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │  Fuel    │ │  IFTA    │ │  Load    │ │  Cost    │           │
│  │Converter │ │Calculator│ │Calculator│ │ Per Mile │           │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘           │
│       │            │            │            │                   │
│       └────────────┴─────┬──────┴────────────┘                   │
│                          │                                       │
│                    [Export Data]                                 │
│                          │                                       │
└──────────────────────────┼───────────────────────────────────────┘
                           │
            ┌──────────────┴──────────────┐
            │   URL Parameters + Storage   │
            │   postMessage API            │
            └──────────────┬──────────────┘
                           │
┌──────────────────────────┼───────────────────────────────────────┐
│                          │                                       │
│              BALANCEBOOKS TRUCKING APP                          │
│              trucking.balancebooksapp.com                       │
│                          │                                       │
│  ┌──────────┐ ┌─────────▼────┐ ┌──────────┐ ┌──────────┐       │
│  │  Fuel    │ │   Import     │ │  IFTA    │ │   Load   │       │
│  │   Log    │ │   Handler    │ │ Reports  │ │  Tracker │       │
│  └──────────┘ └──────────────┘ └──────────┘ └──────────┘       │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 📤 Data Export from Tools

### 1. Fuel Card Converter → Fuel Log

Add this to `/fuel-converter/index.html` after the export buttons:

```html
<!-- Import to App Button -->
<button id="importToApp" class="btn btn-primary" onclick="sendToBalanceBooks()">
    🚀 Import to BalanceBooks
</button>

<script>
function sendToBalanceBooks() {
    // Get converted data
    const data = getConvertedData(); // Your existing function
    
    if (!data || data.length === 0) {
        alert('Please convert a file first');
        return;
    }
    
    // Prepare payload
    const payload = {
        source: 'fuel-converter',
        version: '1.0',
        timestamp: new Date().toISOString(),
        provider: detectedProvider, // e.g., 'loves', 'pilot'
        data: data.map(row => ({
            date: row.date,
            location: row.location,
            city: row.city,
            state: row.state,
            gallons: parseFloat(row.gallons),
            pricePerGallon: parseFloat(row.ppg),
            totalAmount: parseFloat(row.total),
            fuelType: row.fuelType || 'diesel',
            odometerStart: row.odometerStart || null,
            odometerEnd: row.odometerEnd || null,
            truckStop: row.truckStop || detectedProvider
        }))
    };
    
    // Store in localStorage for cross-domain transfer
    try {
        localStorage.setItem('bb_tools_export', JSON.stringify(payload));
    } catch (e) {
        console.warn('localStorage not available');
    }
    
    // Encode for URL (fallback)
    const encoded = btoa(JSON.stringify(payload));
    
    // Open app with import flag
    const appUrl = `https://trucking.balancebooksapp.com/fuel?import=tools&data=${encoded.substring(0, 2000)}`;
    
    // Try postMessage first (if app is already open)
    if (window.opener) {
        window.opener.postMessage({ type: 'BB_TOOLS_IMPORT', payload }, 'https://app.balancebooksapp.com');
        alert('Data sent to BalanceBooks!');
    } else {
        window.open(appUrl, '_blank');
    }
}
</script>
```

### 2. IFTA Calculator → IFTA Reports

Add to `/ifta-calculator/index.html`:

```html
<button id="exportToIFTA" class="btn btn-primary" onclick="sendIFTAToApp()">
    📊 Send to IFTA Report
</button>

<script>
function sendIFTAToApp() {
    const iftaData = getIFTAData(); // Your existing calculation
    
    const payload = {
        source: 'ifta-calculator',
        version: '1.0',
        timestamp: new Date().toISOString(),
        quarter: document.getElementById('quarter')?.value || 'Q1',
        year: document.getElementById('year')?.value || new Date().getFullYear(),
        states: iftaData.map(state => ({
            state: state.abbr,
            miles: state.miles,
            gallons: state.gallons,
            taxRate: state.taxRate,
            taxableGallons: state.taxableGallons,
            taxOwed: state.taxOwed
        })),
        summary: {
            totalMiles: iftaData.reduce((s, st) => s + st.miles, 0),
            totalGallons: iftaData.reduce((s, st) => s + st.gallons, 0),
            totalTaxOwed: iftaData.reduce((s, st) => s + st.taxOwed, 0),
            mpg: calculateMPG()
        }
    };
    
    localStorage.setItem('bb_tools_export', JSON.stringify(payload));
    window.open('https://trucking.balancebooksapp.com/ifta?import=tools', '_blank');
}
</script>
```

### 3. Load Calculator → Load Tracker

Add to `/load-calculator/index.html`:

```html
<button id="saveLoad" class="btn btn-primary" onclick="saveLoadToApp()">
    💾 Save to Load Tracker
</button>

<script>
function saveLoadToApp() {
    const loadData = {
        source: 'load-calculator',
        version: '1.0',
        timestamp: new Date().toISOString(),
        load: {
            lineHaul: parseFloat(document.getElementById('lineHaul').value),
            fuelSurcharge: parseFloat(document.getElementById('fuelSurcharge').value) || 0,
            loadedMiles: parseFloat(document.getElementById('loadedMiles').value),
            deadheadMiles: parseFloat(document.getElementById('deadheadMiles').value) || 0,
            dispatchFee: parseFloat(document.getElementById('dispatchFee').value) || 0,
            fuelCost: calculatedFuelCost,
            netProfit: calculatedNetProfit,
            rpmGross: calculatedRPMGross,
            rpmNet: calculatedRPMNet,
            profitMargin: calculatedMargin,
            verdict: getVerdict() // 'good', 'marginal', 'poor', 'losing'
        }
    };
    
    localStorage.setItem('bb_tools_export', JSON.stringify(loadData));
    window.open('https://trucking.balancebooksapp.com/loads?import=tools', '_blank');
}
</script>
```

### 4. Cost Per Mile → Settings/Dashboard

Add to `/cost-per-mile/index.html`:

```html
<button id="syncCPM" class="btn btn-primary" onclick="syncCPMToApp()">
    🔄 Sync to BalanceBooks
</button>

<script>
function syncCPMToApp() {
    const cpmData = {
        source: 'cost-per-mile',
        version: '1.0',
        timestamp: new Date().toISOString(),
        settings: {
            monthlyMiles: parseFloat(document.getElementById('monthlyMiles').value),
            fixedCosts: {
                truckPayment: parseFloat(getInputValue('truck-payment')),
                insurance: parseFloat(getInputValue('insurance')),
                permits: parseFloat(getInputValue('permits')),
                eld: parseFloat(getInputValue('eld')),
                parking: parseFloat(getInputValue('parking'))
            },
            variableCosts: {
                fuel: parseFloat(getInputValue('fuel')),
                maintenance: parseFloat(getInputValue('maintenance')),
                tires: parseFloat(getInputValue('tires')),
                def: parseFloat(getInputValue('def')),
                misc: parseFloat(getInputValue('misc'))
            },
            calculated: {
                totalCPM: calculatedTotalCPM,
                fixedCPM: calculatedFixedCPM,
                variableCPM: calculatedVariableCPM,
                breakEvenRate: calculatedBreakEven
            }
        }
    };
    
    localStorage.setItem('bb_tools_export', JSON.stringify(cpmData));
    window.open('https://trucking.balancebooksapp.com/settings?import=cpm', '_blank');
}
</script>
```

---

## 📥 Import Handler for Main App

Add this to your main BalanceBooks Trucking app (`App.jsx` or equivalent):

### Import Detection Hook

```jsx
// hooks/useToolsImport.js
import { useState, useEffect } from 'react';

export function useToolsImport() {
    const [importData, setImportData] = useState(null);
    const [showImportModal, setShowImportModal] = useState(false);

    useEffect(() => {
        // Check URL parameters
        const params = new URLSearchParams(window.location.search);
        const importFlag = params.get('import');
        
        if (importFlag === 'tools') {
            // Try localStorage first
            const stored = localStorage.getItem('bb_tools_export');
            if (stored) {
                try {
                    const data = JSON.parse(stored);
                    setImportData(data);
                    setShowImportModal(true);
                    // Clear after reading
                    localStorage.removeItem('bb_tools_export');
                } catch (e) {
                    console.error('Failed to parse import data', e);
                }
            }
            
            // Try URL data (fallback for large datasets)
            const urlData = params.get('data');
            if (urlData && !stored) {
                try {
                    const decoded = JSON.parse(atob(urlData));
                    setImportData(decoded);
                    setShowImportModal(true);
                } catch (e) {
                    console.error('Failed to decode URL data', e);
                }
            }
            
            // Clean URL
            window.history.replaceState({}, '', window.location.pathname);
        }

        // Listen for postMessage from tools
        const handleMessage = (event) => {
            if (event.origin !== 'https://tools.balancebooksapp.com') return;
            if (event.data?.type === 'BB_TOOLS_IMPORT') {
                setImportData(event.data.payload);
                setShowImportModal(true);
            }
        };
        
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    const confirmImport = (handler) => {
        if (importData && handler) {
            handler(importData);
        }
        setShowImportModal(false);
        setImportData(null);
    };

    const cancelImport = () => {
        setShowImportModal(false);
        setImportData(null);
    };

    return { importData, showImportModal, confirmImport, cancelImport };
}
```

### Import Modal Component

```jsx
// components/ToolsImportModal.jsx
import React from 'react';

export function ToolsImportModal({ data, onConfirm, onCancel }) {
    if (!data) return null;

    const getSourceInfo = () => {
        switch (data.source) {
            case 'fuel-converter':
                return {
                    icon: '⛽',
                    title: 'Fuel Card Import',
                    description: `${data.data?.length || 0} fuel transactions from ${data.provider || 'Unknown'}`,
                    action: 'Import to Fuel Log'
                };
            case 'ifta-calculator':
                return {
                    icon: '📊',
                    title: 'IFTA Data Import',
                    description: `${data.quarter} ${data.year} - ${data.states?.length || 0} states`,
                    action: 'Import to IFTA Report'
                };
            case 'load-calculator':
                return {
                    icon: '💰',
                    title: 'Load Data Import',
                    description: `Load: $${data.load?.lineHaul || 0} line haul, ${data.load?.loadedMiles || 0} miles`,
                    action: 'Save to Load Tracker'
                };
            case 'cost-per-mile':
                return {
                    icon: '🛣️',
                    title: 'Cost Per Mile Settings',
                    description: `CPM: $${data.settings?.calculated?.totalCPM?.toFixed(2) || '0.00'}/mi`,
                    action: 'Update Settings'
                };
            default:
                return {
                    icon: '📤',
                    title: 'Data Import',
                    description: 'Import data from BalanceBooks Tools',
                    action: 'Import'
                };
        }
    };

    const info = getSourceInfo();

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-6 text-white">
                    <div className="flex items-center gap-4">
                        <div className="text-4xl">{info.icon}</div>
                        <div>
                            <h2 className="text-xl font-bold">{info.title}</h2>
                            <p className="text-orange-100 text-sm">From BalanceBooks Tools</p>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6">
                    <div className="bg-slate-50 rounded-xl p-4 mb-4">
                        <p className="text-slate-700">{info.description}</p>
                        <p className="text-xs text-slate-400 mt-2">
                            Imported: {new Date(data.timestamp).toLocaleString()}
                        </p>
                    </div>

                    {/* Preview for fuel data */}
                    {data.source === 'fuel-converter' && data.data?.length > 0 && (
                        <div className="mb-4">
                            <p className="text-sm font-medium text-slate-600 mb-2">Preview:</p>
                            <div className="max-h-32 overflow-y-auto text-sm">
                                {data.data.slice(0, 3).map((row, i) => (
                                    <div key={i} className="flex justify-between py-1 border-b border-slate-100">
                                        <span>{row.date} - {row.location}</span>
                                        <span className="font-mono">{row.gallons} gal</span>
                                    </div>
                                ))}
                                {data.data.length > 3 && (
                                    <p className="text-slate-400 text-xs mt-1">
                                        +{data.data.length - 3} more transactions
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3">
                        <button
                            onClick={onCancel}
                            className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={onConfirm}
                            className="flex-1 px-4 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl"
                        >
                            {info.action}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
```

### Integration in Main App Component

```jsx
// In your main App.jsx or trucking dashboard
import { useToolsImport } from './hooks/useToolsImport';
import { ToolsImportModal } from './components/ToolsImportModal';

function TruckingApp() {
    const { importData, showImportModal, confirmImport, cancelImport } = useToolsImport();
    
    // Existing state
    const [fuelLog, setFuelLog] = useState([]);
    const [loads, setLoads] = useState([]);
    const [settings, setSettings] = useState({});

    // Import handlers by source
    const handleImport = () => {
        if (!importData) return;

        switch (importData.source) {
            case 'fuel-converter':
                // Add fuel transactions
                const newFuelEntries = importData.data.map(row => ({
                    id: generateId(),
                    ...row,
                    importedFrom: 'tools',
                    importedAt: new Date().toISOString()
                }));
                setFuelLog(prev => [...prev, ...newFuelEntries]);
                showToast(`Imported ${newFuelEntries.length} fuel transactions!`);
                break;

            case 'ifta-calculator':
                // Navigate to IFTA section with pre-filled data
                setIFTADraft(importData);
                navigate('/trucking/ifta/new');
                break;

            case 'load-calculator':
                // Add load to tracker
                const newLoad = {
                    id: generateId(),
                    ...importData.load,
                    status: 'quoted',
                    importedFrom: 'tools',
                    importedAt: new Date().toISOString()
                };
                setLoads(prev => [...prev, newLoad]);
                showToast('Load saved to tracker!');
                break;

            case 'cost-per-mile':
                // Update settings
                setSettings(prev => ({
                    ...prev,
                    costPerMile: importData.settings.calculated.totalCPM,
                    monthlyMiles: importData.settings.monthlyMiles,
                    expenses: {
                        fixed: importData.settings.fixedCosts,
                        variable: importData.settings.variableCosts
                    }
                }));
                showToast('Cost per mile settings updated!');
                break;
        }
    };

    return (
        <div>
            {/* Your existing app UI */}
            
            {/* Import Modal */}
            {showImportModal && (
                <ToolsImportModal
                    data={importData}
                    onConfirm={() => confirmImport(handleImport)}
                    onCancel={cancelImport}
                />
            )}
        </div>
    );
}
```

---

## 🔘 Quick Import Buttons for App UI

Add these buttons throughout your trucking app:

```jsx
// components/ToolsButtons.jsx

export function ImportFromToolsButton({ tool, label }) {
    const toolUrls = {
        'fuel': 'https://tools.balancebooksapp.com/fuel-converter',
        'ifta': 'https://tools.balancebooksapp.com/ifta-calculator',
        'load': 'https://tools.balancebooksapp.com/load-calculator',
        'cpm': 'https://tools.balancebooksapp.com/cost-per-mile',
        'deadhead': 'https://tools.balancebooksapp.com/deadhead-calculator',
        'perdiem': 'https://tools.balancebooksapp.com/per-diem'
    };

    return (
        <button
            onClick={() => window.open(toolUrls[tool], '_blank')}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 text-sm"
        >
            📤 {label || 'Import from Tools'}
        </button>
    );
}

// Usage examples:
// <ImportFromToolsButton tool="fuel" label="Import Fuel Card" />
// <ImportFromToolsButton tool="ifta" label="Use IFTA Calculator" />
// <ImportFromToolsButton tool="load" label="Calculate Load Profit" />
```

---

## 🎨 UI Integration Points

### Fuel Log Section
```jsx
<div className="flex items-center justify-between mb-4">
    <h2>Fuel Log</h2>
    <div className="flex gap-2">
        <ImportFromToolsButton tool="fuel" label="Import Fuel Card" />
        <button onClick={addManualEntry}>+ Add Entry</button>
    </div>
</div>
```

### IFTA Reports Section
```jsx
<div className="flex items-center justify-between mb-4">
    <h2>IFTA Reports</h2>
    <ImportFromToolsButton tool="ifta" label="Use Calculator" />
</div>
```

### Load Tracker Section
```jsx
<div className="flex items-center justify-between mb-4">
    <h2>Loads</h2>
    <ImportFromToolsButton tool="load" label="Calculate Profit" />
</div>
```

### Settings/Dashboard
```jsx
<div className="card">
    <h3>Operating Costs</h3>
    <p>Current CPM: ${settings.costPerMile?.toFixed(2) || '0.00'}/mi</p>
    <ImportFromToolsButton tool="cpm" label="Update from Calculator" />
</div>
```

---

## 🔒 Security Considerations

```javascript
// Validate import data
function validateImportData(data) {
    // Check source
    const validSources = ['fuel-converter', 'ifta-calculator', 'load-calculator', 'cost-per-mile'];
    if (!validSources.includes(data.source)) {
        throw new Error('Invalid import source');
    }

    // Check timestamp (reject data older than 1 hour)
    const importTime = new Date(data.timestamp);
    const now = new Date();
    const hourAgo = new Date(now - 60 * 60 * 1000);
    if (importTime < hourAgo) {
        throw new Error('Import data expired');
    }

    // Validate data structure based on source
    switch (data.source) {
        case 'fuel-converter':
            if (!Array.isArray(data.data)) throw new Error('Invalid fuel data');
            data.data.forEach(row => {
                if (typeof row.gallons !== 'number') throw new Error('Invalid gallons');
                if (typeof row.totalAmount !== 'number') throw new Error('Invalid amount');
            });
            break;
        // Add validation for other sources...
    }

    return true;
}
```

---

## 📊 Analytics Events

Track tool-to-app conversion:

```javascript
// In tools (on export)
gtag('event', 'tools_export', {
    'tool': 'fuel-converter',
    'provider': 'loves',
    'rows': data.length,
    'destination': 'main_app'
});

// In main app (on import)
gtag('event', 'tools_import', {
    'source': importData.source,
    'items': importData.data?.length || 1,
    'success': true
});
```

---

## 🧪 Testing Checklist

- [ ] Fuel converter → Fuel log import
- [ ] IFTA calculator → IFTA reports import
- [ ] Load calculator → Load tracker import  
- [ ] Cost per mile → Settings update
- [ ] LocalStorage transfer works
- [ ] URL parameter fallback works
- [ ] postMessage works (same tab scenario)
- [ ] Import modal displays correctly
- [ ] Data validation rejects invalid imports
- [ ] Analytics events fire correctly

---

## 📱 Mobile Deep Linking (Optional)

For mobile app integration:

```javascript
// Check if native app is installed
function openInApp(path, data) {
    const appScheme = 'balancebooks://';
    const webUrl = `https://app.balancebooksapp.com${path}`;
    
    // Try app scheme first
    const appUrl = `${appScheme}trucking${path}?import=tools`;
    
    // Store data for retrieval
    localStorage.setItem('bb_tools_export', JSON.stringify(data));
    
    // Try to open app, fall back to web
    const start = Date.now();
    window.location.href = appUrl;
    
    setTimeout(() => {
        if (Date.now() - start < 2000) {
            window.location.href = webUrl;
        }
    }, 1500);
}
```
