/**
 * BalanceBooks Tools Integration Utilities
 * Cross-origin data transfer via postMessage (with URL hash fallback)
 * Version: 2.0
 */

const BB_INTEGRATION = {
    // App URLs
    TRUCKING_APP: 'https://trucking.balancebooksapp.com',
    TOOLS_ORIGIN: 'https://tools.balancebooksapp.com',

    /**
     * Send data to BalanceBooks Trucking app via postMessage.
     * Falls back to URL hash encoding when popup is blocked.
     *
     * @param {Object} payload - Data to send (must include payload.source)
     * @param {string} route - App route to open (fuel, ifta, loads, settings, expenses)
     * @param {boolean} silent - If true, skip confirmation dialog
     * @returns {boolean} true if the user confirmed / send initiated
     */
    sendToApp: function(payload, route, silent) {
        payload.version = payload.version || '2.0';
        payload.timestamp = new Date().toISOString();

        var url = route
            ? this.TRUCKING_APP + '/' + route + '?import=tools'
            : this.TRUCKING_APP + '?import=tools';

        // Confirmation dialog
        if (!silent) {
            var summary = this.getSummary(payload);
            if (!confirm(summary + '\n\nClick OK to open BalanceBooks Trucking.')) {
                return false;
            }
        }

        // Try opening a popup
        try {
            var win = window.open(url, '_blank');
            if (win && !win.closed) {
                this._sendViaPostMessage(win, payload);
                return true;
            }
        } catch (e) { /* popup blocked */ }

        // Popup blocked — encode payload in URL hash and navigate in-tab
        var encoded = encodeURIComponent(JSON.stringify(payload));
        if (confirm('Popup blocked by your browser.\n\nClick OK to navigate to BalanceBooks in this tab.')) {
            window.location.href = url + '#bbdata=' + encoded;
        }
        return false;
    },

    /**
     * Post payload to an already-opened window, retrying until acknowledged.
     * @private
     */
    _sendViaPostMessage: function(win, payload) {
        var origin = this.TRUCKING_APP;
        var message = { type: 'bb-tools-import', payload: payload };
        var attempts = 0;

        // Retry every 500 ms until the target app acknowledges (max 30 s)
        var interval = setInterval(function() {
            attempts++;
            try { win.postMessage(message, origin); } catch (e) { /* cross-origin before load */ }
            if (attempts >= 60) clearInterval(interval);
        }, 500);

        // Stop retrying once the trucking app acknowledges
        function onAck(event) {
            if (event.origin === origin && event.data && event.data.type === 'bb-tools-ack') {
                clearInterval(interval);
                window.removeEventListener('message', onAck);
            }
        }
        window.addEventListener('message', onAck);
    },

    // ── Summary helpers (unchanged) ──────────────────────────────────

    /**
     * Generate human-readable summary of payload
     */
    getSummary: function(payload) {
        var source = payload.source || 'unknown';

        switch (source) {
            case 'fuel-converter':
                return 'Ready to import ' + (payload.data ? payload.data.length : 0) + ' fuel transactions:\n\n' +
                    '\u2022 Provider: ' + (payload.provider || 'Unknown') + '\n' +
                    '\u2022 Total Gallons: ' + ((payload.summary && payload.summary.gallons) ? payload.summary.gallons.toFixed(1) : 0) + '\n' +
                    '\u2022 Total Amount: $' + ((payload.summary && payload.summary.amount) ? payload.summary.amount.toFixed(2) : 0);

            case 'ifta-calculator':
                return 'Ready to import IFTA data:\n\n' +
                    '\u2022 Quarter: ' + (payload.quarter || '') + ' ' + (payload.year || '') + '\n' +
                    '\u2022 States: ' + (payload.states ? payload.states.length : 0) + '\n' +
                    '\u2022 Total Miles: ' + ((payload.summary && payload.summary.totalMiles) ? payload.summary.totalMiles.toLocaleString() : 0) + '\n' +
                    '\u2022 Net Tax: $' + ((payload.summary && payload.summary.totalTaxOwed) || 0);

            case 'load-calculator':
                return 'Save this load to BalanceBooks?\n\n' +
                    '\u2022 Line Haul: $' + ((payload.load && payload.load.lineHaul) ? payload.load.lineHaul.toLocaleString() : 0) + '\n' +
                    '\u2022 Total Miles: ' + (((payload.load && payload.load.loadedMiles) || 0) + ((payload.load && payload.load.deadheadMiles) || 0)) + '\n' +
                    '\u2022 Verdict: ' + ((payload.load && payload.load.verdict) || 'Unknown');

            case 'cost-per-mile':
                var cpm = (payload.settings && payload.settings.calculated && payload.settings.calculated.totalCPM) || 0;
                return 'Sync cost-per-mile settings?\n\n' +
                    '\u2022 Total CPM: $' + cpm.toFixed(2) + '/mi\n' +
                    '\u2022 Monthly Costs: $' + ((payload.settings && payload.settings.calculated && payload.settings.calculated.totalMonthly) ? payload.settings.calculated.totalMonthly.toLocaleString() : 0) + '\n' +
                    '\u2022 Recommended Rate: $' + (cpm / 0.80).toFixed(2) + '/mi';

            case 'per-diem':
                return 'Send per diem data to BalanceBooks?\n\n' +
                    '\u2022 Days: ' + ((payload.perDiem && payload.perDiem.fullDays) || 0) + ' full + ' + ((payload.perDiem && payload.perDiem.partialDays) || 0) + ' partial\n' +
                    '\u2022 Total Deduction: $' + ((payload.perDiem && payload.perDiem.totalDeduction) ? payload.perDiem.totalDeduction.toLocaleString() : 0) + '\n' +
                    '\u2022 Tax Savings: $' + ((payload.perDiem && payload.perDiem.savings && payload.perDiem.savings.total) ? payload.perDiem.savings.total.toLocaleString(undefined, {maximumFractionDigits: 0}) : 0);

            case 'deadhead-calculator':
                return 'Send deadhead data to BalanceBooks?\n\n' +
                    '\u2022 Empty Miles: ' + ((payload.deadhead && payload.deadhead.miles) || 0) + '\n' +
                    '\u2022 Total Cost: $' + ((payload.deadhead && payload.deadhead.costs && payload.deadhead.costs.total) ? payload.deadhead.costs.total.toFixed(2) : 0) + '\n' +
                    '\u2022 Min Load Rate: $' + ((payload.deadhead && payload.deadhead.minLoadRate) ? payload.deadhead.minLoadRate.toFixed(2) : 0);

            default:
                return 'Ready to send data to BalanceBooks.';
        }
    },

    // ── Receiver API (for use in the trucking app) ───────────────────

    /**
     * Call in the trucking app to listen for incoming tool data.
     * Handles both postMessage (popup) and URL-hash (same-tab fallback).
     *
     * Usage:
     *   BB_INTEGRATION.listenForImport(function(payload) {
     *       console.log(payload.source, payload);
     *   });
     *
     * @param {Function} callback - receives the parsed payload object
     */
    listenForImport: function(callback) {
        var toolsOrigin = this.TOOLS_ORIGIN;

        // Method 1: postMessage from the tools site
        window.addEventListener('message', function(event) {
            if (event.origin !== toolsOrigin) return;
            if (!event.data || event.data.type !== 'bb-tools-import') return;

            // Acknowledge so the sender stops retrying
            if (event.source) {
                event.source.postMessage({ type: 'bb-tools-ack' }, event.origin);
            }
            callback(event.data.payload);
        });

        // Method 2: URL hash fallback (same-tab navigation when popup blocked)
        if (window.location.hash.indexOf('#bbdata=') === 0) {
            try {
                var encoded = window.location.hash.slice('#bbdata='.length);
                var payload = JSON.parse(decodeURIComponent(encoded));
                // Clean the hash from the URL bar
                history.replaceState(null, '', window.location.pathname + window.location.search);
                callback(payload);
            } catch (e) {
                console.error('BB Import: Failed to parse hash data', e);
            }
        }
    }
};

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BB_INTEGRATION;
}
