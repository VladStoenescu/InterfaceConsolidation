/**
 * Test Data Generator for Interface Consolidation Tool
 * Generates realistic test data for UAT testing
 */

const TestDataGenerator = (function() {
    'use strict';

    // Sample system prefixes and suffixes for realistic names
    const SYSTEM_PREFIXES = [
        'CRM', 'ERP', 'HR', 'Finance', 'Sales', 'Marketing', 'Inventory',
        'Customer', 'Payment', 'Billing', 'Analytics', 'Reporting',
        'Order', 'Shipping', 'Warehouse', 'Supply', 'Product', 'Service'
    ];

    const SYSTEM_SUFFIXES = [
        'System', 'Platform', 'Portal', 'Service', 'Hub', 'Manager',
        'Engine', 'Gateway', 'API', 'Database', 'App', 'Suite'
    ];

    // Integration patterns as defined in the application
    const INTEGRATION_PATTERNS = [
        'Direct DB Connection',
        'Web Service',
        'API',
        'Streaming',
        'Real-time',
        'File Transfer',
        'Messaging',
        'Message Queue',
        'UI Interaction',
        'Batch'
    ];

    // Frequencies as defined in the application
    const FREQUENCIES = [
        'Daily',
        'Weekly',
        'Monthly',
        'Yearly',
        'On Demand',
        'Hourly',
        'Real-time'
    ];

    // Data formats
    const DATA_FORMATS = [
        'CSV',
        'XML',
        'JSON',
        'PDF',
        'TXT',
        'Excel',
        'Parquet',
        'Avro',
        'Binary'
    ];

    // Description templates
    const DESCRIPTION_TEMPLATES = [
        'Synchronizes {dataFormat} data from {from} to {to} using {pattern}',
        'Transfers {dataFormat} files {frequency} for reporting purposes',
        'Real-time integration for {dataFormat} data exchange',
        'Batch processing of {dataFormat} records on a {frequency} schedule',
        'API-based {dataFormat} data feed for {to} system',
        'Automated {frequency} data sync via {pattern}',
        'Legacy {pattern} integration migrating to modern API',
        'Critical {frequency} data transfer for business operations'
    ];

    /**
     * Generate a random system name
     */
    function generateSystemName() {
        const prefix = SYSTEM_PREFIXES[Math.floor(Math.random() * SYSTEM_PREFIXES.length)];
        const suffix = SYSTEM_SUFFIXES[Math.floor(Math.random() * SYSTEM_SUFFIXES.length)];
        return `${prefix} ${suffix}`;
    }

    /**
     * Generate a set of unique system names
     */
    function generateSystems(count) {
        const systems = new Set();
        let attempts = 0;
        const maxAttempts = count * 10; // Prevent infinite loop

        while (systems.size < count && attempts < maxAttempts) {
            systems.add(generateSystemName());
            attempts++;
        }

        return Array.from(systems);
    }

    /**
     * Generate a random description
     */
    function generateDescription(from, to, pattern, frequency, dataFormat) {
        const template = DESCRIPTION_TEMPLATES[Math.floor(Math.random() * DESCRIPTION_TEMPLATES.length)];
        return template
            .replace('{from}', from)
            .replace('{to}', to)
            .replace('{pattern}', pattern)
            .replace('{frequency}', frequency.toLowerCase())
            .replace('{dataFormat}', dataFormat);
    }

    /**
     * Generate test data
     * @param {Object} options - Configuration options
     * @param {number} options.systemCount - Number of systems to generate (default: 10)
     * @param {number} options.connectionCount - Number of connections to generate (default: 20)
     * @param {number} options.coreSystemCount - Number of core systems (Level 1) (default: 3)
     * @param {boolean} options.includeDescriptions - Whether to include descriptions (default: true)
     * @param {number} options.dataQuality - Data quality percentage 0-100 (default: 90)
     * @returns {Object} Generated data with connections and core systems
     */
    function generateTestData(options = {}) {
        const {
            systemCount = 10,
            connectionCount = 20,
            coreSystemCount = 3,
            includeDescriptions = true,
            dataQuality = 90
        } = options;

        // Validate inputs
        if (systemCount < 2) {
            throw new Error('System count must be at least 2');
        }
        if (coreSystemCount > systemCount) {
            throw new Error('Core system count cannot exceed total system count');
        }
        if (dataQuality < 0 || dataQuality > 100) {
            throw new Error('Data quality must be between 0 and 100');
        }

        // Generate systems
        const systems = generateSystems(systemCount);
        const coreApplications = systems.slice(0, coreSystemCount);

        // Generate connections
        const connections = [];
        const usedPairs = new Set();

        for (let i = 0; i < connectionCount; i++) {
            let fromSystem, toSystem, pairKey;
            let attempts = 0;
            const maxAttempts = connectionCount * 10;

            // Find unique connection pair
            do {
                fromSystem = systems[Math.floor(Math.random() * systems.length)];
                toSystem = systems[Math.floor(Math.random() * systems.length)];
                pairKey = `${fromSystem}→${toSystem}`;
                attempts++;
            } while ((fromSystem === toSystem || usedPairs.has(pairKey)) && attempts < maxAttempts);

            if (attempts >= maxAttempts) {
                console.warn('Could not generate all unique connections, stopping at', connections.length);
                break;
            }

            usedPairs.add(pairKey);

            // Apply data quality - some fields might be empty based on quality percentage
            const hasFullData = Math.random() * 100 < dataQuality;

            const integrationPattern = hasFullData 
                ? INTEGRATION_PATTERNS[Math.floor(Math.random() * INTEGRATION_PATTERNS.length)]
                : (Math.random() > 0.5 ? INTEGRATION_PATTERNS[Math.floor(Math.random() * INTEGRATION_PATTERNS.length)] : '');

            const frequency = hasFullData
                ? FREQUENCIES[Math.floor(Math.random() * FREQUENCIES.length)]
                : (Math.random() > 0.5 ? FREQUENCIES[Math.floor(Math.random() * FREQUENCIES.length)] : '');

            const dataFormat = hasFullData
                ? DATA_FORMATS[Math.floor(Math.random() * DATA_FORMATS.length)]
                : (Math.random() > 0.5 ? DATA_FORMATS[Math.floor(Math.random() * DATA_FORMATS.length)] : '');

            const description = includeDescriptions && hasFullData
                ? generateDescription(fromSystem, toSystem, integrationPattern || 'integration', frequency || 'scheduled', dataFormat || 'data')
                : '';

            connections.push({
                'From App Key': fromSystem,
                'To App Key': toSystem,
                'Data Format': dataFormat,
                'Frequency': frequency,
                'Integration Pattern': integrationPattern,
                'Description': description
            });
        }

        return {
            connections,
            coreApplications: coreApplications.map(app => ({ 'Application': app }))
        };
    }

    /**
     * Export data to Excel format using XLSX library
     * @param {Array} data - Array of connection objects
     * @param {string} filename - Output filename
     */
    function exportToExcel(data, filename) {
        if (typeof XLSX === 'undefined') {
            throw new Error('XLSX library not loaded');
        }

        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Interfaces');

        // Generate and download file
        XLSX.writeFile(workbook, filename);
    }

    /**
     * Export core applications to CSV
     * @param {Array} coreApps - Array of core application objects
     * @param {string} filename - Output filename
     */
    function exportCoreApplicationsToCSV(coreApps, filename) {
        // Create CSV content
        let csvContent = 'Application\n';
        coreApps.forEach(app => {
            csvContent += `${app.Application}\n`;
        });

        // Create blob and download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);

        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // Public API
    return {
        generateTestData,
        exportToExcel,
        exportCoreApplicationsToCSV
    };
})();

// Make available globally
if (typeof window !== 'undefined') {
    window.TestDataGenerator = TestDataGenerator;
}
