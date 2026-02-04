// Data API for robot/bot indexing
// This file handles data ingestion from external sources

class BrokerDataAPI {
    constructor() {
        this.apiEndpoint = '/api/brokers'; // Update this to your actual API endpoint
        this.updateEndpoint = '/api/update'; // Endpoint for receiving updates
        this.data = {
            brokers: [],
            stats: {},
            updates: []
        };
        this.init();
    }

    init() {
        // Listen for incoming data updates
        this.setupDataListener();
        // Load initial data
        this.loadData();
    }

    // Setup listener for incoming data (can be used with WebSocket, Server-Sent Events, or polling)
    setupDataListener() {
        // Option 1: WebSocket connection for real-time updates
        if (typeof WebSocket !== 'undefined') {
            this.setupWebSocket();
        }

        // Option 2: Server-Sent Events
        this.setupSSE();

        // Option 3: Polling fallback
        this.setupPolling();
    }

    setupWebSocket() {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${wsProtocol}//${window.location.host}/ws/brokers`;
        
        try {
            const ws = new WebSocket(wsUrl);
            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                this.handleIncomingData(data);
            };
            ws.onerror = () => {
                console.log('WebSocket connection failed, falling back to polling');
            };
        } catch (e) {
            console.log('WebSocket not available, using polling');
        }
    }

    setupSSE() {
        if (typeof EventSource !== 'undefined') {
            const eventSource = new EventSource('/api/events');
            eventSource.onmessage = (event) => {
                const data = JSON.parse(event.data);
                this.handleIncomingData(data);
            };
            eventSource.onerror = () => {
                eventSource.close();
            };
        }
    }

    setupPolling() {
        // Poll for updates every 30 seconds
        setInterval(() => {
            this.checkForUpdates();
        }, 30000);
    }

    // Handle incoming data from robot/bot
    handleIncomingData(data) {
        if (data.type === 'broker_update') {
            this.updateBroker(data.payload);
        } else if (data.type === 'new_broker') {
            this.addBroker(data.payload);
        } else if (data.type === 'stats_update') {
            this.updateStats(data.payload);
        } else if (data.type === 'bulk_update') {
            this.bulkUpdate(data.payload);
        }
        
        // Refresh UI
        this.refreshUI();
    }

    // API endpoint to receive POST requests from robot
    async receiveData(data) {
        try {
            const response = await fetch(this.updateEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });
            
            if (response.ok) {
                const result = await response.json();
                this.handleIncomingData(result);
                return { success: true, message: 'Data received successfully' };
            }
        } catch (error) {
            console.error('Error receiving data:', error);
            return { success: false, message: error.message };
        }
    }

    // Update broker information
    updateBroker(brokerData) {
        const index = this.data.brokers.findIndex(b => b.id === brokerData.id || b.name === brokerData.name);
        
        if (index !== -1) {
            // Update existing broker
            this.data.brokers[index] = { ...this.data.brokers[index], ...brokerData, updatedAt: new Date().toISOString() };
        } else {
            // Add new broker
            this.addBroker(brokerData);
        }
        
        // Add to updates log
        this.data.updates.unshift({
            broker: brokerData.name || brokerData.id,
            type: index !== -1 ? 'update' : 'new',
            data: brokerData,
            timestamp: new Date().toISOString()
        });
    }

    // Add new broker
    addBroker(brokerData) {
        const newBroker = {
            id: brokerData.id || `broker_${Date.now()}`,
            name: brokerData.name,
            rating: brokerData.rating || 0,
            minDeposit: brokerData.minDeposit || 0,
            spreads: brokerData.spreads || {},
            platforms: brokerData.platforms || [],
            regulation: brokerData.regulation || [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            ...brokerData
        };
        
        this.data.brokers.push(newBroker);
    }

    // Bulk update multiple brokers
    bulkUpdate(brokersArray) {
        brokersArray.forEach(broker => {
            this.updateBroker(broker);
        });
    }

    // Update statistics
    updateStats(stats) {
        this.data.stats = { ...this.data.stats, ...stats };
    }

    // Load initial data
    async loadData() {
        try {
            const response = await fetch(this.apiEndpoint);
            if (response.ok) {
                const data = await response.json();
                this.data.brokers = data.brokers || [];
                this.data.stats = data.stats || {};
                this.refreshUI();
            }
        } catch (error) {
            console.error('Error loading data:', error);
        }
    }

    // Check for updates
    async checkForUpdates() {
        try {
            const response = await fetch(`${this.apiEndpoint}?lastUpdate=${this.getLastUpdateTime()}`);
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

    // Get last update timestamp
    getLastUpdateTime() {
        if (this.data.updates.length > 0) {
            return this.data.updates[0].timestamp;
        }
        return new Date(0).toISOString();
    }

    // Refresh UI with new data
    refreshUI() {
        this.updateStatsDisplay();
        this.updateBrokersList();
        this.updateUpdatesTable();
    }

    // Update stats display
    updateStatsDisplay() {
        const totalBrokers = this.data.brokers.length;
        const avgRating = this.calculateAverageRating();
        const totalReviews = this.data.stats.totalReviews || 0;
        const growthRate = this.data.stats.growthRate || 0;

        const totalBrokersEl = document.getElementById('totalBrokers');
        const avgRatingEl = document.getElementById('avgRating');
        const totalReviewsEl = document.getElementById('totalReviews');
        const growthRateEl = document.getElementById('growthRate');

        if (totalBrokersEl) totalBrokersEl.textContent = totalBrokers;
        if (avgRatingEl) avgRatingEl.textContent = avgRating.toFixed(1);
        if (totalReviewsEl) totalReviewsEl.textContent = totalReviews.toLocaleString();
        if (growthRateEl) growthRateEl.textContent = `${growthRate}%`;
    }

    // Calculate average rating
    calculateAverageRating() {
        if (this.data.brokers.length === 0) return 0;
        const sum = this.data.brokers.reduce((acc, broker) => acc + (broker.rating || 0), 0);
        return sum / this.data.brokers.length;
    }

    // Update brokers list
    updateBrokersList() {
        // Sort by rating
        const topBrokers = [...this.data.brokers]
            .sort((a, b) => (b.rating || 0) - (a.rating || 0))
            .slice(0, 4);

        const chartEl = document.getElementById('topBrokersChart');
        if (chartEl) {
            chartEl.innerHTML = topBrokers.map(broker => `
                <div class="chart-bar-item">
                    <div class="bar-label">${broker.name}</div>
                    <div class="bar-container">
                        <div class="bar-fill" style="width: ${(broker.rating / 5) * 100}%"></div>
                    </div>
                    <div class="bar-value">${broker.rating.toFixed(1)}</div>
                </div>
            `).join('');
        }
    }

    // Update updates table
    updateUpdatesTable() {
        const tableBody = document.getElementById('brokerUpdatesTable');
        if (tableBody) {
            const recentUpdates = this.data.updates.slice(0, 10);
            tableBody.innerHTML = recentUpdates.map(update => {
                const typeMap = {
                    'update': { class: 'badge-info', text: 'Update' },
                    'new': { class: 'badge-success', text: 'New' },
                    'spread': { class: 'badge-info', text: 'Spread Update' },
                    'regulation': { class: 'badge-warning', text: 'Regulation' }
                };
                const badge = typeMap[update.type] || typeMap['update'];
                
                return `
                    <tr>
                        <td>${update.broker}</td>
                        <td><span class="badge ${badge.class}">${badge.text}</span></td>
                        <td>${JSON.stringify(update.data).substring(0, 50)}...</td>
                        <td>${new Date(update.timestamp).toLocaleDateString()}</td>
                        <td><span class="status-badge active">Active</span></td>
                    </tr>
                `;
            }).join('');
        }
    }

    // Export data (for debugging/testing)
    exportData() {
        return JSON.stringify(this.data, null, 2);
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
}

// Initialize API when DOM is ready
let brokerAPI;
document.addEventListener('DOMContentLoaded', () => {
    brokerAPI = new BrokerDataAPI();
    
    // Expose API globally for external access
    window.BrokerDataAPI = brokerAPI;
    
    // Setup refresh button
    const refreshBtn = document.querySelector('.btn-refresh');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            brokerAPI.loadData();
        });
    }
});

// Example: Function to receive data from robot (can be called externally)
window.receiveBrokerData = function(data) {
    if (brokerAPI) {
        return brokerAPI.receiveData(data);
    }
    return { success: false, message: 'API not initialized' };
};


