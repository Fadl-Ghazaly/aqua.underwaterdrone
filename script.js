// ============================================
// AQUADRON MAIN SCRIPT
// ============================================

class AquaDashboard {
    constructor() {
        // DOM Elements
        this.elements = {
            connectBtn: document.getElementById('connectBtn'),
            disconnectBtn: document.getElementById('disconnectBtn'),
            connectionStatus: document.getElementById('connectionStatus'),
            dataCount: document.getElementById('dataCount'),
            lastUpdate: document.getElementById('lastUpdate'),
            
            // Sensor values
            phValue: document.getElementById('phValue'),
            tdsValue: document.getElementById('tdsValue'),
            turbValue: document.getElementById('turbValue'),
            
            // Status badges
            phStatus: document.getElementById('phStatus'),
            tdsStatus: document.getElementById('tdsStatus'),
            turbStatus: document.getElementById('turbStatus'),
            
            // Statistics
            avgPh: document.getElementById('avgPh'),
            avgTds: document.getElementById('avgTds'),
            avgTurb: document.getElementById('avgTurb'),
            totalSessions: document.getElementById('totalSessions'),
            
            // Table
            tableBody: document.getElementById('tableBody'),
            displayCount: document.getElementById('displayCount'),
            
            // Buttons
            exportCSV: document.getElementById('exportCSV'),
            exportJSON: document.getElementById('exportJSON'),
            clearData: document.getElementById('clearData'),
            refreshChart: document.getElementById('refreshChart'),
            
            // Pagination
            prevPage: document.getElementById('prevPage'),
            nextPage: document.getElementById('nextPage'),
            pageInfo: document.getElementById('pageInfo')
        };

        // State
        this.port = null;
        this.reader = null;
        this.keepReading = false;
        this.dataPoints = [];
        this.chart = null;
        this.currentPage = 1;
        this.pageSize = 10;
        this.currentSessionId = null;
        
        // Constants
        this.MAX_DATA_POINTS = 100;
        this.BAUD_RATE = 9600;
        
        this.init();
    }

    // ============================================
    // INITIALIZATION
    // ============================================
    async init() {
        console.log('Initializing AQUADRON Dashboard...');
        
        // Check Web Serial API support
        if (!navigator.serial) {
            this.showError('Web Serial API tidak didukung. Gunakan Chrome/Edge versi terbaru.');
            return;
        }
        
        // Initialize chart
        this.initChart();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Start new session
        await this.startNewSession();
        
        // Load recent data from database
        await this.loadRecentData();
        
        // Update statistics
        await this.updateStatistics();
        
        console.log('Dashboard ready!');
    }

    // ============================================
    // CHART INITIALIZATION
    // ============================================
    initChart() {
        const ctx = document.getElementById('sensorChart').getContext('2d');
        
        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'pH',
                        borderColor: '#4299e1',
                        backgroundColor: 'rgba(66, 153, 225, 0.1)',
                        borderWidth: 2,
                        pointRadius: 3,
                        pointHoverRadius: 5,
                        data: [],
                        yAxisID: 'y-ph',
                        tension: 0.4
                    },
                    {
                        label: 'TDS (ppm)',
                        borderColor: '#48bb78',
                        backgroundColor: 'rgba(72, 187, 120, 0.1)',
                        borderWidth: 2,
                        pointRadius: 3,
                        pointHoverRadius: 5,
                        data: [],
                        yAxisID: 'y-tds',
                        tension: 0.4
                    },
                    {
                        label: 'Turbidity (NTU)',
                        borderColor: '#ed8936',
                        backgroundColor: 'rgba(237, 137, 54, 0.1)',
                        borderWidth: 2,
                        pointRadius: 3,
                        pointHoverRadius: 5,
                        data: [],
                        yAxisID: 'y-turb',
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            padding: 20
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: (context) => {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed.y !== null) {
                                    label += context.parsed.y.toFixed(2);
                                }
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    'y-ph': {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: 'pH Level'
                        },
                        min: 0,
                        max: 14,
                        grid: {
                            color: 'rgba(0,0,0,0.05)'
                        }
                    },
                    'y-tds': {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'TDS (ppm)'
                        },
                        min: 0,
                        max: 1000,
                        grid: {
                            drawOnChartArea: false
                        }
                    },
                    'y-turb': {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Turbidity (NTU)'
                        },
                        min: 0,
                        max: 100,
                        grid: {
                            drawOnChartArea: false
                        }
                    }
                }
            }
        });
    }

    // ============================================
    // EVENT LISTENERS
    // ============================================
    setupEventListeners() {
        // Connection buttons
        this.elements.connectBtn.addEventListener('click', () => this.connectESP32());
        this.elements.disconnectBtn.addEventListener('click', () => this.disconnectESP32());
        
        // Export buttons
        this.elements.exportCSV.addEventListener('click', () => this.exportToCSV());
        this.elements.exportJSON.addEventListener('click', () => this.exportToJSON());
        this.elements.clearData.addEventListener('click', () => this.clearData());
        
        // Chart refresh
        this.elements.refreshChart.addEventListener('click', () => this.refreshChart());
        
        // Pagination
        this.elements.prevPage.addEventListener('click', () => this.prevPage());
        this.elements.nextPage.addEventListener('click', () => this.nextPage());
        
        // Time range change
        document.getElementById('chartTimeRange').addEventListener('change', (e) => {
            this.refreshChart(e.target.value);
        });
        
        // Window unload
        window.addEventListener('beforeunload', () => this.handleUnload());
    }

    // ============================================
    // SESSION MANAGEMENT
    // ============================================
    async startNewSession() {
        try {
            this.currentSessionId = await AquaDB.startSession();
            console.log('New session started:', this.currentSessionId);
            
            // Update total sessions count
            const sessions = await AquaDB.getAllSessions();
            this.elements.totalSessions.textContent = sessions.length;
            
        } catch (error) {
            console.error('Error starting session:', error);
        }
    }

    // ============================================
    // ESP32 CONNECTION
    // ============================================
    async connectESP32() {
        try {
            // Request port
            this.port = await navigator.serial.requestPort();
            await this.port.open({ baudRate: this.BAUD_RATE });
            
            // Update UI
            this.elements.connectBtn.style.display = 'none';
            this.elements.disconnectBtn.style.display = 'inline-block';
            
            this.elements.connectionStatus.className = 'status-indicator connected';
            this.elements.connectionStatus.innerHTML = '<span class="status-dot"></span>Status: Connected to ESP32';
            
            // Start reading
            this.keepReading = true;
            this.readData();
            
            // Add alert
            this.addAlert('Connected to ESP32', 'info');
            
        } catch (error) {
            console.error('Connection error:', error);
            this.showError('Gagal connect ke ESP32: ' + error.message);
        }
    }

    async disconnectESP32() {
        this.keepReading = false;
        
        if (this.reader) {
            await this.reader.cancel();
            this.reader.releaseLock();
        }
        
        if (this.port) {
            await this.port.close();
        }
        
        // Update UI
        this.elements.connectBtn.style.display = 'inline-block';
        this.elements.disconnectBtn.style.display = 'none';
        
        this.elements.connectionStatus.className = 'status-indicator disconnected';
        this.elements.connectionStatus.innerHTML = '<span class="status-dot"></span>Status: Disconnected';
        
        // End session
        await AquaDB.endSession();
        
        // Add alert
        this.addAlert('Disconnected from ESP32', 'info');
    }

    async readData() {
        const decoder = new TextDecoder();
        
        while (this.keepReading && this.port.readable) {
            try {
                this.reader = this.port.readable.getReader();
                
                while (this.keepReading) {
                    const { value, done } = await this.reader.read();
                    if (done) break;
                    
                    const text = decoder.decode(value);
                    const lines = text.split('\n');
                    
                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (trimmed.length > 0) {
                            await this.parseSensorData(trimmed);
                        }
                    }
                }
                
            } catch (error) {
                console.error('Read error:', error);
                if (this.keepReading) {
                    this.addAlert('Data reading error: ' + error.message, 'warning');
                }
            } finally {
                if (this.reader) {
                    this.reader.releaseLock();
                }
            }
        }
    }

    // ============================================
    // DATA PROCESSING
    // ============================================
    async parseSensorData(data) {
        // Format: pH,TDS,Turbidity
        const parts = data.split(',');
        
        if (parts.length >= 3) {
            const ph = parseFloat(parts[0]);
            const tds = parseFloat(parts[1]);
            const turb = parseFloat(parts[2]);
            
            if (!isNaN(ph) && !isNaN(tds) && !isNaN(turb)) {
                const timestamp = new Date();
                
                // Update dashboard
                this.updateDashboard(ph, tds, turb, timestamp);
                
                // Save to database
                await AquaDB.addSensorData({
                    ph: ph,
                    tds: tds,
                    turbidity: turb,
                    timestamp: timestamp.toISOString(),
                    sessionId: this.currentSessionId
                });
                
                // Check for alerts
                this.checkAlerts(ph, tds, turb, timestamp);
                
                // Update data count
                const recentData = await AquaDB.getRecentData();
                this.elements.dataCount.innerHTML = `📊 Data: ${recentData.length} samples`;
                
                // Update statistics periodically
                if (recentData.length % 10 === 0) {
                    await this.updateStatistics();
                }
            }
        }
    }

    updateDashboard(ph, tds, turb, timestamp) {
        // Update values
        this.elements.phValue.textContent = ph.toFixed(2);
        this.elements.tdsValue.textContent = Math.round(tds);
        this.elements.turbValue.textContent = turb.toFixed(1);
        
        // Update last update time
        const timeStr = timestamp.toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        this.elements.lastUpdate.textContent = timeStr;
        
        // Update status badges
        this.updateStatusBadges(ph, tds, turb);
        
        // Update timestamps
        document.getElementById('phTimestamp').textContent = timeStr;
        document.getElementById('tdsTimestamp').textContent = timeStr;
        document.getElementById('turbTimestamp').textContent = timeStr;
        
        // Add to table
        this.addToTable(ph, tds, turb, timestamp);
        
        // Update chart
        this.updateChart(ph, tds, turb, timestamp);
    }

    updateStatusBadges(ph, tds, turb) {
        // pH Status
        const phStatus = this.elements.phStatus;
        if (ph >= 6.5 && ph <= 8.5) {
            phStatus.textContent = '✓ Normal';
            phStatus.className = 'status-badge good';
        } else {
            phStatus.textContent = '⚠️ Abnormal';
            phStatus.className = 'status-badge danger';
        }
        
        // TDS Status
        const tdsStatus = this.elements.tdsStatus;
        if (tds < 500) {
            tdsStatus.textContent = '✓ Aman';
            tdsStatus.className = 'status-badge good';
        } else if (tds < 800) {
            tdsStatus.textContent = '⚠️ Sedang';
            tdsStatus.className = 'status-badge warning';
        } else {
            tdsStatus.textContent = '❌ Tinggi';
            tdsStatus.className = 'status-badge danger';
        }
        
        // Turbidity Status
        const turbStatus = this.elements.turbStatus;
        if (turb < 5) {
            turbStatus.textContent = '✓ Jernih';
            turbStatus.className = 'status-badge good';
        } else if (turb < 10) {
            turbStatus.textContent = '⚠️ Sedikit Keruh';
            turbStatus.className = 'status-badge warning';
        } else {
            turbStatus.textContent = '❌ Keruh';
            turbStatus.className = 'status-badge danger';
        }
    }

    // ============================================
    // CHART UPDATE
    // ============================================
    updateChart(ph, tds, turb, timestamp) {
        const timeLabel = timestamp.toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        
        // Add to data points
        this.dataPoints.push({
            time: timeLabel,
            ph: ph,
            tds: tds,
            turb: turb
        });
        
        // Limit data points
        if (this.dataPoints.length > this.MAX_DATA_POINTS) {
            this.dataPoints.shift();
        }
        
        // Update chart
        this.chart.data.labels = this.dataPoints.map(d => d.time);
        this.chart.data.datasets[0].data = this.dataPoints.map(d => d.ph);
        this.chart.data.datasets[1].data = this.dataPoints.map(d => d.tds);
        this.chart.data.datasets[2].data = this.dataPoints.map(d => d.turb);
        this.chart.update();
    }

    async refreshChart(hours = 6) {
        try {
            const endDate = new Date();
            const startDate = new Date();
            startDate.setHours(startDate.getHours() - hours);
            
            const data = await AquaDB.getDataByDateRange(startDate, endDate);
            
            if (data.length > 0) {
                this.dataPoints = data.map(d => ({
                    time: new Date(d.timestamp).toLocaleTimeString('id-ID', {
                        hour: '2-digit',
                        minute: '2-digit'
                    }),
                    ph: d.ph,
                    tds: d.tds,
                    turb: d.turbidity
                }));
                
                this.chart.data.labels = this.dataPoints.map(d => d.time);
                this.chart.data.datasets[0].data = this.dataPoints.map(d => d.ph);
                this.chart.data.datasets[1].data = this.dataPoints.map(d => d.tds);
                this.chart.data.datasets[2].data = this.dataPoints.map(d => d.turb);
                this.chart.update();
            }
            
            this.addAlert(`Chart refreshed (last ${hours} hours)`, 'info');
            
        } catch (error) {
            console.error('Error refreshing chart:', error);
        }
    }

    // ============================================
    // DATA TABLE
    // ============================================
    addToTable(ph, tds, turb, timestamp) {
        const timeStr = timestamp.toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        
        const dateStr = timestamp.toLocaleDateString('id-ID');
        
        // Determine water status
        let waterStatus = '';
        if (ph >= 6.5 && ph <= 8.5 && tds < 500 && turb < 5) {
            waterStatus = '<span class="status-badge good">✓ Layak Minum</span>';
        } else {
            waterStatus = '<span class="status-badge danger">⚠️ Perlu Pemeriksaan</span>';
        }
        
        // Determine drinkability
        let drinkability = '';
        if (ph >= 6.5 && ph <= 8.5 && tds < 500 && turb < 5) {
            drinkability = '<span style="color: #48bb78;">✓ Aman</span>';
        } else {
            drinkability = '<span style="color: #f56565;">✗ Tidak Aman</span>';
        }
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${dateStr}<br><small>${timeStr}</small></td>
            <td>${ph.toFixed(2)}</td>
            <td>${Math.round(tds)}</td>
            <td>${turb.toFixed(1)}</td>
            <td>${waterStatus}</td>
            <td>${drinkability}</td>
        `;
        
        const tableBody = this.elements.tableBody;
        
        // Remove empty row if exists
        if (tableBody.children.length === 1 && tableBody.children[0].classList.contains('empty-row')) {
            tableBody.innerHTML = '';
        }
        
        // Add to top
        tableBody.insertBefore(row, tableBody.firstChild);
        
        // Limit rows
        if (tableBody.children.length > 50) {
            tableBody.removeChild(tableBody.lastChild);
        }
        
        // Update display count
        this.elements.displayCount.textContent = tableBody.children.length;
    }

    async loadRecentData() {
        try {
            const data = await AquaDB.getRecentData(20);
            
            if (data.length > 0) {
                data.reverse().forEach(d => {
                    this.addToTable(
                        d.ph,
                        d.tds,
                        d.turbidity,
                        new Date(d.timestamp)
                    );
                });
            }
            
        } catch (error) {
            console.error('Error loading recent data:', error);
        }
    }

    // ============================================
    // STATISTICS
    // ============================================
    async updateStatistics() {
        try {
            const stats = await AquaDB.getStatistics(24);
            
            this.elements.avgPh.textContent = stats.avgPh;
            this.elements.avgTds.textContent = `${stats.avgTds} ppm`;
            this.elements.avgTurb.textContent = `${stats.avgTurb} NTU`;
            
        } catch (error) {
            console.error('Error updating statistics:', error);
        }
    }

    // ============================================
    // ALERTS
    // ============================================
    checkAlerts(ph, tds, turb, timestamp) {
        const alerts = [];
        
        if (ph < 6.5 || ph > 8.5) {
            alerts.push({
                type: 'pH',
                severity: 'warning',
                message: `pH tidak normal: ${ph.toFixed(2)} (normal: 6.5-8.5)`
            });
        }
        
        if (tds > 500) {
            alerts.push({
                type: 'TDS',
                severity: tds > 800 ? 'danger' : 'warning',
                message: `TDS tinggi: ${Math.round(tds)} ppm (batas: <500 ppm)`
            });
        }
        
        if (turb > 5) {
            alerts.push({
                type: 'Turbidity',
                severity: turb > 10 ? 'danger' : 'warning',
                message: `Air keruh: ${turb.toFixed(1)} NTU (batas: <5 NTU)`
            });
        }
        
        alerts.forEach(async (alert) => {
            this.addAlert(alert.message, alert.severity);
            await AquaDB.addAlert({
                type: alert.type,
                severity: alert.severity,
                message: alert.message,
                timestamp: timestamp.toISOString()
            });
        });
    }

    addAlert(message, type = 'info') {
        const alertList = document.getElementById('alertList');
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert-item alert-${type}`;
        
        const timeStr = new Date().toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        
        alertDiv.innerHTML = `
            <span class="alert-time">[${timeStr}]</span>
            <span class="alert-message">${message}</span>
            <button class="alert-close" onclick="this.parentElement.remove()">×</button>
        `;
        
        alertList.insertBefore(alertDiv, alertList.firstChild);
        
        // Limit alerts
        if (alertList.children.length > 20) {
            alertList.removeChild(alertList.lastChild);
        }
    }

    // ============================================
    // EXPORT FUNCTIONS
    // ============================================
    async exportToCSV() {
        try {
            const data = await AquaDB.getRecentData(1000);
            
            if (data.length === 0) {
                this.showError('Belum ada data untuk diexport');
                return;
            }
            
            const csv = AquaDB.exportToCSV(data);
            
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `aquadron_${new Date().toISOString().slice(0,10)}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            
            this.addAlert(`Export CSV: ${data.length} data`, 'success');
            
        } catch (error) {
            console.error('Export error:', error);
            this.showError('Gagal export CSV');
        }
    }

    async exportToJSON() {
        try {
            const data = await AquaDB.getRecentData(1000);
            
            if (data.length === 0) {
                this.showError('Belum ada data untuk diexport');
                return;
            }
            
            const json = AquaDB.exportToJSON(data);
            
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `aquadron_${new Date().toISOString().slice(0,10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
            
            this.addAlert(`Export JSON: ${data.length} data`, 'success');
            
        } catch (error) {
            console.error('Export error:', error);
            this.showError('Gagal export JSON');
        }
    }

    async clearData() {
        if (confirm('Yakin ingin menghapus semua data?')) {
            try {
                await AquaDB.clearAllData();
                this.dataPoints = [];
                this.elements.tableBody.innerHTML = '<tr class="empty-row"><td colspan="6">Belum ada data. Connect ESP32 untuk memulai monitoring.</td></tr>';
                this.elements.dataCount.innerHTML = '📊 Data: 0 samples';
                
                // Reset chart
                this.chart.data.labels = [];
                this.chart.data.datasets.forEach(ds => ds.data = []);
                this.chart.update();
                
                // Reset sensor values
                this.elements.phValue.textContent = '--';
                this.elements.tdsValue.textContent = '--';
                this.elements.turbValue.textContent = '--';
                
                this.addAlert('Semua data dihapus', 'warning');
                
            } catch (error) {
                console.error('Clear data error:', error);
                this.showError('Gagal menghapus data');
            }
        }
    }

    // ============================================
    // PAGINATION
    // ============================================
    prevPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.updatePagination();
        }
    }

    nextPage() {
        const totalRows = this.elements.tableBody.children.length;
        const totalPages = Math.ceil(totalRows / this.pageSize);
        
        if (this.currentPage < totalPages) {
            this.currentPage++;
            this.updatePagination();
        }
    }

    updatePagination() {
        const rows = this.elements.tableBody.children;
        const totalRows = rows.length;
        const totalPages = Math.ceil(totalRows / this.pageSize);
        
        // Hide all rows
        for (let row of rows) {
            row.style.display = 'none';
        }
        
        // Show current page rows
        const start = (this.currentPage - 1) * this.pageSize;
        const end = Math.min(start + this.pageSize, totalRows);
        
        for (let i = start; i < end; i++) {
            rows[i].style.display = '';
        }
        
        // Update buttons
        this.elements.prevPage.disabled = this.currentPage === 1;
        this.elements.nextPage.disabled = this.currentPage === totalPages;
        this.elements.pageInfo.textContent = `Halaman ${this.currentPage} dari ${totalPages || 1}`;
    }

    // ============================================
    // UTILITIES
    // ============================================
    showError(message) {
        alert(message);
    }

    handleUnload() {
        if (this.port && this.port.readable) {
            this.keepReading = false;
            if (this.reader) {
                this.reader.cancel();
            }
            this.port.close();
        }
        
        if (this.currentSessionId) {
            AquaDB.endSession();
        }
    }
}

// Initialize dashboard when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new AquaDashboard();
});