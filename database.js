// ============================================
// AQUADRON DATABASE - IndexedDB
// ============================================

class AquaDatabase {
    constructor() {
        this.dbName = 'AQUADRON_DB';
        this.dbVersion = 1;
        this.db = null;
        this.isReady = false;
        
        // Store names
        this.STORE_SENSOR = 'sensor_data';
        this.STORE_SESSION = 'sessions';
        this.STORE_ALERTS = 'alerts';
        
        this.init();
    }

    // ============================================
    // INITIALIZATION
    // ============================================
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);
            
            request.onerror = (event) => {
                console.error('Database error:', event.target.error);
                reject(event.target.error);
            };
            
            request.onsuccess = (event) => {
                this.db = event.target.result;
                this.isReady = true;
                console.log('Database ready:', this.dbName);
                resolve(this.db);
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                const oldVersion = event.oldVersion;
                
                console.log(`Upgrading DB from v${oldVersion} to v${this.dbVersion}`);
                
                // Create sensor_data store
                if (!db.objectStoreNames.contains(this.STORE_SENSOR)) {
                    const sensorStore = db.createObjectStore(this.STORE_SENSOR, {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                    
                    sensorStore.createIndex('timestamp', 'timestamp', { unique: false });
                    sensorStore.createIndex('ph', 'ph', { unique: false });
                    sensorStore.createIndex('tds', 'tds', { unique: false });
                    sensorStore.createIndex('turbidity', 'turbidity', { unique: false });
                    sensorStore.createIndex('sessionId', 'sessionId', { unique: false });
                    sensorStore.createIndex('byDate', ['timestamp', 'sessionId'], { unique: false });
                    
                    console.log('Created store:', this.STORE_SENSOR);
                }
                
                // Create sessions store
                if (!db.objectStoreNames.contains(this.STORE_SESSION)) {
                    const sessionStore = db.createObjectStore(this.STORE_SESSION, {
                        keyPath: 'sessionId',
                        autoIncrement: true
                    });
                    
                    sessionStore.createIndex('startTime', 'startTime', { unique: false });
                    sessionStore.createIndex('endTime', 'endTime', { unique: false });
                    sessionStore.createIndex('isActive', 'isActive', { unique: false });
                    
                    console.log('Created store:', this.STORE_SESSION);
                }
                
                // Create alerts store
                if (!db.objectStoreNames.contains(this.STORE_ALERTS)) {
                    const alertStore = db.createObjectStore(this.STORE_ALERTS, {
                        keyPath: 'alertId',
                        autoIncrement: true
                    });
                    
                    alertStore.createIndex('timestamp', 'timestamp', { unique: false });
                    alertStore.createIndex('type', 'type', { unique: false });
                    alertStore.createIndex('severity', 'severity', { unique: false });
                    alertStore.createIndex('isRead', 'isRead', { unique: false });
                    
                    console.log('Created store:', this.STORE_ALERTS);
                }
            };
        });
    }

    // ============================================
    // SENSOR DATA OPERATIONS
    // ============================================
    
    // Add single reading
    async addSensorData(data) {
        if (!this.isReady) await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.STORE_SENSOR], 'readwrite');
            const store = transaction.objectStore(this.STORE_SENSOR);
            
            const record = {
                ...data,
                timestamp: data.timestamp || new Date().toISOString(),
                sessionId: data.sessionId || this.getCurrentSessionId()
            };
            
            const request = store.add(record);
            
            request.onsuccess = () => {
                console.log('Data saved:', record);
                resolve(request.result);
            };
            
            request.onerror = (e) => {
                console.error('Error saving data:', e);
                reject(e.target.error);
            };
        });
    }

    // Add multiple readings
    async addBulkSensorData(dataArray) {
        if (!this.isReady) await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.STORE_SENSOR], 'readwrite');
            const store = transaction.objectStore(this.STORE_SENSOR);
            
            let count = 0;
            const sessionId = this.getCurrentSessionId();
            
            dataArray.forEach((data, index) => {
                const record = {
                    ...data,
                    timestamp: data.timestamp || new Date().toISOString(),
                    sessionId: sessionId
                };
                
                const request = store.add(record);
                
                request.onsuccess = () => {
                    count++;
                    if (count === dataArray.length) {
                        console.log(`Saved ${count} records`);
                        resolve(count);
                    }
                };
            });
        });
    }

    // Get recent data
    async getRecentData(limit = 100) {
        if (!this.isReady) await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.STORE_SENSOR], 'readonly');
            const store = transaction.objectStore(this.STORE_SENSOR);
            const index = store.index('timestamp');
            
            const request = index.openCursor(null, 'prev');
            const results = [];
            
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor && results.length < limit) {
                    results.push(cursor.value);
                    cursor.continue();
                } else {
                    resolve(results);
                }
            };
            
            request.onerror = (e) => reject(e.target.error);
        });
    }

    // Get data by date range
    async getDataByDateRange(startDate, endDate, limit = 1000) {
        if (!this.isReady) await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.STORE_SENSOR], 'readonly');
            const store = transaction.objectStore(this.STORE_SENSOR);
            const index = store.index('timestamp');
            
            const range = IDBKeyRange.bound(
                startDate.toISOString(),
                endDate.toISOString()
            );
            
            const request = index.openCursor(range, 'prev');
            const results = [];
            
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor && results.length < limit) {
                    results.push(cursor.value);
                    cursor.continue();
                } else {
                    resolve(results);
                }
            };
            
            request.onerror = (e) => reject(e.target.error);
        });
    }

    // Get session data
    async getSessionData(sessionId) {
        if (!this.isReady) await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.STORE_SENSOR], 'readonly');
            const store = transaction.objectStore(this.STORE_SENSOR);
            const index = store.index('sessionId');
            
            const request = index.getAll(sessionId);
            
            request.onsuccess = () => {
                resolve(request.result);
            };
            
            request.onerror = (e) => reject(e.target.error);
        });
    }

    // Delete old data
    async deleteOldData(daysOld = 30) {
        if (!this.isReady) await this.init();
        
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysOld);
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.STORE_SENSOR], 'readwrite');
            const store = transaction.objectStore(this.STORE_SENSOR);
            const index = store.index('timestamp');
            
            const range = IDBKeyRange.upperBound(cutoffDate.toISOString());
            const request = index.openCursor(range);
            
            let deletedCount = 0;
            
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    store.delete(cursor.primaryKey);
                    deletedCount++;
                    cursor.continue();
                } else {
                    console.log(`Deleted ${deletedCount} old records`);
                    resolve(deletedCount);
                }
            };
            
            request.onerror = (e) => reject(e.target.error);
        });
    }

    // ============================================
    // SESSION OPERATIONS
    // ============================================
    
    // Start new session
    async startSession() {
        if (!this.isReady) await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.STORE_SESSION], 'readwrite');
            const store = transaction.objectStore(this.STORE_SESSION);
            
            const session = {
                startTime: new Date().toISOString(),
                isActive: true,
                dataCount: 0
            };
            
            const request = store.add(session);
            
            request.onsuccess = () => {
                const sessionId = request.result;
                localStorage.setItem('currentSessionId', sessionId);
                console.log('Session started:', sessionId);
                resolve(sessionId);
            };
            
            request.onerror = (e) => reject(e.target.error);
        });
    }

    // End current session
    async endSession() {
        if (!this.isReady) await this.init();
        
        const sessionId = this.getCurrentSessionId();
        if (!sessionId) return;
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.STORE_SESSION], 'readwrite');
            const store = transaction.objectStore(this.STORE_SESSION);
            
            const request = store.get(sessionId);
            
            request.onsuccess = () => {
                const session = request.result;
                if (session) {
                    session.endTime = new Date().toISOString();
                    session.isActive = false;
                    
                    const updateRequest = store.put(session);
                    
                    updateRequest.onsuccess = () => {
                        localStorage.removeItem('currentSessionId');
                        console.log('Session ended:', sessionId);
                        resolve(sessionId);
                    };
                }
            };
            
            request.onerror = (e) => reject(e.target.error);
        });
    }

    // Get current session ID
    getCurrentSessionId() {
        return localStorage.getItem('currentSessionId');
    }

    // Get all sessions
    async getAllSessions() {
        if (!this.isReady) await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.STORE_SESSION], 'readonly');
            const store = transaction.objectStore(this.STORE_SESSION);
            const request = store.getAll();
            
            request.onsuccess = () => {
                resolve(request.result);
            };
            
            request.onerror = (e) => reject(e.target.error);
        });
    }

    // ============================================
    // STATISTICS & ANALYTICS
    // ============================================
    
    // Get statistics
    async getStatistics(timeRange = 24) {
        if (!this.isReady) await this.init();
        
        const endDate = new Date();
        const startDate = new Date();
        startDate.setHours(startDate.getHours() - timeRange);
        
        const data = await this.getDataByDateRange(startDate, endDate);
        
        if (data.length === 0) {
            return {
                avgPh: 0,
                avgTds: 0,
                avgTurb: 0,
                minPh: 0,
                maxPh: 0,
                minTds: 0,
                maxTds: 0,
                minTurb: 0,
                maxTurb: 0,
                totalSamples: 0
            };
        }
        
        const phValues = data.map(d => d.ph).filter(v => !isNaN(v));
        const tdsValues = data.map(d => d.tds).filter(v => !isNaN(v));
        const turbValues = data.map(d => d.turbidity).filter(v => !isNaN(v));
        
        return {
            avgPh: this.average(phValues).toFixed(2),
            avgTds: Math.round(this.average(tdsValues)),
            avgTurb: this.average(turbValues).toFixed(1),
            minPh: Math.min(...phValues).toFixed(2),
            maxPh: Math.max(...phValues).toFixed(2),
            minTds: Math.min(...tdsValues),
            maxTds: Math.max(...tdsValues),
            minTurb: Math.min(...turbValues).toFixed(1),
            maxTurb: Math.max(...turbValues).toFixed(1),
            totalSamples: data.length
        };
    }

    average(arr) {
        return arr.reduce((a, b) => a + b, 0) / arr.length;
    }

    // ============================================
    // ALERT OPERATIONS
    // ============================================
    
    // Add alert
    async addAlert(alert) {
        if (!this.isReady) await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.STORE_ALERTS], 'readwrite');
            const store = transaction.objectStore(this.STORE_ALERTS);
            
            const record = {
                ...alert,
                timestamp: alert.timestamp || new Date().toISOString(),
                isRead: false
            };
            
            const request = store.add(record);
            
            request.onsuccess = () => {
                resolve(request.result);
            };
            
            request.onerror = (e) => reject(e.target.error);
        });
    }

    // Get unread alerts
    async getUnreadAlerts() {
        if (!this.isReady) await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.STORE_ALERTS], 'readonly');
            const store = transaction.objectStore(this.STORE_ALERTS);
            const index = store.index('isRead');
            
            const request = index.getAll(false);
            
            request.onsuccess = () => {
                resolve(request.result);
            };
            
            request.onerror = (e) => reject(e.target.error);
        });
    }

    // Mark alert as read
    async markAlertAsRead(alertId) {
        if (!this.isReady) await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.STORE_ALERTS], 'readwrite');
            const store = transaction.objectStore(this.STORE_ALERTS);
            
            const request = store.get(alertId);
            
            request.onsuccess = () => {
                const alert = request.result;
                if (alert) {
                    alert.isRead = true;
                    const updateRequest = store.put(alert);
                    
                    updateRequest.onsuccess = () => {
                        resolve(alertId);
                    };
                }
            };
            
            request.onerror = (e) => reject(e.target.error);
        });
    }

    // ============================================
    // EXPORT FUNCTIONS
    // ============================================
    
    // Export to CSV
    exportToCSV(data) {
        if (!data || data.length === 0) return null;
        
        const headers = ['Timestamp', 'pH', 'TDS (ppm)', 'Turbidity (NTU)', 'Session ID'];
        const rows = data.map(d => [
            d.timestamp,
            d.ph,
            d.tds,
            d.turbidity,
            d.sessionId || ''
        ]);
        
        const csv = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');
        
        return csv;
    }

    // Export to JSON
    exportToJSON(data) {
        return JSON.stringify(data, null, 2);
    }

    // ============================================
    // CLEANUP
    // ============================================
    
    // Clear all data
    async clearAllData() {
        if (!this.isReady) await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(
                [this.STORE_SENSOR, this.STORE_ALERTS],
                'readwrite'
            );
            
            const sensorStore = transaction.objectStore(this.STORE_SENSOR);
            const alertStore = transaction.objectStore(this.STORE_ALERTS);
            
            sensorStore.clear();
            alertStore.clear();
            
            transaction.oncomplete = () => {
                console.log('All data cleared');
                resolve();
            };
            
            transaction.onerror = (e) => reject(e.target.error);
        });
    }
}

// Create and export database instance
const AquaDB = new AquaDatabase();
window.AquaDB = AquaDB;