class PQCalculator {
    constructor() {
        this.data = null;
        this.chart = null;
        this.state = {
            selectedFan: null,
            fanQuantity: 1,
            selectedFilter: null,
            selectedFilterSize: null,
            filterQuantity: 1,
            units: 'inches'
        };
        
        this.init();
    }

    async init() {
        await this.loadData();
        this.setupEventListeners();
        this.loadUserPreferences();
        this.populateDropdowns();
        this.initChart();
        this.loadFromURL();
    }

    async loadData() {
        try {
            const response = await fetch('data.json');
            this.data = await response.json();
        } catch (error) {
            console.error('Error loading data:', error);
            this.showError('Failed to load data. Please check that data.json exists.');
        }
    }

    setupEventListeners() {
        document.getElementById('fan-select').addEventListener('change', (e) => {
            this.state.selectedFan = e.target.value;
            this.updateCalculation();
        });

        document.getElementById('fan-quantity').addEventListener('input', (e) => {
            this.state.fanQuantity = parseInt(e.target.value) || 1;
            this.updateCalculation();
        });

        document.getElementById('filter-select').addEventListener('change', (e) => {
            this.state.selectedFilter = e.target.value;
            this.populateFilterSizes();
            this.updateCalculation();
        });

        document.getElementById('filter-size').addEventListener('change', (e) => {
            this.state.selectedFilterSize = e.target.value;
            this.updateCalculation();
        });

        document.getElementById('filter-quantity').addEventListener('input', (e) => {
            this.state.filterQuantity = parseInt(e.target.value) || 1;
            this.updateCalculation();
        });

        document.getElementById('unit-toggle').addEventListener('change', (e) => {
            this.state.units = e.target.checked ? 'inches' : 'mm';
            this.saveUserPreferences();
            this.updateCalculation();
        });

        document.getElementById('share-build').addEventListener('click', () => {
            this.copyShareLink();
        });
    }

    loadUserPreferences() {
        const savedUnits = localStorage.getItem('pq-units');
        if (savedUnits) {
            this.state.units = savedUnits;
            document.getElementById('unit-toggle').checked = savedUnits === 'inches';
        }
    }

    saveUserPreferences() {
        localStorage.setItem('pq-units', this.state.units);
    }

    populateDropdowns() {
        if (!this.data) return;

        const fanSelect = document.getElementById('fan-select');
        fanSelect.innerHTML = '<option value="">Select a fan...</option>';
        
        this.data.fans.forEach(fan => {
            const option = document.createElement('option');
            option.value = fan.id;
            option.textContent = `${fan.name} - ${fan.manufacturer}`;
            fanSelect.appendChild(option);
        });

        const filterSelect = document.getElementById('filter-select');
        filterSelect.innerHTML = '<option value="">Select filter media...</option>';
        
        this.data.filters.forEach(filter => {
            const option = document.createElement('option');
            option.value = filter.id;
            option.textContent = `${filter.name} - ${filter.manufacturer}`;
            filterSelect.appendChild(option);
        });
    }

    populateFilterSizes() {
        const filterSizeSelect = document.getElementById('filter-size');
        filterSizeSelect.innerHTML = '<option value="">Select size...</option>';

        if (!this.state.selectedFilter) return;

        const filter = this.data.filters.find(f => f.id === this.state.selectedFilter);
        if (filter && filter.availableSizes) {
            filter.availableSizes.forEach((size, index) => {
                const option = document.createElement('option');
                option.value = index;
                option.textContent = `${size.label} (${size.area} sq ft)`;
                filterSizeSelect.appendChild(option);
            });
        }
    }

    parseCSVData(csvString, columns) {
        const cfmIndex = columns.indexOf('cfm');
        const pressureIndex = columns.findIndex(col => col === 'mm' || col === 'in');
        
        if (cfmIndex === -1 || pressureIndex === -1) {
            console.error('Invalid columns format: must contain "cfm" and either "mm" or "in"');
            return [];
        }
        
        return csvString.trim().split('\n').map(line => {
            const values = line.split(',').map(val => parseFloat(val.trim()));
            return { 
                x: values[cfmIndex], 
                y: values[pressureIndex] 
            };
        });
    }

    interpolate(data, targetX) {
        if (data.length === 0) return null;
        
        if (targetX <= data[0].x) return data[0].y;
        if (targetX >= data[data.length - 1].x) return data[data.length - 1].y;

        for (let i = 0; i < data.length - 1; i++) {
            if (targetX >= data[i].x && targetX <= data[i + 1].x) {
                const x1 = data[i].x, y1 = data[i].y;
                const x2 = data[i + 1].x, y2 = data[i + 1].y;
                return y1 + (y2 - y1) * (targetX - x1) / (x2 - x1);
            }
        }
        
        return null;
    }

    convertPressure(value, fromUnit, toUnit) {
        if (fromUnit === toUnit) return value;
        if (fromUnit === 'inches' && toUnit === 'mm') return value * 25.4;
        if (fromUnit === 'mm' && toUnit === 'inches') return value / 25.4;
        return value;
    }

    getPressureUnitFromDataFormat(item) {
        // Simplified format: check columns array for "mm" or "in"
        if (item && item.columns) {
            const pressureColumn = item.columns.find(col => col === 'mm' || col === 'in');
            if (pressureColumn === 'mm') return 'mm';
            if (pressureColumn === 'in') return 'inches';
        }
        
        // Error if format not recognized
        console.error('Invalid data format: columns must contain "cfm" and either "mm" or "in"');
        return 'inches';
    }

    /**
     * Clamp an axis' max to the smallest per-dataset max (plus optional padding).
     * Apply to 'x', 'y', or both ('xy'). Default: y only, 5% headroom.
     */
    smallestMaxPlugin(paddingPct = 0, axes = 'xy') {
        return {
        id: 'smallestMax',
        afterDataLimits(chart, args) {        // <-- run AFTER data limits are computed
            const scale = args.scale;
            if (!axes.includes(scale.axis)) return; // respect axes setting
    
            // collect *visible* dataset metas attached to this scale
            const metas = scale.getMatchingVisibleMetas();  // public v4 API
            if (!metas.length) return;
    
            // smallest of each dataset's own max for this scale
            const minOfMax = Math.min(...metas.map(meta => {
            const vals = meta.controller.getAllParsedValues(scale); // public API
            return Math.max(...vals);
            }));
    
            // apply padding (0 allowed; you logged 0%)
            const padded = minOfMax * (1 + paddingPct / 100);
    
            console.log('AfterDataLimits', scale.id, {origMax: scale.max, clampedTo: padded});
            // clamp: never exceed the currently computed max
            scale.max = Math.min(scale.max, padded);
        }
        };
    }

    calculateFanCurve() {
        if (!this.state.selectedFan) return null;

        const fan = this.data.fans.find(f => f.id === this.state.selectedFan);
        if (!fan) return null;

        const rawData = this.parseCSVData(fan.data, fan.columns);
        console.log('🔵 Fan Raw Data:', rawData.slice(0, 3), '... (showing first 3 points)');
        
        // Determine source pressure units from data format
        const sourcePressureUnit = this.getPressureUnitFromDataFormat(fan);
        console.log('🔵 Fan source pressure unit:', sourcePressureUnit);
        
        const converted = rawData.map(point => ({
            x: point.x * this.state.fanQuantity,
            y: this.convertPressure(point.y, sourcePressureUnit, this.state.units)
        }));
        
        console.log('🔵 Fan Converted Data (units:', this.state.units + '):', converted.slice(0, 3), '... (showing first 3 points)');
        return converted;
    }

    calculateFilterCurve() {
        if (!this.state.selectedFilter || this.state.selectedFilterSize === null) return null;

        const filter = this.data.filters.find(f => f.id === this.state.selectedFilter);
        if (!filter) return null;

        const sizeIndex = parseInt(this.state.selectedFilterSize);
        const filterSize = filter.availableSizes[sizeIndex];
        if (!filterSize) return null;

        const rawData = this.parseCSVData(filter.data, filter.columns);
        const totalArea = filterSize.area * this.state.filterQuantity;
        console.log('🔴 Filter Raw Data:', rawData.slice(0, 3), '... (showing first 3 points)');
        console.log('🔴 Filter Total Area:', totalArea, 'sq ft');
        
        // Determine source pressure units from data format
        const sourcePressureUnit = this.getPressureUnitFromDataFormat(filter);
        console.log('🔴 Filter source pressure unit:', sourcePressureUnit);
        
        const converted = rawData.map(point => ({
            x: point.x * totalArea,
            y: this.convertPressure(point.y, sourcePressureUnit, this.state.units)
        }));
        
        console.log('🔴 Filter Converted Data (units:', this.state.units + '):', converted.slice(0, 3), '... (showing first 3 points)');
        return converted;
    }

    findIntersection(fanCurve, filterCurve) {
        if (!fanCurve || !filterCurve) return null;
        
        console.log('🟢 Starting intersection calculation (units:', this.state.units + ')');
        console.log('🟢 Fan curve range: CFM', fanCurve[0]?.x, 'to', fanCurve[fanCurve.length-1]?.x);
        console.log('🟢 Filter curve range: CFM', filterCurve[0]?.x, 'to', filterCurve[filterCurve.length-1]?.x);

        let i = 0; // fan curve index
        let j = 0; // filter curve index
        let prevFanPressure = null;
        let prevFilterPressure = null;
        let prevCfm = null;
        
        while (i < fanCurve.length && j < filterCurve.length) {
            const fanPoint = fanCurve[i];
            const filterPoint = filterCurve[j];
            
            let currentCfm, fanPressure, filterPressure;
            
            if (fanPoint.x <= filterPoint.x) {
                // Use fan point CFM, interpolate filter pressure
                currentCfm = fanPoint.x;
                fanPressure = fanPoint.y;
                filterPressure = this.interpolate(filterCurve, currentCfm);
                i++;
            } else {
                // Use filter point CFM, interpolate fan pressure
                currentCfm = filterPoint.x;
                filterPressure = filterPoint.y;
                fanPressure = this.interpolate(fanCurve, currentCfm);
                j++;
            }
            
            if (fanPressure !== null && filterPressure !== null) {
                // Check if we have a previous point and the relationship has flipped
                if (prevFanPressure !== null && prevFilterPressure !== null) {
                    const prevDiff = prevFanPressure - prevFilterPressure;
                    const currentDiff = fanPressure - filterPressure;
                    
                    // Check for sign change (crossing)
                    if (prevDiff * currentDiff <= 0) {
                        // Found a crossing! Interpolate between prev and current points
                        console.log('🟢 Crossing detected between CFM', prevCfm, 'and', currentCfm);
                        console.log('🟢 Previous: Fan=', prevFanPressure, 'Filter=', prevFilterPressure, 'Diff=', prevDiff);
                        console.log('🟢 Current: Fan=', fanPressure, 'Filter=', filterPressure, 'Diff=', currentDiff);
                        
                        // Linear interpolation to find exact intersection
                        const t = Math.abs(prevDiff) / (Math.abs(prevDiff) + Math.abs(currentDiff));
                        const intersectionCfm = prevCfm + t * (currentCfm - prevCfm);
                        const intersectionPressure = prevFanPressure + t * (fanPressure - prevFanPressure);
                        
                        console.log('🟢 Intersection found at CFM:', intersectionCfm);
                        console.log('🟢 Intersection pressure:', intersectionPressure);
                        
                        return {
                            cfm: intersectionCfm,
                            pressure: intersectionPressure
                        };
                    }
                }
                
                // Store current values for next iteration
                prevCfm = currentCfm;
                prevFanPressure = fanPressure;
                prevFilterPressure = filterPressure;
                
                // Log sample points for debugging
                if (Math.floor(currentCfm / 10) % 10 === 0) {
                    console.log(`🟢 CFM ${currentCfm.toFixed(1)}: Fan=${fanPressure.toFixed(4)}, Filter=${filterPressure.toFixed(4)}, Diff=${(fanPressure - filterPressure).toFixed(4)}`);
                }
            }
        }

        console.log('🟢 No intersection found');
        return null;
    }

    updateCalculation() {
        console.log('⚙️ updateCalculation() called');
        console.log('⚙️ Current units:', this.state.units);
        console.log('⚙️ Fan quantity:', this.state.fanQuantity);
        console.log('⚙️ Filter quantity:', this.state.filterQuantity);
        
        const fanCurve = this.calculateFanCurve();
        const filterCurve = this.calculateFilterCurve();
        const intersection = this.findIntersection(fanCurve, filterCurve);

        console.log('⚙️ Final intersection result:', intersection);
        
        this.updateChart(fanCurve, filterCurve, intersection);
        this.updateOperatingPoint(intersection);
        this.updateURL();
    }

    initChart() {
        const ctx = document.getElementById('pq-chart').getContext('2d');
        const unitLabel = this.state.units === 'inches' ? 'in H₂O' : 'mm H₂O';
        
        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                datasets: []
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                interaction: {
                    intersect: false,
                    mode: 'nearest'
                },
                plugins: {
                    title: {
                        display: true,
                        text: 'P-Q Curve Analysis'
                    },
                    legend: {
                        display: true,
                        labels: {
                            usePointStyle: true,
                            pointStyle: 'line'
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'linear',
                        position: 'bottom',
                        title: {
                            display: true,
                            text: 'Airflow (CFM)'
                        },
                        grid: {
                            display: true
                        },
                        min: 0,
                        grace: '10%',
                        bounds: 'ticks',
                        ticks: {
                            includeBounds: true
                        }
                    },
                    y: {
                        type: 'linear',
                        title: {
                            display: true,
                            text: `Static Pressure (${unitLabel})`
                        },
                        grid: {
                            display: true
                        },
                        min: 0,
                        grace: '10%',
                        ticks: {
                            includeBounds: true
                        }
                    }
                }
            },
            plugins: [this.smallestMaxPlugin(0, 'xy')]
        });
    }

    updateChart(fanCurve, filterCurve, intersection) {
        if (!this.chart) return;

        const datasets = [];
        const unitLabel = this.state.units === 'inches' ? 'in H₂O' : 'mm H₂O';

        // Plugin will handle axis limits automatically

        if (fanCurve) {
            datasets.push({
                label: 'Fan Curve',
                data: fanCurve,
                borderColor: '#2563eb',
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                borderWidth: 1.5,
                tension: 0.1,
                pointRadius: 0,
                pointHoverRadius: 4
            });
        }

        if (filterCurve) {
            datasets.push({
                label: 'Filter Curve',
                data: filterCurve,
                borderColor: '#dc2626',
                backgroundColor: 'rgba(220, 38, 38, 0.1)',
                borderWidth: 1.5,
                tension: 0.1,
                pointRadius: 0,
                pointHoverRadius: 4
            });
        }

        // Operating point is displayed in the sidebar, not as a chart dataset
        // This prevents it from affecting the axis scaling

        this.chart.data.datasets = datasets;
        this.chart.options.scales.y.title.text = `Static Pressure (${unitLabel})`;
        
        // Plugin handles axis limits automatically
        this.chart.update();
    }

    updateOperatingPoint(intersection) {
        const display = document.getElementById('operating-point-display');
        
        if (intersection) {
            const unitLabel = this.state.units === 'inches' ? 'in H₂O' : 'mm H₂O';
            const pressureDecimals = this.state.units === 'inches' ? 3 : 2;
            display.innerHTML = `
                <div class="operating-point-data">
                    <p>Airflow: <span class="cfm">${intersection.cfm.toFixed(1)} CFM</span></p>
                    <p>Pressure: <span class="pressure">${intersection.pressure.toFixed(pressureDecimals)} ${unitLabel}</span></p>
                </div>
            `;
        } else if (this.state.selectedFan && this.state.selectedFilter && this.state.selectedFilterSize !== null) {
            display.innerHTML = '<p style="color: #dc2626;">No stable operating point found</p>';
        } else {
            display.innerHTML = '<p>Select fan and filter to see operating point</p>';
        }
    }

    updateURL() {
        const params = new URLSearchParams();
        if (this.state.selectedFan) params.set('fan', this.state.selectedFan);
        if (this.state.fanQuantity > 1) params.set('fanQty', this.state.fanQuantity);
        if (this.state.selectedFilter) params.set('filter', this.state.selectedFilter);
        if (this.state.selectedFilterSize !== null) {
            // Use filter size label instead of index
            const filter = this.data.filters.find(f => f.id === this.state.selectedFilter);
            if (filter && filter.availableSizes && filter.availableSizes[this.state.selectedFilterSize]) {
                const sizeLabel = filter.availableSizes[this.state.selectedFilterSize].label;
                params.set('filterSize', sizeLabel);
            }
        }
        if (this.state.filterQuantity > 1) params.set('filterQty', this.state.filterQuantity);
        
        const newURL = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
        window.history.replaceState(null, '', newURL);
    }

    loadFromURL() {
        const params = new URLSearchParams(window.location.search);
        
        if (params.has('fan')) {
            this.state.selectedFan = params.get('fan');
            document.getElementById('fan-select').value = this.state.selectedFan;
        }
        
        if (params.has('fanQty')) {
            this.state.fanQuantity = parseInt(params.get('fanQty'));
            document.getElementById('fan-quantity').value = this.state.fanQuantity;
        }
        
        if (params.has('filter')) {
            this.state.selectedFilter = params.get('filter');
            document.getElementById('filter-select').value = this.state.selectedFilter;
            this.populateFilterSizes();
        }
        
        if (params.has('filterSize')) {
            const filterSizeLabel = params.get('filterSize');
            // Find the index of the filter size by its label
            if (this.state.selectedFilter) {
                const filter = this.data.filters.find(f => f.id === this.state.selectedFilter);
                if (filter && filter.availableSizes) {
                    const sizeIndex = filter.availableSizes.findIndex(size => size.label === filterSizeLabel);
                    if (sizeIndex !== -1) {
                        this.state.selectedFilterSize = sizeIndex.toString();
                        document.getElementById('filter-size').value = this.state.selectedFilterSize;
                    }
                }
            }
        }
        
        if (params.has('filterQty')) {
            this.state.filterQuantity = parseInt(params.get('filterQty'));
            document.getElementById('filter-quantity').value = this.state.filterQuantity;
        }
        
        this.updateCalculation();
    }


    copyShareLink() {
        const shareUrl = window.location.href;
        navigator.clipboard.writeText(shareUrl).then(() => {
            this.showCopyNotification();
        });
    }

    showCopyNotification() {
        // Remove any existing notification
        const existingNotification = document.getElementById('copy-notification');
        if (existingNotification) {
            existingNotification.remove();
        }

        // Create notification element
        const notification = document.createElement('div');
        notification.id = 'copy-notification';
        notification.textContent = 'Link copied to clipboard';
        notification.className = 'copy-notification';

        // Position it next to the share button
        const shareButton = document.getElementById('share-build');
        shareButton.parentElement.appendChild(notification);

        // Remove after 2 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 2000);
    }

    showError(message) {
        const container = document.querySelector('.container');
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = 'background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; padding: 1rem; border-radius: 6px; margin-bottom: 1rem;';
        errorDiv.textContent = message;
        container.insertBefore(errorDiv, container.firstChild);
    }
}

let calculator;

document.addEventListener('DOMContentLoaded', () => {
    calculator = new PQCalculator();
});