# BalanceBooks Trucking App - Integration Code

Copy and paste this code into your BalanceBooks Trucking app to receive data from the free tools.

---

## Quick Setup (3 Steps)

### Step 1: Add Import Hook

Create a new file or add to your existing hooks:

```jsx
// hooks/useToolsImport.js
import { useState, useEffect } from 'react';

export function useToolsImport() {
    const [importData, setImportData] = useState(null);
    const [showImportModal, setShowImportModal] = useState(false);

    useEffect(() => {
        // Check for import flag in URL
        const params = new URLSearchParams(window.location.search);
        if (params.get('import') === 'tools') {
            // Retrieve data from localStorage
            const stored = localStorage.getItem('bb_tools_export');
            if (stored) {
                try {
                    const data = JSON.parse(stored);
                    // Validate timestamp (reject if > 1 hour old)
                    const importTime = new Date(data.timestamp);
                    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
                    if (importTime > hourAgo) {
                        setImportData(data);
                        setShowImportModal(true);
                    }
                    localStorage.removeItem('bb_tools_export');
                } catch (e) {
                    console.error('Import parse error:', e);
                }
            }
            // Clean URL
            window.history.replaceState({}, '', window.location.pathname);
        }
    }, []);

    const confirmImport = (handler) => {
        if (importData && handler) handler(importData);
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

### Step 2: Add Import Modal Component

```jsx
// components/ToolsImportModal.jsx
import React from 'react';

export function ToolsImportModal({ data, onConfirm, onCancel }) {
    if (!data) return null;

    const getInfo = () => {
        switch (data.source) {
            case 'fuel-converter':
                return { icon: '⛽', title: 'Fuel Card Import', 
                    desc: `${data.data?.length || 0} transactions from ${data.provider}` };
            case 'ifta-calculator':
                return { icon: '📊', title: 'IFTA Data', 
                    desc: `${data.quarter} ${data.year} - ${data.states?.length} states` };
            case 'load-calculator':
                return { icon: '💰', title: 'Load Data', 
                    desc: `$${data.load?.lineHaul} - ${data.load?.loadedMiles} miles` };
            case 'cost-per-mile':
                return { icon: '🛣️', title: 'CPM Settings', 
                    desc: `$${data.settings?.calculated?.totalCPM?.toFixed(2)}/mi` };
            default:
                return { icon: '📤', title: 'Data Import', desc: 'From BalanceBooks Tools' };
        }
    };

    const info = getInfo();

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
                <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-6 text-white">
                    <div className="flex items-center gap-4">
                        <div className="text-4xl">{info.icon}</div>
                        <div>
                            <h2 className="text-xl font-bold">{info.title}</h2>
                            <p className="text-orange-100 text-sm">From BalanceBooks Tools</p>
                        </div>
                    </div>
                </div>
                <div className="p-6">
                    <p className="text-slate-600 mb-6">{info.desc}</p>
                    <div className="flex gap-3">
                        <button onClick={onCancel}
                            className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl font-medium">
                            Cancel
                        </button>
                        <button onClick={onConfirm}
                            className="flex-1 px-4 py-3 bg-orange-500 text-white rounded-xl font-semibold">
                            Import
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
```

### Step 3: Add to Your Main App Component

```jsx
// In your main TruckingApp.jsx
import { useToolsImport } from './hooks/useToolsImport';
import { ToolsImportModal } from './components/ToolsImportModal';

function TruckingApp() {
    const { importData, showImportModal, confirmImport, cancelImport } = useToolsImport();
    
    // Your existing state
    const [fuelLog, setFuelLog] = useState([]);
    const [loads, setLoads] = useState([]);
    
    // Handle the import based on source
    const handleImport = () => {
        if (!importData) return;
        
        switch (importData.source) {
            case 'fuel-converter':
                // Add fuel transactions
                const newFuel = importData.data.map(row => ({
                    id: Date.now() + Math.random(),
                    date: row.date,
                    location: row.location,
                    state: row.state,
                    gallons: row.gallons,
                    total: row.totalAmount,
                    pricePerGallon: row.pricePerGallon
                }));
                setFuelLog(prev => [...prev, ...newFuel]);
                alert(`Imported ${newFuel.length} fuel transactions!`);
                break;
                
            case 'load-calculator':
                // Add load
                setLoads(prev => [...prev, {
                    id: Date.now(),
                    ...importData.load,
                    status: 'quoted',
                    createdAt: new Date().toISOString()
                }]);
                alert('Load saved!');
                break;
                
            // Handle other sources...
        }
    };

    return (
        <div>
            {/* Your existing app UI */}
            
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

## Data Schemas

### Fuel Converter Payload
```javascript
{
    source: 'fuel-converter',
    version: '1.0',
    timestamp: '2025-01-26T12:00:00Z',
    provider: 'loves', // loves, pilot, comdata, efs, wex, fuelman, tcs, tapetro
    rowCount: 25,
    data: [
        {
            date: '2025-01-15',
            location: 'Loves #123',
            city: 'Dallas',
            state: 'TX',
            gallons: 150.5,
            pricePerGallon: 3.45,
            totalAmount: 519.23,
            fuelType: 'Diesel',
            odometer: '125000',
            truckStop: 'loves'
        }
    ],
    summary: {
        gallons: 1250.5,
        amount: 4312.75
    }
}
```

### IFTA Calculator Payload
```javascript
{
    source: 'ifta-calculator',
    version: '1.0',
    timestamp: '2025-01-26T12:00:00Z',
    quarter: 'Q1',
    year: 2025,
    states: [
        {
            state: 'TX',
            name: 'Texas',
            miles: 2500,
            gallons: 400,
            taxRate: 0.20,
            taxableGallons: 384.6,
            taxOwed: -3.08 // negative = refund
        }
    ],
    summary: {
        totalMiles: 15000,
        totalGallons: 2300,
        mpg: '6.52',
        totalTaxOwed: '125.50',
        statesWithActivity: 8
    }
}
```

### Load Calculator Payload
```javascript
{
    source: 'load-calculator',
    version: '1.0',
    timestamp: '2025-01-26T12:00:00Z',
    load: {
        lineHaul: 2500,
        fuelSurcharge: 150,
        loadedMiles: 800,
        deadheadMiles: 50,
        fuelPrice: 3.50,
        mpg: 6.5,
        costPerMile: 0.45,
        dispatchFee: 10,
        grossRevenue: 2650,
        netProfit: 1525,
        rpmGross: 3.12,
        rpmNet: 1.79,
        profitMargin: 57.5,
        verdict: 'Good Load!'
    }
}
```

### Cost Per Mile Payload
```javascript
{
    source: 'cost-per-mile',
    version: '1.0',
    timestamp: '2025-01-26T12:00:00Z',
    settings: {
        monthlyMiles: 10000,
        fixedCosts: {
            truckPayment: 1800,
            insurance: 1200,
            permits: 200,
            eld: 75,
            parking: 300
        },
        variableCosts: {
            fuel: 4500,
            maintenance: 500,
            tires: 300,
            def: 150,
            misc: 100
        },
        calculated: {
            fixedTotal: 3575,
            variableTotal: 5550,
            totalMonthly: 9125,
            totalCPM: 0.9125,
            fixedCPM: 0.3575,
            variableCPM: 0.555,
            breakEvenRate: 0.9125,
            recommendedRate20: 1.14,
            recommendedRate30: 1.30
        }
    }
}
```

---

## Quick Import Buttons

Add these buttons throughout your app to link to the free tools:

```jsx
const ToolButtons = {
    Fuel: () => (
        <button onClick={() => window.open('https://tools.balancebooksapp.com/fuel-converter', '_blank')}
            className="px-4 py-2 bg-slate-100 rounded-lg text-sm">
            📤 Import Fuel Card
        </button>
    ),
    IFTA: () => (
        <button onClick={() => window.open('https://tools.balancebooksapp.com/ifta-calculator', '_blank')}
            className="px-4 py-2 bg-slate-100 rounded-lg text-sm">
            📊 IFTA Calculator
        </button>
    ),
    Load: () => (
        <button onClick={() => window.open('https://tools.balancebooksapp.com/load-calculator', '_blank')}
            className="px-4 py-2 bg-slate-100 rounded-lg text-sm">
            💰 Calculate Load
        </button>
    ),
    CPM: () => (
        <button onClick={() => window.open('https://tools.balancebooksapp.com/cost-per-mile', '_blank')}
            className="px-4 py-2 bg-slate-100 rounded-lg text-sm">
            🛣️ Cost Per Mile
        </button>
    )
};
```

---

## Testing

1. Open any tool at tools.balancebooksapp.com
2. Fill in sample data
3. Click "Send to BalanceBooks" or "Import to App" button
4. Verify your app opens with the import modal
5. Confirm import and check data appears correctly
