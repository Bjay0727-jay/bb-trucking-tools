/**
 * BalanceBooks Tools Integration Utilities
 * Shared functions for sending data to BalanceBooks Trucking app
 * Version: 1.0
 */

const BB_INTEGRATION = {
    // App URLs
    TRUCKING_APP: 'https://trucking.balancebooksapp.com',
    PERSONAL_APP: 'https://app.balancebooksapp.com',
    
    // Storage key for cross-domain transfer
    STORAGE_KEY: 'bb_tools_export',
    
    /**
     * Send data to BalanceBooks Trucking app
     * @param {Object} payload - Data to send
     * @param {string} payload.source - Tool name (fuel-converter, ifta-calculator, etc.)
     * @param {string} route - App route to open (fuel, ifta, loads, settings)
     * @param {boolean} silent - If true, don't show confirmation dialog
     */
    sendToApp: function(payload, route = '', silent = false) {
        // Add metadata
        payload.version = payload.version || '1.0';
        payload.timestamp = new Date().toISOString();
        
        try {
            // Store data for retrieval by app
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(payload));
            
            // Build app URL
            const url = route 
                ? `${this.TRUCKING_APP}/${route}?import=tools`
                : `${this.TRUCKING_APP}?import=tools`;
            
            if (silent) {
                this._openWithFallback(url);
                return true;
            }

            // Show confirmation with summary
            const summary = this.getSummary(payload);
            if (confirm(`${summary}\n\nClick OK to open BalanceBooks Trucking.`)) {
                this._openWithFallback(url);
                return true;
            }
            return false;
        } catch (e) {
            console.error('BB Integration Error:', e);
            alert('Could not prepare data for transfer. Please try the CSV/PDF export instead.');
            return false;
        }
    },
    
    /**
     * Generate human-readable summary of payload
     */
    getSummary: function(payload) {
        const source = payload.source || 'unknown';
        
        switch (source) {
            case 'fuel-converter':
                return `Ready to import ${payload.data?.length || 0} fuel transactions:\n\n` +
                    `• Provider: ${payload.provider || 'Unknown'}\n` +
                    `• Total Gallons: ${payload.summary?.gallons?.toFixed(1) || 0}\n` +
                    `• Total Amount: $${payload.summary?.amount?.toFixed(2) || 0}`;
                    
            case 'ifta-calculator':
                return `Ready to import IFTA data:\n\n` +
                    `• Quarter: ${payload.quarter} ${payload.year}\n` +
                    `• States: ${payload.states?.length || 0}\n` +
                    `• Total Miles: ${payload.summary?.totalMiles?.toLocaleString() || 0}\n` +
                    `• Net Tax: $${payload.summary?.totalTaxOwed || 0}`;
                    
            case 'load-calculator':
                return `Save this load to BalanceBooks?\n\n` +
                    `• Line Haul: $${payload.load?.lineHaul?.toLocaleString() || 0}\n` +
                    `• Total Miles: ${(payload.load?.loadedMiles || 0) + (payload.load?.deadheadMiles || 0)}\n` +
                    `• Verdict: ${payload.load?.verdict || 'Unknown'}`;
                    
            case 'cost-per-mile':
                const cpm = payload.settings?.calculated?.totalCPM || 0;
                return `Sync cost-per-mile settings?\n\n` +
                    `• Total CPM: $${cpm.toFixed(2)}/mi\n` +
                    `• Monthly Costs: $${payload.settings?.calculated?.totalMonthly?.toLocaleString() || 0}\n` +
                    `• Recommended Rate: $${(cpm / 0.80).toFixed(2)}/mi`;
                    
            default:
                return `Ready to send data to BalanceBooks.`;
        }
    },
    
    /**
     * Check if there's pending import data
     */
    hasPendingImport: function() {
        try {
            return !!localStorage.getItem(this.STORAGE_KEY);
        } catch {
            return false;
        }
    },
    
    /**
     * Clear pending import data
     */
    clearPendingImport: function() {
        try {
            localStorage.removeItem(this.STORAGE_KEY);
        } catch {}
    },
    
    /**
     * Get pending import data (for use in the main app)
     */
    getPendingImport: function() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            return data ? JSON.parse(data) : null;
        } catch {
            return null;
        }
    },

    /**
     * Open URL with popup-block fallback
     */
    _openWithFallback: function(url) {
        const win = window.open(url, '_blank');
        if (!win || win.closed) {
            // Popup was blocked — fall back to navigation
            if (confirm('Popup blocked by your browser.\n\nClick OK to navigate to BalanceBooks in this tab.')) {
                window.location.href = url;
            }
        }
    }
};

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BB_INTEGRATION;
}
