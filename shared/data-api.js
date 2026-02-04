// Shared Data API for robot/bot indexing
// This file handles data ingestion from external sources for all websites

class ForexBrokerDataAPI {
    constructor(config = {}) {
        this.apiEndpoint = config.apiEndpoint || '/api/brokers';
        this.updateEndpoint = config.updateEndpoint || '/api/update';
        this.wsEndpoint = config.wsEndpoint || '/ws/brokers';
        // Network mode:
        // - "off": do not attempt any network calls (static site default)
        // - "auto": enable network only if endpoints exist
        // - "on": always attempt network calls
        this.networkMode = config.networkMode || 'off';
        this.pollIntervalMs = Number.isFinite(config.pollIntervalMs) ? config.pollIntervalMs : 30000;
        this.data = {
            brokers: [],
            stats: {},
            updates: [],
            lastSync: null
        };
        this.callbacks = {
            onBrokerUpdate: [],
            onNewBroker: [],
            onStatsUpdate: [],
            onBulkUpdate: []
        };
        this.init();
    }

    init() {
        // Load initial data from localStorage if available
        this.loadFromStorage();

        if (this.networkMode === 'off') {
            return;
        }

        if (this.networkMode === 'on') {
            this.setupDataListener();
            this.loadData();
            return;
        }

        // Auto mode: only enable listeners if endpoint responds.
        this.checkApiAvailability().then((available) => {
            if (!available) return;
            this.setupDataListener();
            this.loadData();
        });
    }

    async checkApiAvailability() {
        try {
            // Prefer HEAD to avoid downloading payloads. Some servers disallow HEAD; fall back to GET.
            const head = await fetch(this.apiEndpoint, { method: 'HEAD' });
            if (head.ok) return true;
            if (head.status !== 405 && head.status !== 404) return false;
        } catch (e) {
            // ignore and try GET
        }

        try {
            const res = await fetch(this.apiEndpoint, { method: 'GET' });
            return res.ok;
        } catch (e) {
            return false;
        }
    }

    // Setup listener for incoming data
    setupDataListener() {
        // WebSocket for real-time updates
        if (typeof WebSocket !== 'undefined') {
            this.setupWebSocket();
        }

        // Server-Sent Events fallback
        if (typeof EventSource !== 'undefined') {
            this.setupSSE();
        }

        // Polling fallback
        this.setupPolling();
    }

    setupWebSocket() {
        try {
            const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${wsProtocol}//${window.location.host}${this.wsEndpoint}`;
            
            const ws = new WebSocket(wsUrl);
            
            ws.onopen = () => {
                console.log('WebSocket connected for broker data updates');
            };
            
            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleIncomingData(data);
                } catch (e) {
                    console.error('Error parsing WebSocket message:', e);
                }
            };
            
            ws.onerror = () => {
                console.log('WebSocket connection failed, using polling');
            };
            
            ws.onclose = () => {
                // Reconnect after 5 seconds
                setTimeout(() => this.setupWebSocket(), 5000);
            };
            
            this.ws = ws;
        } catch (e) {
            console.log('WebSocket not available');
        }
    }

    setupSSE() {
        try {
            const eventSource = new EventSource(`${this.apiEndpoint}/events`);
            
            eventSource.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleIncomingData(data);
                } catch (e) {
                    console.error('Error parsing SSE message:', e);
                }
            };
            
            eventSource.onerror = () => {
                eventSource.close();
            };
            
            this.sse = eventSource;
        } catch (e) {
            console.log('SSE not available');
        }
    }

    setupPolling() {
        // Poll for updates
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
        }
        this.pollTimer = setInterval(() => {
            this.checkForUpdates();
        }, this.pollIntervalMs);
    }

    // Handle incoming data from robot/bot
    handleIncomingData(data) {
        try {
            switch (data.type) {
                case 'broker_update':
                    this.updateBroker(data.payload);
                    break;
                case 'new_broker':
                    this.addBroker(data.payload);
                    break;
                case 'stats_update':
                    this.updateStats(data.payload);
                    break;
                case 'bulk_update':
                    this.bulkUpdate(data.payload);
                    break;
                case 'delete_broker':
                    this.deleteBroker(data.payload);
                    break;
                default:
                    console.log('Unknown data type:', data.type);
            }
            
            this.data.lastSync = new Date().toISOString();
            this.saveToStorage();
            this.triggerCallbacks(data.type, data.payload);
        } catch (error) {
            console.error('Error handling incoming data:', error);
        }
    }

    // Receive POST data from robot/bot
    async receiveData(data) {
        try {
            const response = await fetch(this.updateEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': data.apiKey || '', // Optional API key
                },
                body: JSON.stringify({
                    type: data.type || 'broker_update',
                    payload: data.payload || data,
                    timestamp: new Date().toISOString(),
                    source: 'robot'
                })
            });
            
            if (response.ok) {
                const result = await response.json();
                this.handleIncomingData(result);
                return { success: true, message: 'Data received successfully', data: result };
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        } catch (error) {
            console.error('Error receiving data:', error);
            // Fallback: handle data locally even if API fails
            this.handleIncomingData({
                type: data.type || 'broker_update',
                payload: data.payload || data
            });
            return { success: false, message: error.message, handledLocally: true };
        }
    }

    // Update broker information
    updateBroker(brokerData) {
        const identifier = brokerData.id || brokerData.name;
        const index = this.data.brokers.findIndex(b => 
            b.id === identifier || b.name === identifier
        );
        
        const updateData = {
            ...brokerData,
            updatedAt: new Date().toISOString()
        };
        
        if (index !== -1) {
            // Update existing broker
            this.data.brokers[index] = { 
                ...this.data.brokers[index], 
                ...updateData 
            };
        } else {
            // Add as new broker
            this.addBroker(updateData);
            return;
        }
        
        // Log update
        this.logUpdate({
            broker: brokerData.name || brokerData.id,
            type: 'update',
            data: brokerData,
            timestamp: new Date().toISOString()
        });
    }

    // Add new broker
    addBroker(brokerData) {
        const newBroker = {
            id: brokerData.id || `broker_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: brokerData.name,
            rating: brokerData.rating || 0,
            minDeposit: brokerData.minDeposit || 0,
            spreads: brokerData.spreads || {},
            platforms: brokerData.platforms || [],
            regulation: brokerData.regulation || [],
            leverage: brokerData.leverage || '1:100',
            commission: brokerData.commission || 0,
            currency: brokerData.currency || 'USD',
            createdAt: brokerData.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            ...brokerData
        };
        
        this.data.brokers.push(newBroker);
        
        // Log update
        this.logUpdate({
            broker: newBroker.name,
            type: 'new',
            data: newBroker,
            timestamp: new Date().toISOString()
        });
    }

    // Delete broker
    deleteBroker(identifier) {
        const index = this.data.brokers.findIndex(b => 
            b.id === identifier || b.name === identifier
        );
        
        if (index !== -1) {
            const deleted = this.data.brokers.splice(index, 1)[0];
            this.logUpdate({
                broker: deleted.name,
                type: 'delete',
                data: { id: deleted.id },
                timestamp: new Date().toISOString()
            });
        }
    }

    // Bulk update multiple brokers
    bulkUpdate(brokersArray) {
        brokersArray.forEach(broker => {
            this.updateBroker(broker);
        });
    }

    // Update statistics
    updateStats(stats) {
        this.data.stats = { 
            ...this.data.stats, 
            ...stats,
            updatedAt: new Date().toISOString()
        };
    }

    // Load data from API
    async loadData() {
        try {
            const response = await fetch(this.apiEndpoint);
            if (response.ok) {
                const data = await response.json();
                this.data.brokers = data.brokers || this.data.brokers;
                this.data.stats = data.stats || this.data.stats;
                this.saveToStorage();
                return data;
            }
        } catch (error) {
            console.error('Error loading data:', error);
            // Use cached data if API fails
            this.loadFromStorage();
        }
    }

    // Check for updates
    async checkForUpdates() {
        try {
            const lastUpdate = this.data.lastSync || new Date(0).toISOString();
            const response = await fetch(`${this.apiEndpoint}?since=${lastUpdate}`);
            
            if (response.ok) {
                const data = await response.json();
                if (data.updates && data.updates.length > 0) {
                    data.updates.forEach(update => {
                        this.handleIncomingData(update);
                    });
                }
            }
        } catch (error) {
            console.error('Error checking for updates:', error);
        }
    }

    // Log update
    logUpdate(update) {
        this.data.updates.unshift(update);
        // Keep only last 100 updates
        if (this.data.updates.length > 100) {
            this.data.updates = this.data.updates.slice(0, 100);
        }
    }

    // Save to localStorage
    saveToStorage() {
        try {
            localStorage.setItem('forexBrokerData', JSON.stringify(this.data));
        } catch (e) {
            console.error('Error saving to storage:', e);
        }
    }

    // Load from localStorage
    loadFromStorage() {
        try {
            const stored = localStorage.getItem('forexBrokerData');
            if (stored) {
                const parsed = JSON.parse(stored);
                this.data = { ...this.data, ...parsed };
            }
        } catch (e) {
            console.error('Error loading from storage:', e);
        }
    }

    // Register callback
    on(event, callback) {
        if (this.callbacks[event]) {
            this.callbacks[event].push(callback);
        }
    }

    // Trigger callbacks
    triggerCallbacks(eventType, payload) {
        const callbackMap = {
            'broker_update': 'onBrokerUpdate',
            'new_broker': 'onNewBroker',
            'stats_update': 'onStatsUpdate',
            'bulk_update': 'onBulkUpdate'
        };
        
        const callbackKey = callbackMap[eventType];
        if (callbackKey && this.callbacks[callbackKey]) {
            this.callbacks[callbackKey].forEach(cb => {
                try {
                    cb(payload);
                } catch (e) {
                    console.error('Error in callback:', e);
                }
            });
        }
    }

    // Get all brokers
    getBrokers() {
        return this.data.brokers;
    }

    // Get broker by ID or name
    getBroker(identifier) {
        return this.data.brokers.find(b => 
            b.id === identifier || b.name === identifier
        );
    }

    // Get stats
    getStats() {
        return this.data.stats;
    }

    // Get updates
    getUpdates(limit = 10) {
        return this.data.updates.slice(0, limit);
    }

    // Export data
    exportData() {
        return JSON.stringify(this.data, null, 2);
    }

    // Clear all data
    clearData() {
        this.data = {
            brokers: [],
            stats: {},
            updates: [],
            lastSync: null
        };
        localStorage.removeItem('forexBrokerData');
    }
}

// Initialize and expose globally
let forexBrokerAPI;

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAPI);
} else {
    initAPI();
}

function initAPI() {
    forexBrokerAPI = new ForexBrokerDataAPI({
        apiEndpoint: window.BROKER_API_ENDPOINT || '/api/brokers',
        updateEndpoint: window.BROKER_UPDATE_ENDPOINT || '/api/update',
        wsEndpoint: window.BROKER_WS_ENDPOINT || '/ws/brokers',
        networkMode: window.BROKER_NETWORK_MODE || (window.ENABLE_BROKER_DATA_API ? 'auto' : 'off'),
        pollIntervalMs: window.BROKER_POLL_INTERVAL_MS || 30000
    });
    
    // Expose globally for external access
    window.ForexBrokerDataAPI = ForexBrokerDataAPI;
    window.brokerAPI = forexBrokerAPI;
    
    // Expose receive function for robot/bot
    window.receiveBrokerData = function(data) {
        return forexBrokerAPI.receiveData(data);
    };
    
    // Expose for direct POST endpoint (if using form submission)
    window.submitBrokerData = function(formData) {
        let data = {};
        if (formData instanceof FormData) {
            formData.forEach((value, key) => {
                data[key] = value;
            });
        } else {
            data = formData;
        }
        return forexBrokerAPI.receiveData(data);
    };
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ForexBrokerDataAPI;
}


