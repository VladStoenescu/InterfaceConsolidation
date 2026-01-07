// Global variables
let currentData = null;
let filteredData = null; // Store filtered data
let activeFilters = {
    integrationPattern: 'all',
    frequency: 'all'
};
let isDragging = false;
let draggedNode = null;
let offsetX = 0;
let offsetY = 0;
let zoom = 1;
let panX = 0;
let panY = 0;
let versions = [];
let currentVersionId = null;
let comparisonMode = false;
let comparisonData = null;

// Constants for visual styling
const CHAR_WIDTH_ESTIMATE = 8; // Estimated pixels per character for font size 14
const TEXT_BG_PADDING = 2; // Padding around text labels
const TEXT_MEASUREMENT_DELAY = 100; // Delay for getBBox to work correctly
const DEFAULT_TEXT_WIDTH = 40; // Default width when getBBox unavailable
const DEFAULT_TEXT_HEIGHT = 15; // Default height when getBBox unavailable
const NODE_PADDING = 10; // Padding inside node boxes
const NODE_HEIGHT = 40; // Height of node boxes
const EDGE_LABEL_LINE_HEIGHT = 13; // Line height for multi-line edge labels
const EDGE_LABEL_CHAR_WIDTH = 7; // Character width for edge label text

// Constants for force-directed layout algorithm
const LAYOUT_GRID_RANDOM_OFFSET = 20; // Random offset in pixels for initial grid positioning
const LAYOUT_SCALING_DIVISOR = 50; // Divisor for scaling iterations and repulsion based on node count

/**
 * Show loading spinner
 */
function showLoading() {
    document.getElementById('loadingSpinner').classList.add('active');
    document.getElementById('spinnerBackdrop').classList.add('active');
}

/**
 * Hide loading spinner
 */
function hideLoading() {
    document.getElementById('loadingSpinner').classList.remove('active');
    document.getElementById('spinnerBackdrop').classList.remove('active');
}

/**
 * Handle file upload and process Excel file
 */
function handleFileUpload() {
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];
    
    if (!file) {
        showStatus('Please select a file first', 'error');
        return;
    }
    
    showLoading();
    showStatus('Processing file...', 'info');
    
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            
            // Get the first sheet
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            
            // Convert to JSON
            const jsonData = XLSX.utils.sheet_to_json(worksheet);
            
            if (jsonData.length === 0) {
                hideLoading();
                showStatus('No data found in the Excel file', 'error');
                return;
            }
            
            // Process and visualize the data
            processAndVisualize(jsonData);
            hideLoading();
            
        } catch (error) {
            hideLoading();
            showStatus('Error processing file: ' + error.message, 'error');
            console.error(error);
        }
    };
    
    reader.onerror = function() {
        hideLoading();
        showStatus('Error reading file', 'error');
    };
    
    reader.readAsArrayBuffer(file);
}

/**
 * Process Excel data and create visualization
 */
function processAndVisualize(data) {
    try {
        const { nodes, edges } = extractNodesAndEdges(data);
        
        if (nodes.length === 0) {
            showStatus('No valid data found. Please ensure the file has "From App Key" and "To App Key" columns.', 'error');
            return;
        }
        
        currentData = { nodes, edges };
        createNetworkVisualization(nodes, edges);
        showStatus(`Successfully loaded ${edges.length} interfaces between ${nodes.length} systems`, 'success');
        
        // Update network stats
        updateNetworkStats(nodes, edges);
        
        // Enable version controls
        enableVersionControls();
        
        // Show legend and filters
        document.getElementById('legend').style.display = 'block';
        document.getElementById('filterSection').style.display = 'block';
        
    } catch (error) {
        showStatus('Error creating visualization: ' + error.message, 'error');
        console.error(error);
    }
}

/**
 * Update network statistics display
 * @param {Array} nodes - Array of network node objects with id and label properties
 * @param {Array} edges - Array of network edge objects with integration pattern information
 */
function updateNetworkStats(nodes, edges) {
    // Count unique integration patterns
    const patterns = new Set();
    edges.forEach(edge => {
        if (edge.integrationPattern && edge.integrationPattern.toLowerCase() !== 'unknown') {
            patterns.add(edge.integrationPattern);
        }
    });
    
    // Update stats
    document.getElementById('statSystems').textContent = nodes.length;
    document.getElementById('statInterfaces').textContent = edges.length;
    document.getElementById('statTypes').textContent = patterns.size;
    
    // Show stats section
    document.getElementById('networkStats').style.display = 'flex';
}

/**
 * Extract nodes and edges from data with consolidation
 */
function extractNodesAndEdges(data) {
    const nodesMap = new Map();
    const edgeMap = new Map(); // Map to consolidate edges by from-to pair
    
    data.forEach((row, index) => {
        // Extract the required fields (case-insensitive)
        const fromApp = getFieldValue(row, ['From App Key', 'from app key', 'FROM APP KEY', 'FromAppKey', 'Source']);
        const toApp = getFieldValue(row, ['To App Key', 'to app key', 'TO APP KEY', 'ToAppKey', 'Target', 'Destination']);
        const dataForm = getFieldValue(row, ['Data Form', 'data form', 'DATA FORM', 'DataForm', 'Format', 'Type']) || 'Unknown';
        const frequency = getFieldValue(row, ['Frequency', 'frequency', 'FREQUENCY', 'Freq']) || 'Unknown';
        // Support both "Integration Pattern" (new) and "Communication Type" (legacy)
        const integrationPattern = getFieldValue(row, ['Integration Pattern', 'integration pattern', 'INTEGRATION PATTERN', 'IntegrationPattern', 'Communication Type', 'communication type', 'COMMUNICATION TYPE', 'CommunicationType', 'Comm Type', 'Type', 'Mode']) || 'Unknown';
        const description = getFieldValue(row, ['Description', 'description', 'DESCRIPTION', 'Desc', 'desc']) || '';
        
        // Skip rows without required fields
        if (!fromApp || !toApp) {
            return;
        }
        
        // Add nodes
        if (!nodesMap.has(fromApp)) {
            nodesMap.set(fromApp, {
                id: fromApp,
                label: fromApp
            });
        }
        
        if (!nodesMap.has(toApp)) {
            nodesMap.set(toApp, {
                id: toApp,
                label: toApp
            });
        }
        
        // Create unique key for this edge (from-to pair)
        // Using a more unique separator to avoid conflicts with application names
        const edgeKey = `${fromApp}\u0000${toApp}`;
        
        // Consolidate edges with same from-to pair
        if (!edgeMap.has(edgeKey)) {
            // First flow for this interface
            edgeMap.set(edgeKey, {
                from: fromApp,
                to: toApp,
                flows: [{
                    dataForm: dataForm,
                    frequency: frequency,
                    integrationPattern: integrationPattern,
                    description: description
                }]
            });
        } else {
            // Additional flow for existing interface
            edgeMap.get(edgeKey).flows.push({
                dataForm: dataForm,
                frequency: frequency,
                integrationPattern: integrationPattern,
                description: description
            });
        }
    });
    
    // Convert consolidated edges to final edge format
    const edges = [];
    edgeMap.forEach((edgeData) => {
        const flows = edgeData.flows;
        
        // Collect unique integration patterns
        const integrationPatterns = new Set();
        const patternMap = new Map(); // Map to store original casing
        flows.forEach(flow => {
            if (flow.integrationPattern && flow.integrationPattern !== 'Unknown') {
                const lowerPattern = flow.integrationPattern.toLowerCase();
                integrationPatterns.add(lowerPattern);
                if (!patternMap.has(lowerPattern)) {
                    patternMap.set(lowerPattern, flow.integrationPattern);
                }
            }
        });
        
        // Determine consolidated integration pattern
        let consolidatedPattern;
        if (integrationPatterns.size > 1) {
            // Multiple integration patterns = Mixed
            consolidatedPattern = 'Mixed';
        } else if (integrationPatterns.size === 1) {
            // Single integration pattern - use the original casing from the first occurrence
            const lowerPattern = [...integrationPatterns][0];
            consolidatedPattern = patternMap.get(lowerPattern);
        } else {
            // No valid integration pattern found
            consolidatedPattern = 'Unknown';
        }
        
        // Collect unique data forms and frequencies for label
        const dataForms = [...new Set(flows.map(f => f.dataForm))].filter(d => d !== 'Unknown');
        const frequencies = [...new Set(flows.map(f => f.frequency))].filter(f => f !== 'Unknown');
        
        // Collect all descriptions
        const descriptions = flows.map(f => f.description).filter(d => d && d.trim() !== '');
        
        // Create label showing integration pattern and data format
        const patternLabel = consolidatedPattern !== 'Unknown' ? consolidatedPattern : '';
        const dataLabel = dataForms.length > 0 ? dataForms.join(', ') : '';
        const label = patternLabel && dataLabel ? `${patternLabel}\n${dataLabel}` : (patternLabel || dataLabel || 'Unknown');
        
        // Create detailed tooltip with all flows
        let tooltip = `From: ${edgeData.from}\nTo: ${edgeData.to}\n`;
        tooltip += `Integration Pattern: ${consolidatedPattern}\n`;
        if (flows.length > 1) {
            tooltip += `\nConsolidated from ${flows.length} information flows:\n`;
            flows.forEach((flow, idx) => {
                tooltip += `\n  Flow ${idx + 1}:\n`;
                tooltip += `    Integration Pattern: ${flow.integrationPattern}\n`;
                tooltip += `    Data Format: ${flow.dataForm}\n`;
                tooltip += `    Frequency: ${flow.frequency}`;
                if (flow.description) {
                    tooltip += `\n    Description: ${flow.description}`;
                }
                if (idx < flows.length - 1) tooltip += '\n';
            });
        } else {
            tooltip += `Data Format: ${flows[0].dataForm}\n`;
            tooltip += `Frequency: ${flows[0].frequency}`;
            if (flows[0].description) {
                tooltip += `\nDescription: ${flows[0].description}`;
            }
        }
        
        edges.push({
            from: edgeData.from,
            to: edgeData.to,
            label: label,
            frequency: frequencies.length > 0 ? frequencies.join(', ') : 'Unknown',
            integrationPattern: consolidatedPattern,
            tooltip: tooltip,
            flowCount: flows.length,
            flows: flows, // Store all flows for reference
            descriptions: descriptions // Store descriptions for click events
        });
    });
    
    const nodes = Array.from(nodesMap.values());
    
    return { nodes, edges };
}

/**
 * Get field value with multiple possible keys (case-insensitive)
 */
function getFieldValue(row, possibleKeys) {
    for (const key of possibleKeys) {
        if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
            return row[key];
        }
    }
    // Try case-insensitive match
    const rowKeys = Object.keys(row);
    for (const key of possibleKeys) {
        const found = rowKeys.find(k => k.toLowerCase() === key.toLowerCase());
        if (found && row[found]) {
            return row[found];
        }
    }
    return null;
}

/**
 * Get edge styling based on integration pattern
 */
function getIntegrationPatternStyle(integrationPattern) {
    const pattern = integrationPattern.toLowerCase();
    
    // Direct DB Connection - solid thick line
    if (pattern.includes('direct') && pattern.includes('db')) {
        return {
            color: '#FF6B6B',
            width: 4,
            dasharray: '',
            opacity: 1
        };
    }
    
    // File Transfer - dotted line
    if (pattern.includes('file') || pattern.includes('ftp') || pattern.includes('sftp')) {
        return {
            color: '#AA96DA',
            width: 3,
            dasharray: '5,5',
            opacity: 1
        };
    }
    
    // Messaging / Message Queue - double dash
    if (pattern.includes('messag') || pattern.includes('queue') || pattern.includes('mq')) {
        return {
            color: '#FCBAD3',
            width: 3,
            dasharray: '12,3,3,3',
            opacity: 1
        };
    }
    
    // Streaming / Real-time - animated dotted line
    if (pattern.includes('stream') || pattern.includes('real-time') || pattern.includes('realtime')) {
        return {
            color: '#95E1D3',
            width: 3,
            dasharray: '3,3',
            opacity: 1
        };
    }
    
    // UI Interaction - dash-dot pattern
    if (pattern.includes('ui') || pattern.includes('user interface') || pattern.includes('interaction')) {
        return {
            color: '#FFD93D',
            width: 3,
            dasharray: '8,3,2,3',
            opacity: 1
        };
    }
    
    // Web Service / API - dashed line
    if (pattern.includes('web') || pattern.includes('service') || pattern.includes('api') || pattern.includes('rest') || pattern.includes('soap') || pattern.includes('http')) {
        return {
            color: '#4ECDC4',
            width: 3,
            dasharray: '8,4',
            opacity: 1
        };
    }
    
    // Batch processing - thick solid line (legacy support)
    if (pattern.includes('batch')) {
        return {
            color: '#FF6B6B',
            width: 4,
            dasharray: '',
            opacity: 1
        };
    }
    
    // Mixed/Hybrid - alternating dash pattern
    if (pattern.includes('mixed') || pattern.includes('hybrid')) {
        return {
            color: '#F38181',
            width: 3,
            dasharray: '10,5,3,5',
            opacity: 1
        };
    }
    
    // Other / Unknown / Empty - thin gray line
    return {
        color: '#999999',
        width: 2,
        dasharray: '',
        opacity: 0.6
    };
}

/**
 * Show interface description in a modal
 * @param {Object} edge - The edge object containing interface information
 * @param {string} edge.from - Source system name
 * @param {string} edge.to - Target system name
 * @param {string} edge.integrationPattern - Overall integration pattern for the interface
 * @param {Array} edge.flows - Array of flow objects with individual details
 */
function showInterfaceDescription(edge) {
    // Create or get modal
    let modal = document.getElementById('descriptionModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'descriptionModal';
        modal.className = 'modal';
        modal.style.display = 'none';
        
        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content';
        
        const closeBtn = document.createElement('button');
        closeBtn.className = 'close-btn';
        closeBtn.textContent = '×';
        closeBtn.onclick = () => { modal.style.display = 'none'; };
        
        const modalBody = document.createElement('div');
        modalBody.id = 'descriptionModalBody';
        
        modalContent.appendChild(closeBtn);
        modalContent.appendChild(modalBody);
        modal.appendChild(modalContent);
        document.body.appendChild(modal);
    }
    
    // Populate modal content
    const modalBody = document.getElementById('descriptionModalBody');
    let html = `<h2>Interface Details</h2>`;
    html += `<div class="interface-info">`;
    html += `<p><strong>From:</strong> ${edge.from}</p>`;
    html += `<p><strong>To:</strong> ${edge.to}</p>`;
    html += `<p><strong>Integration Pattern:</strong> ${edge.integrationPattern}</p>`;
    html += `</div>`;
    
    if (edge.flows.length > 1) {
        html += `<h3>Information Flows (${edge.flows.length})</h3>`;
        edge.flows.forEach((flow, idx) => {
            html += `<div class="flow-detail">`;
            html += `<h4>Flow ${idx + 1}</h4>`;
            html += `<p><strong>Integration Pattern:</strong> ${flow.integrationPattern}</p>`;
            html += `<p><strong>Data Format:</strong> ${flow.dataForm}</p>`;
            html += `<p><strong>Frequency:</strong> ${flow.frequency}</p>`;
            if (flow.description) {
                html += `<p><strong>Description:</strong> ${flow.description}</p>`;
            }
            html += `</div>`;
        });
    } else {
        const flow = edge.flows[0];
        html += `<h3>Flow Details</h3>`;
        html += `<div class="flow-detail">`;
        html += `<p><strong>Data Format:</strong> ${flow.dataForm}</p>`;
        html += `<p><strong>Frequency:</strong> ${flow.frequency}</p>`;
        if (flow.description) {
            html += `<p><strong>Description:</strong> ${flow.description}</p>`;
        }
        html += `</div>`;
    }
    
    modalBody.innerHTML = html;
    modal.style.display = 'flex';
}

/**
 * Get edge styling based on frequency
 */
function getEdgeStyle(frequency) {
    const freq = frequency.toLowerCase();
    
    // Daily frequency - solid blue line, thicker
    if (freq.includes('daily') || freq.includes('day')) {
        return {
            color: '#2196F3',
            width: 3,
            dasharray: ''
        };
    }
    
    // Weekly frequency - dashed green line
    if (freq.includes('weekly') || freq.includes('week')) {
        return {
            color: '#4CAF50',
            width: 3,
            dasharray: '10,5'
        };
    }
    
    // Monthly frequency - dotted orange line
    if (freq.includes('monthly') || freq.includes('month')) {
        return {
            color: '#FF9800',
            width: 3,
            dasharray: '2,5'
        };
    }
    
    // Yearly frequency - solid gray line
    if (freq.includes('yearly') || freq.includes('year') || freq.includes('annual')) {
        return {
            color: '#9E9E9E',
            width: 3,
            dasharray: ''
        };
    }
    
    // On demand - solid pink line, thinner
    if (freq.includes('demand') || freq.includes('ad hoc') || freq.includes('adhoc')) {
        return {
            color: '#E91E63',
            width: 2,
            dasharray: ''
        };
    }
    
    // Default/Unknown - solid gray line, thin
    return {
        color: '#607D8B',
        width: 2,
        dasharray: ''
    };
}

/**
 * Calculate curve control points for quadratic bezier curve between two positions
 */
function calculateCurveControlPoint(fromPos, toPos) {
    const dx = toPos.x - fromPos.x;
    const dy = toPos.y - fromPos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Curve offset perpendicular to the line (creates curved paths)
    // Use a more pronounced curve for better visual separation
    const curveOffset = Math.min(distance * 0.25, 80);
    const midX = (fromPos.x + toPos.x) / 2;
    const midY = (fromPos.y + toPos.y) / 2;
    
    // Perpendicular offset
    const perpX = -dy / distance * curveOffset;
    const perpY = dx / distance * curveOffset;
    
    return {
        controlX: midX + perpX,
        controlY: midY + perpY,
        midX,
        midY,
        perpX,
        perpY
    };
}

/**
 * Create network visualization using SVG
 */
function createNetworkVisualization(nodes, edges) {
    const container = document.getElementById('network');
    const svg = document.getElementById('networkSvg');
    
    // Clear previous content
    svg.innerHTML = '';
    
    // Get container dimensions
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    // Position nodes in a circle
    const positions = calculateNodePositions(nodes, width, height);
    
    // Create SVG group for zooming/panning
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('id', 'mainGroup');
    svg.appendChild(g);
    
    // Create defs for gradients and filters
    let defs = svg.querySelector('defs');
    if (!defs) {
        defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        svg.insertBefore(defs, g);
    }
    
    // Clear existing defs
    defs.innerHTML = '';
    
    // Create node gradient
    const nodeGradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    nodeGradient.setAttribute('id', 'nodeGradient');
    nodeGradient.setAttribute('x1', '0%');
    nodeGradient.setAttribute('y1', '0%');
    nodeGradient.setAttribute('x2', '100%');
    nodeGradient.setAttribute('y2', '100%');
    nodeGradient.innerHTML = `
        <stop offset="0%" style="stop-color:rgba(0, 212, 255, 0.3);stop-opacity:1" />
        <stop offset="100%" style="stop-color:rgba(168, 85, 247, 0.3);stop-opacity:1" />
    `;
    defs.appendChild(nodeGradient);
    
    // Create node stroke gradient
    const nodeStrokeGradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    nodeStrokeGradient.setAttribute('id', 'nodeStrokeGradient');
    nodeStrokeGradient.setAttribute('x1', '0%');
    nodeStrokeGradient.setAttribute('y1', '0%');
    nodeStrokeGradient.setAttribute('x2', '100%');
    nodeStrokeGradient.setAttribute('y2', '100%');
    nodeStrokeGradient.innerHTML = `
        <stop offset="0%" style="stop-color:#00d4ff;stop-opacity:1" />
        <stop offset="100%" style="stop-color:#a855f7;stop-opacity:1" />
    `;
    defs.appendChild(nodeStrokeGradient);
    
    // Create glow filter for nodes
    const nodeGlow = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
    nodeGlow.setAttribute('id', 'nodeGlow');
    nodeGlow.setAttribute('x', '-50%');
    nodeGlow.setAttribute('y', '-50%');
    nodeGlow.setAttribute('width', '200%');
    nodeGlow.setAttribute('height', '200%');
    nodeGlow.innerHTML = `
        <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur"/>
        <feColorMatrix in="blur" type="matrix" values="0 0 0 0 0.4 0 0 0 0 0.6 0 0 0 0 1 0 0 0 0.5 0" result="glow"/>
        <feMerge>
            <feMergeNode in="glow"/>
            <feMergeNode in="SourceGraphic"/>
        </feMerge>
    `;
    defs.appendChild(nodeGlow);
    
    // Create glow filter for text
    const textGlow = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
    textGlow.setAttribute('id', 'textGlow');
    textGlow.innerHTML = `
        <feGaussianBlur in="SourceGraphic" stdDeviation="1" result="blur"/>
        <feMerge>
            <feMergeNode in="blur"/>
            <feMergeNode in="SourceGraphic"/>
        </feMerge>
    `;
    defs.appendChild(textGlow);
    
    // Draw edges with curves
    edges.forEach(edge => {
        const fromPos = positions[edge.from];
        const toPos = positions[edge.to];
        
        if (!fromPos || !toPos) return;
        
        // Use integration pattern for styling if available, otherwise fall back to frequency
        const hasValidPattern = edge.integrationPattern && 
            edge.integrationPattern.toLowerCase() !== 'unknown';
        const style = hasValidPattern
            ? getIntegrationPatternStyle(edge.integrationPattern)
            : getEdgeStyle(edge.frequency);
        
        // Create arrow marker
        const markerId = `arrow-${edge.from}-${edge.to}-${Math.random().toString(36).substr(2, 9)}`;
        createArrowMarker(svg, markerId, style.color);
        
        // Calculate curve control points
        const { controlX, controlY, midX, midY, perpX, perpY } = calculateCurveControlPoint(fromPos, toPos);
        
        // Create curved path instead of straight line
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const pathData = `M ${fromPos.x} ${fromPos.y} Q ${controlX} ${controlY} ${toPos.x} ${toPos.y}`;
        path.setAttribute('d', pathData);
        path.setAttribute('stroke', style.color);
        path.setAttribute('stroke-width', style.width);
        path.setAttribute('fill', 'none');
        if (style.opacity) {
            path.setAttribute('opacity', style.opacity);
        }
        if (style.dasharray) {
            path.setAttribute('stroke-dasharray', style.dasharray);
        }
        path.setAttribute('marker-end', `url(#${markerId})`);
        
        const pathTitle = document.createElementNS('http://www.w3.org/2000/svg', 'title');
        pathTitle.textContent = edge.tooltip;
        path.appendChild(pathTitle);
        
        g.appendChild(path);
        
        // Position label along the curve (at the control point offset)
        const labelX = midX + perpX * 0.6;
        const labelY = midY + perpY * 0.6;
        
        // Split label into lines (integration pattern and data format)
        const labelLines = edge.label.split('\n');
        
        // Create text group for multi-line support
        const textGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        
        // Calculate total height needed
        const totalHeight = labelLines.length * EDGE_LABEL_LINE_HEIGHT;
        const startY = labelY - (totalHeight / 2) + EDGE_LABEL_LINE_HEIGHT / 2;
        
        // Create background rect (will be sized after text is rendered)
        const textBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        textBg.setAttribute('fill', 'rgba(10, 14, 39, 0.85)');
        textBg.setAttribute('stroke', 'rgba(0, 212, 255, 0.3)');
        textBg.setAttribute('stroke-width', '1');
        textBg.setAttribute('rx', '4');
        
        let maxWidth = 0;
        
        // Create each line of text
        labelLines.forEach((line, index) => {
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', labelX);
            text.setAttribute('y', startY + (index * EDGE_LABEL_LINE_HEIGHT));
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('font-size', '11');
            text.setAttribute('font-weight', index === 0 ? '700' : '600'); // First line (pattern) bolder
            text.setAttribute('fill', '#ffffff');
            text.setAttribute('filter', 'url(#textGlow)');
            text.textContent = line;
            textGroup.appendChild(text);
            
            // Track max width for background
            const estimatedWidth = line.length * EDGE_LABEL_CHAR_WIDTH;
            if (estimatedWidth > maxWidth) maxWidth = estimatedWidth;
        });
        
        // Set background dimensions
        textBg.setAttribute('x', labelX - maxWidth/2 - TEXT_BG_PADDING);
        textBg.setAttribute('y', startY - EDGE_LABEL_LINE_HEIGHT + TEXT_BG_PADDING);
        textBg.setAttribute('width', maxWidth + TEXT_BG_PADDING * 2);
        textBg.setAttribute('height', totalHeight + TEXT_BG_PADDING * 2);
        
        // Update with actual dimensions after a delay to allow DOM to render
        setTimeout(() => {
            const texts = textGroup.querySelectorAll('text');
            let actualMaxWidth = 0;
            texts.forEach(text => {
                try {
                    const bbox = text.getBBox();
                    if (bbox.width > actualMaxWidth) actualMaxWidth = bbox.width;
                } catch(e) {
                    // getBBox may fail in some contexts
                }
            });
            if (actualMaxWidth > 0) {
                textBg.setAttribute('x', labelX - actualMaxWidth/2 - TEXT_BG_PADDING);
                textBg.setAttribute('width', actualMaxWidth + TEXT_BG_PADDING * 2);
            }
        }, TEXT_MEASUREMENT_DELAY);
        
        textGroup.insertBefore(textBg, textGroup.firstChild);
        
        // Add tooltip to the entire group
        const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
        title.textContent = edge.tooltip;
        textGroup.appendChild(title);
        
        // Make edge clickable if it has descriptions
        if (edge.descriptions && edge.descriptions.length > 0) {
            textGroup.style.cursor = 'pointer';
            textGroup.addEventListener('click', () => showInterfaceDescription(edge));
        }
        
        g.appendChild(textGroup);
    });
    
    // Draw nodes
    nodes.forEach(node => {
        const pos = positions[node.id];
        
        if (!pos) return;
        
        // Create node group
        const nodeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        nodeGroup.setAttribute('class', 'node');
        nodeGroup.setAttribute('data-id', node.id);
        nodeGroup.style.cursor = 'move';
        
        // Create rectangle with gradient
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        const textWidth = node.label.length * CHAR_WIDTH_ESTIMATE;
        rect.setAttribute('x', pos.x - textWidth / 2 - NODE_PADDING);
        rect.setAttribute('y', pos.y - NODE_HEIGHT / 2);
        rect.setAttribute('width', textWidth + NODE_PADDING * 2);
        rect.setAttribute('height', NODE_HEIGHT);
        rect.setAttribute('fill', 'url(#nodeGradient)');
        rect.setAttribute('stroke', 'url(#nodeStrokeGradient)');
        rect.setAttribute('stroke-width', '2');
        rect.setAttribute('rx', '8');
        rect.setAttribute('filter', 'url(#nodeGlow)');
        
        // Create text with shadow
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', pos.x);
        text.setAttribute('y', pos.y + 5);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('font-size', '14');
        text.setAttribute('font-weight', '600');
        text.setAttribute('fill', '#ffffff');
        text.setAttribute('filter', 'url(#textGlow)');
        text.textContent = node.label;
        
        nodeGroup.appendChild(rect);
        nodeGroup.appendChild(text);
        
        // Store position data
        nodeGroup.dataset.x = pos.x;
        nodeGroup.dataset.y = pos.y;
        
        // Add drag handlers
        nodeGroup.addEventListener('mousedown', startDrag);
        
        g.appendChild(nodeGroup);
    });
    
    // Add zoom/pan handlers
    svg.addEventListener('wheel', handleZoom);
}

/**
 * Calculate positions for nodes using force-directed layout
 */
function calculateNodePositions(nodes, width, height) {
    const positions = {};
    const centerX = width / 2;
    const centerY = height / 2;
    
    if (nodes.length === 1) {
        positions[nodes[0].id] = { x: centerX, y: centerY };
        return positions;
    }
    
    // Initialize nodes with grid-based positions for better distribution with large datasets
    const margin = 100;
    const nodeCount = nodes.length;
    
    // Calculate grid dimensions - aim for roughly square grid
    const cols = Math.ceil(Math.sqrt(nodeCount));
    const rows = Math.ceil(nodeCount / cols);
    
    // Calculate spacing based on available area
    const availableWidth = width - 2 * margin;
    const availableHeight = height - 2 * margin;
    const cellWidth = availableWidth / cols;
    const cellHeight = availableHeight / rows;
    
    nodes.forEach((node, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);
        
        // Position node in grid cell with some randomization to avoid perfect alignment
        positions[node.id] = {
            x: margin + col * cellWidth + cellWidth / 2 + (Math.random() - 0.5) * LAYOUT_GRID_RANDOM_OFFSET,
            y: margin + row * cellHeight + cellHeight / 2 + (Math.random() - 0.5) * LAYOUT_GRID_RANDOM_OFFSET,
            vx: 0,
            vy: 0
        };
    });
    
    // Force-directed layout parameters - scale with node count for better results
    // More nodes need more iterations and different force parameters
    const baseIterations = 100;
    const iterations = Math.min(baseIterations + Math.floor(nodeCount / LAYOUT_SCALING_DIVISOR), 300);
    
    // Scale repulsion strength based on node count
    const baseRepulsion = 8000;
    const repulsionStrength = baseRepulsion * Math.max(1, Math.sqrt(nodeCount / LAYOUT_SCALING_DIVISOR));
    
    const attractionStrength = 0.01;
    const dampening = 0.85;
    const minDistance = 150; // Minimum distance between nodes
    
    // Build edge map for attraction forces
    const edgeMap = new Map();
    if (currentData && currentData.edges) {
        currentData.edges.forEach(edge => {
            if (!edgeMap.has(edge.from)) edgeMap.set(edge.from, []);
            if (!edgeMap.has(edge.to)) edgeMap.set(edge.to, []);
            edgeMap.get(edge.from).push(edge.to);
            edgeMap.get(edge.to).push(edge.from);
        });
    }
    
    // Run force-directed layout simulation
    for (let iter = 0; iter < iterations; iter++) {
        // Apply repulsion between all nodes
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const node1 = nodes[i];
                const node2 = nodes[j];
                const pos1 = positions[node1.id];
                const pos2 = positions[node2.id];
                
                const dx = pos2.x - pos1.x;
                const dy = pos2.y - pos1.y;
                const distance = Math.sqrt(dx * dx + dy * dy) || 1;
                
                // Strong repulsion force
                const force = repulsionStrength / (distance * distance);
                const fx = (dx / distance) * force;
                const fy = (dy / distance) * force;
                
                pos1.vx -= fx;
                pos1.vy -= fy;
                pos2.vx += fx;
                pos2.vy += fy;
            }
        }
        
        // Apply attraction for connected nodes
        if (edgeMap.size > 0) {
            nodes.forEach(node => {
                const neighbors = edgeMap.get(node.id) || [];
                const pos1 = positions[node.id];
                
                neighbors.forEach(neighborId => {
                    const pos2 = positions[neighborId];
                    if (!pos2) return;
                    
                    const dx = pos2.x - pos1.x;
                    const dy = pos2.y - pos1.y;
                    const distance = Math.sqrt(dx * dx + dy * dy) || 1;
                    
                    // Attraction force
                    const force = distance * attractionStrength;
                    const fx = (dx / distance) * force;
                    const fy = (dy / distance) * force;
                    
                    pos1.vx += fx;
                    pos1.vy += fy;
                });
            });
        }
        
        // Update positions with dampening
        nodes.forEach(node => {
            const pos = positions[node.id];
            pos.x += pos.vx;
            pos.y += pos.vy;
            pos.vx *= dampening;
            pos.vy *= dampening;
            
            // Keep within bounds with margin
            pos.x = Math.max(margin, Math.min(width - margin, pos.x));
            pos.y = Math.max(margin, Math.min(height - margin, pos.y));
        });
    }
    
    return positions;
}

/**
 * Create arrow marker for directed edges
 */
function createArrowMarker(svg, id, color) {
    let defs = svg.querySelector('defs');
    if (!defs) {
        defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        svg.insertBefore(defs, svg.firstChild);
    }
    
    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    marker.setAttribute('id', id);
    marker.setAttribute('markerWidth', '10');
    marker.setAttribute('markerHeight', '10');
    marker.setAttribute('refX', '9');
    marker.setAttribute('refY', '3');
    marker.setAttribute('orient', 'auto');
    marker.setAttribute('markerUnits', 'strokeWidth');
    
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M0,0 L0,6 L9,3 z');
    path.setAttribute('fill', color);
    
    marker.appendChild(path);
    defs.appendChild(marker);
}

/**
 * Handle node dragging
 */
function startDrag(e) {
    isDragging = true;
    draggedNode = e.currentTarget;
    const x = parseFloat(draggedNode.dataset.x);
    const y = parseFloat(draggedNode.dataset.y);
    offsetX = e.clientX - x;
    offsetY = e.clientY - y;
    
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', stopDrag);
    
    e.preventDefault();
}

function drag(e) {
    if (!isDragging || !draggedNode) return;
    
    const container = document.getElementById('network');
    const rect = container.getBoundingClientRect();
    
    const x = e.clientX - rect.left - offsetX;
    const y = e.clientY - rect.top - offsetY;
    
    draggedNode.dataset.x = x;
    draggedNode.dataset.y = y;
    
    const rect2 = draggedNode.querySelector('rect');
    const text = draggedNode.querySelector('text');
    const textWidth = text.textContent.length * CHAR_WIDTH_ESTIMATE;
    
    rect2.setAttribute('x', x - textWidth / 2 - NODE_PADDING);
    rect2.setAttribute('y', y - NODE_HEIGHT / 2);
    text.setAttribute('x', x);
    text.setAttribute('y', y + 5);
    
    // Update connected edges
    updateEdges();
}

function stopDrag() {
    isDragging = false;
    draggedNode = null;
    document.removeEventListener('mousemove', drag);
    document.removeEventListener('mouseup', stopDrag);
}

/**
 * Update edge positions
 */
function updateEdges() {
    if (!currentData) return;
    
    const svg = document.getElementById('networkSvg');
    const g = document.getElementById('mainGroup');
    if (!g) return;
    
    // Get all paths and text groups in the correct order
    const paths = g.querySelectorAll('path[d]');
    const nodes = svg.querySelectorAll('.node');
    
    const positions = {};
    nodes.forEach(node => {
        const id = node.dataset.id;
        positions[id] = {
            x: parseFloat(node.dataset.x),
            y: parseFloat(node.dataset.y)
        };
    });
    
    // Build a path-to-index map to avoid O(n²) indexOf operations
    const allChildren = Array.from(g.children);
    const pathIndexMap = new Map();
    paths.forEach((path, idx) => {
        const childIndex = allChildren.indexOf(path);
        if (childIndex >= 0) {
            pathIndexMap.set(idx, childIndex);
        }
    });
    
    let pathIndex = 0;
    currentData.edges.forEach(edge => {
        const fromPos = positions[edge.from];
        const toPos = positions[edge.to];
        
        if (!fromPos || !toPos || pathIndex >= paths.length) return;
        
        const path = paths[pathIndex];
        
        // Calculate curve control points
        const { controlX, controlY, midX, midY, perpX, perpY } = calculateCurveControlPoint(fromPos, toPos);
        
        const pathData = `M ${fromPos.x} ${fromPos.y} Q ${controlX} ${controlY} ${toPos.x} ${toPos.y}`;
        path.setAttribute('d', pathData);
        
        // Find the corresponding text group using the pre-built map
        const pathIndexInChildren = pathIndexMap.get(pathIndex);
        if (pathIndexInChildren !== undefined && pathIndexInChildren + 1 < allChildren.length) {
            const nextElement = allChildren[pathIndexInChildren + 1];
            if (nextElement.tagName === 'g' && nextElement.querySelector('text')) {
                // This is our text group - update its position
                const labelX = midX + perpX * 0.6;
                const labelY = midY + perpY * 0.6;
                
                // Get all text elements and the background rect
                const texts = nextElement.querySelectorAll('text');
                const rect = nextElement.querySelector('rect');
                
                if (texts.length > 0) {
                    // Split label into lines to recalculate positions
                    const labelLines = edge.label.split('\n');
                    const totalHeight = labelLines.length * EDGE_LABEL_LINE_HEIGHT;
                    const startY = labelY - (totalHeight / 2) + EDGE_LABEL_LINE_HEIGHT / 2;
                    
                    // Update each text element position
                    texts.forEach((text, index) => {
                        text.setAttribute('x', labelX);
                        text.setAttribute('y', startY + (index * EDGE_LABEL_LINE_HEIGHT));
                    });
                    
                    // Update background rect position if it exists
                    if (rect) {
                        // Calculate max width from text elements
                        let maxWidth = 0;
                        texts.forEach(text => {
                            const estimatedWidth = text.textContent.length * EDGE_LABEL_CHAR_WIDTH;
                            if (estimatedWidth > maxWidth) maxWidth = estimatedWidth;
                        });
                        
                        rect.setAttribute('x', labelX - maxWidth/2 - TEXT_BG_PADDING);
                        rect.setAttribute('y', startY - EDGE_LABEL_LINE_HEIGHT + TEXT_BG_PADDING);
                        rect.setAttribute('width', maxWidth + TEXT_BG_PADDING * 2);
                        rect.setAttribute('height', totalHeight + TEXT_BG_PADDING * 2);
                    }
                }
            }
        }
        
        pathIndex++;
    });
}

/**
 * Handle zoom
 */
function handleZoom(e) {
    e.preventDefault();
    
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    zoom *= delta;
    zoom = Math.max(0.1, Math.min(zoom, 5));
    
    const g = document.getElementById('mainGroup');
    if (g) {
        g.setAttribute('transform', `scale(${zoom})`);
    }
}

/**
 * Show status message to user
 */
function showStatus(message, type) {
    const statusDiv = document.getElementById('status');
    statusDiv.textContent = message;
    statusDiv.className = 'status ' + type;
    
    // Auto-hide success messages after 5 seconds
    if (type === 'success') {
        setTimeout(() => {
            statusDiv.textContent = '';
            statusDiv.className = 'status';
        }, 5000);
    }
}

/**
 * Handle filter change
 */
function handleFilterChange() {
    if (!currentData) return;
    
    const patternFilter = document.getElementById('commTypeFilter').value;
    const frequencyFilter = document.getElementById('frequencyFilter').value;
    
    activeFilters.integrationPattern = patternFilter;
    activeFilters.frequency = frequencyFilter;
    
    applyFilters();
}

/**
 * Check if an integration pattern matches the filter
 */
function matchesIntegrationPattern(pattern, filter) {
    if (!pattern) return false;
    const p = pattern.toLowerCase();
    
    // More precise matching based on filter value
    switch(filter) {
        case 'batch':
            return p === 'batch';
        case 'api':
            return p.includes('web') || p.includes('service') || p.includes('api') || p.includes('rest') || p.includes('soap');
        case 'streaming':
            return p.includes('stream') || p.includes('real-time') || p.includes('realtime');
        case 'file':
            return p.includes('file') || p.includes('ftp') || p.includes('sftp');
        case 'queue':
            return p.includes('queue') || p.includes('mq') || p.includes('messag');
        case 'mixed':
            return p === 'mixed' || p === 'hybrid';
        case 'db':
            return p.includes('db') || p.includes('database') || p.includes('direct');
        case 'ui':
            return p.includes('ui') || p.includes('interaction') || p.includes('user interface');
        default:
            return p.includes(filter);
    }
}

/**
 * Check if a frequency matches the filter
 */
function matchesFrequency(frequency, filter) {
    if (!frequency) return false;
    const freq = frequency.toLowerCase();
    
    // More precise matching based on filter value
    switch(filter) {
        case 'daily':
            return freq === 'daily' || freq === 'day';
        case 'weekly':
            return freq === 'weekly' || freq === 'week';
        case 'monthly':
            return freq === 'monthly' || freq === 'month';
        case 'yearly':
            return freq === 'yearly' || freq === 'year' || freq === 'annual' || freq === 'annually';
        case 'demand':
            return freq.includes('demand') || freq.includes('ad hoc') || freq.includes('adhoc');
        default:
            return freq.includes(filter);
    }
}

/**
 * Apply filters to the current data
 */
function applyFilters() {
    if (!currentData) return;
    
    let filteredEdges = currentData.edges;
    
    // Filter by integration pattern
    if (activeFilters.integrationPattern !== 'all') {
        filteredEdges = filteredEdges.filter(edge => 
            matchesIntegrationPattern(edge.integrationPattern, activeFilters.integrationPattern)
        );
    }
    
    // Filter by frequency
    if (activeFilters.frequency !== 'all') {
        filteredEdges = filteredEdges.filter(edge => 
            matchesFrequency(edge.frequency, activeFilters.frequency)
        );
    }
    
    // Get nodes that are connected by filtered edges
    const connectedNodeIds = new Set();
    filteredEdges.forEach(edge => {
        connectedNodeIds.add(edge.from);
        connectedNodeIds.add(edge.to);
    });
    
    const filteredNodes = currentData.nodes.filter(node => 
        connectedNodeIds.has(node.id)
    );
    
    // Update visualization with filtered data
    filteredData = { nodes: filteredNodes, edges: filteredEdges };
    createNetworkVisualization(filteredNodes, filteredEdges);
    
    // Update status
    const filterCount = filteredEdges.length;
    const totalCount = currentData.edges.length;
    showStatus(`Showing ${filterCount} of ${totalCount} interfaces`, 'info');
}

/**
 * Reset all filters
 */
function resetFilters() {
    document.getElementById('commTypeFilter').value = 'all';
    document.getElementById('frequencyFilter').value = 'all';
    activeFilters.integrationPattern = 'all';
    activeFilters.frequency = 'all';
    
    if (currentData) {
        filteredData = null;
        createNetworkVisualization(currentData.nodes, currentData.edges);
        showStatus(`Showing all ${currentData.edges.length} interfaces`, 'info');
    }
}


// Load sample data automatically for demo
document.addEventListener('DOMContentLoaded', function() {
    // Load sample data
    loadSampleData();
    
    // Load saved versions from localStorage
    loadVersionsFromStorage();
    updateVersionDropdowns();
    
    // Load theme preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
    }
});

/**
 * Toggle between light and dark theme
 */
function toggleTheme() {
    document.body.classList.toggle('light-theme');
    const isLight = document.body.classList.contains('light-theme');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
}

/**
 * Load sample data for demonstration
 */
function loadSampleData() {
    const sampleData = [
        {
            "From App Key": "CRM System",
            "To App Key": "Data Warehouse",
            "Data Form": "CSV",
            "Frequency": "Daily",
            "Integration Pattern": "Batch",
            "Description": "Daily customer data export for reporting"
        },
        // Duplicate flow: CRM System -> Data Warehouse with different integration pattern (should consolidate to Mixed)
        {
            "From App Key": "CRM System",
            "To App Key": "Data Warehouse",
            "Data Form": "XML",
            "Frequency": "Weekly",
            "Integration Pattern": "Web Service",
            "Description": "Weekly sales data sync via API"
        },
        {
            "From App Key": "CRM System",
            "To App Key": "Email Service",
            "Data Form": "XML",
            "Frequency": "On Demand",
            "Integration Pattern": "Web Service",
            "Description": "On-demand email notifications"
        },
        {
            "From App Key": "ERP System",
            "To App Key": "Data Warehouse",
            "Data Form": "CSV",
            "Frequency": "Daily",
            "Integration Pattern": "Direct DB Connection",
            "Description": "Direct database connection for transaction data"
        },
        {
            "From App Key": "ERP System",
            "To App Key": "Reporting Tool",
            "Data Form": "XML",
            "Frequency": "Weekly",
            "Integration Pattern": "File Transfer",
            "Description": "Weekly FTP transfer of reports"
        },
        {
            "From App Key": "Payment Gateway",
            "To App Key": "CRM System",
            "Data Form": "JSON",
            "Frequency": "Daily",
            "Integration Pattern": "Web Service",
            "Description": "Real-time payment notifications"
        },
        // Duplicate flow: Payment Gateway -> CRM System with different data form (should consolidate)
        {
            "From App Key": "Payment Gateway",
            "To App Key": "CRM System",
            "Data Form": "XML",
            "Frequency": "Weekly",
            "Integration Pattern": "Web Service",
            "Description": "Weekly payment summary reports"
        },
        {
            "From App Key": "Payment Gateway",
            "To App Key": "Audit System",
            "Data Form": "TXT",
            "Frequency": "Monthly",
            "Integration Pattern": "File Transfer",
            "Description": "Monthly audit logs via SFTP"
        },
        {
            "From App Key": "Mobile App",
            "To App Key": "API Gateway",
            "Data Form": "JSON",
            "Frequency": "Daily",
            "Integration Pattern": "Streaming",
            "Description": "Real-time user activity stream"
        },
        // Duplicate flow: Mobile App -> API Gateway with different integration pattern (should consolidate to Mixed)
        {
            "From App Key": "Mobile App",
            "To App Key": "API Gateway",
            "Data Form": "XML",
            "Frequency": "Weekly",
            "Integration Pattern": "Batch",
            "Description": "Weekly analytics batch upload"
        },
        {
            "From App Key": "API Gateway",
            "To App Key": "CRM System",
            "Data Form": "JSON",
            "Frequency": "Daily",
            "Integration Pattern": "Web Service",
            "Description": "API-based customer data sync"
        },
        {
            "From App Key": "API Gateway",
            "To App Key": "ERP System",
            "Data Form": "XML",
            "Frequency": "Daily",
            "Integration Pattern": "Web Service",
            "Description": "RESTful API for order processing"
        },
        {
            "From App Key": "Reporting Tool",
            "To App Key": "Dashboard",
            "Data Form": "PDF",
            "Frequency": "Weekly",
            "Integration Pattern": "File Transfer",
            "Description": "Weekly dashboard report generation"
        },
        {
            "From App Key": "Data Warehouse",
            "To App Key": "Analytics Platform",
            "Data Form": "CSV",
            "Frequency": "Daily",
            "Integration Pattern": "Direct DB Connection",
            "Description": "Direct database queries for analytics"
        },
        {
            "From App Key": "Analytics Platform",
            "To App Key": "Dashboard",
            "Data Form": "JSON",
            "Frequency": "Daily",
            "Integration Pattern": "Streaming",
            "Description": "Real-time analytics dashboard updates"
        }
    ];
    
    // Automatically visualize sample data
    setTimeout(() => {
        processAndVisualize(sampleData);
        showStatus('Sample data loaded. Upload an Excel file to visualize your own data.', 'info');
    }, 500);
}

// ==================== VERSION MANAGEMENT FUNCTIONS ====================

/**
 * Create a unique key for an edge
 */
function createEdgeKey(edge) {
    // Use the same separator as in extractNodesAndEdges for consistency
    return `${edge.from}\u0000${edge.to}`;
}

/**
 * Enable version control buttons
 */
function enableVersionControls() {
    document.getElementById('saveVersionBtn').disabled = false;
    document.getElementById('versionSelect').disabled = false;
    document.getElementById('compareBtn').disabled = versions.length < 2;
}

/**
 * Load versions from localStorage
 */
function loadVersionsFromStorage() {
    try {
        const savedVersions = localStorage.getItem('interfaceVersions');
        if (savedVersions) {
            versions = JSON.parse(savedVersions);
        }
    } catch (error) {
        console.error('Error loading versions:', error);
        versions = [];
    }
}

/**
 * Save versions to localStorage
 */
function saveVersionsToStorage() {
    try {
        localStorage.setItem('interfaceVersions', JSON.stringify(versions));
    } catch (error) {
        console.error('Error saving versions:', error);
        showStatus('Error saving version to storage', 'error');
    }
}

/**
 * Update version dropdown menus
 */
function updateVersionDropdowns() {
    const versionSelect = document.getElementById('versionSelect');
    const baseVersionSelect = document.getElementById('baseVersionSelect');
    const compareVersionSelect = document.getElementById('compareVersionSelect');
    
    // Clear existing options (except the first placeholder)
    versionSelect.innerHTML = '<option value="">Select a version...</option>';
    baseVersionSelect.innerHTML = '<option value="">Select base version...</option>';
    compareVersionSelect.innerHTML = '<option value="">Select version to compare...</option>';
    
    // Add version options
    versions.forEach((version, index) => {
        const option1 = document.createElement('option');
        option1.value = version.id;
        option1.textContent = `${version.name} (${new Date(version.timestamp).toLocaleDateString()})`;
        versionSelect.appendChild(option1);
        
        const option2 = option1.cloneNode(true);
        const option3 = option1.cloneNode(true);
        baseVersionSelect.appendChild(option2);
        compareVersionSelect.appendChild(option3);
    });
    
    // Enable/disable compare button
    document.getElementById('compareBtn').disabled = versions.length < 2;
}

/**
 * Show save version dialog
 */
function showSaveVersionDialog() {
    if (!currentData) {
        showStatus('No data to save', 'error');
        return;
    }
    
    document.getElementById('saveVersionDialog').style.display = 'flex';
    document.getElementById('versionName').value = '';
    document.getElementById('versionDescription').value = '';
    document.getElementById('versionName').focus();
}

/**
 * Close save version dialog
 */
function closeSaveVersionDialog() {
    document.getElementById('saveVersionDialog').style.display = 'none';
}

/**
 * Save current data as a version
 */
function saveVersion() {
    const name = document.getElementById('versionName').value.trim();
    const description = document.getElementById('versionDescription').value.trim();
    
    if (!name) {
        showStatus('Please enter a version name', 'error');
        return;
    }
    
    if (!currentData) {
        showStatus('No data to save', 'error');
        return;
    }
    
    const version = {
        id: 'v_' + Date.now(),
        name: name,
        description: description,
        timestamp: new Date().toISOString(),
        data: JSON.parse(JSON.stringify(currentData)) // Deep copy
    };
    
    versions.push(version);
    saveVersionsToStorage();
    updateVersionDropdowns();
    closeSaveVersionDialog();
    
    showStatus(`Version "${name}" saved successfully`, 'success');
}

/**
 * Handle version selection from dropdown
 */
function handleVersionSelection() {
    const versionId = document.getElementById('versionSelect').value;
    
    if (!versionId) {
        return;
    }
    
    const version = versions.find(v => v.id === versionId);
    
    if (!version) {
        showStatus('Version not found', 'error');
        return;
    }
    
    // Load the version data
    currentData = JSON.parse(JSON.stringify(version.data)); // Deep copy
    currentVersionId = versionId;
    comparisonMode = false;
    comparisonData = null;
    
    // Hide comparison results if visible
    document.getElementById('comparisonResults').style.display = 'none';
    
    // Refresh the current view based on which view is active
    if (currentView === 'network') {
        createNetworkVisualization(currentData.nodes, currentData.edges);
        // Update network stats
        updateNetworkStats(currentData.nodes, currentData.edges);
    } else if (currentView === 'dashboard') {
        initializeDashboard();
    } else if (currentView === 'executive') {
        initializeExecutiveView();
    }
    
    showStatus(`Loaded version: ${version.name}`, 'success');
}

/**
 * Show compare versions dialog
 */
function showCompareDialog() {
    if (versions.length < 2) {
        showStatus('Need at least 2 versions to compare', 'error');
        return;
    }
    
    document.getElementById('compareDialog').style.display = 'flex';
}

/**
 * Close compare versions dialog
 */
function closeCompareDialog() {
    document.getElementById('compareDialog').style.display = 'none';
}

/**
 * Compare two versions
 */
function compareVersions() {
    const baseVersionId = document.getElementById('baseVersionSelect').value;
    const compareVersionId = document.getElementById('compareVersionSelect').value;
    
    if (!baseVersionId || !compareVersionId) {
        showStatus('Please select both versions to compare', 'error');
        return;
    }
    
    if (baseVersionId === compareVersionId) {
        showStatus('Please select different versions to compare', 'error');
        return;
    }
    
    const baseVersion = versions.find(v => v.id === baseVersionId);
    const compareVersion = versions.find(v => v.id === compareVersionId);
    
    if (!baseVersion || !compareVersion) {
        showStatus('Version not found', 'error');
        return;
    }
    
    closeCompareDialog();
    
    // Calculate differences
    const diff = calculateVersionDifference(baseVersion.data, compareVersion.data);
    
    // Store comparison data
    comparisonMode = true;
    comparisonData = diff;
    
    // Display comparison results
    displayComparisonResults(baseVersion, compareVersion, diff);
    
    // Visualize with highlighting
    visualizeWithComparison(baseVersion.data, diff);
}

/**
 * Check if an edge has been modified by comparing its properties deeply
 */
function isEdgeModified(baseEdge, compareEdge) {
    // Compare basic properties with null safety
    if ((baseEdge.label || '') !== (compareEdge.label || '') || 
        (baseEdge.frequency || '') !== (compareEdge.frequency || '') ||
        (baseEdge.integrationPattern || '') !== (compareEdge.integrationPattern || '')) {
        return true;
    }
    
    // Check if flows existence differs
    const baseHasFlows = baseEdge.flows && Array.isArray(baseEdge.flows) && baseEdge.flows.length > 0;
    const compareHasFlows = compareEdge.flows && Array.isArray(compareEdge.flows) && compareEdge.flows.length > 0;
    
    if (baseHasFlows !== compareHasFlows) {
        return true;
    }
    
    // Compare flows array if both have flows
    if (baseHasFlows && compareHasFlows) {
        if (baseEdge.flows.length !== compareEdge.flows.length) {
            return true;
        }
        
        // Helper function to create normalized flow object
        const normalizeFlow = (f) => ({
            dataForm: f.dataForm || '',
            frequency: f.frequency || '',
            integrationPattern: f.integrationPattern || '',
            description: f.description || ''
        });
        
        // Create comparable representations of flows
        const normalizeAndSort = (flows) => {
            return flows.map(normalizeFlow).sort((a, b) => {
                const aStr = JSON.stringify(a);
                const bStr = JSON.stringify(b);
                return aStr.localeCompare(bStr);
            });
        };
        
        const baseFlowsStr = JSON.stringify(normalizeAndSort(baseEdge.flows));
        const compareFlowsStr = JSON.stringify(normalizeAndSort(compareEdge.flows));
        
        if (baseFlowsStr !== compareFlowsStr) {
            return true;
        }
    }
    
    return false;
}

/**
 * Calculate the difference between two versions
 */
function calculateVersionDifference(baseData, compareData) {
    const diff = {
        addedNodes: [],
        removedNodes: [],
        addedEdges: [],
        removedEdges: [],
        modifiedEdges: []
    };
    
    // Find added and removed nodes
    const baseNodeIds = new Set(baseData.nodes.map(n => n.id));
    const compareNodeIds = new Set(compareData.nodes.map(n => n.id));
    
    compareData.nodes.forEach(node => {
        if (!baseNodeIds.has(node.id)) {
            diff.addedNodes.push(node);
        }
    });
    
    baseData.nodes.forEach(node => {
        if (!compareNodeIds.has(node.id)) {
            diff.removedNodes.push(node);
        }
    });
    
    // Find added, removed, and modified edges
    const baseEdgeMap = new Map();
    baseData.edges.forEach(edge => {
        const key = createEdgeKey(edge);
        baseEdgeMap.set(key, edge);
    });
    
    const compareEdgeMap = new Map();
    compareData.edges.forEach(edge => {
        const key = createEdgeKey(edge);
        compareEdgeMap.set(key, edge);
    });
    
    // Find added edges
    compareEdgeMap.forEach((edge, key) => {
        if (!baseEdgeMap.has(key)) {
            diff.addedEdges.push(edge);
        } else {
            // Check if edge was modified
            const baseEdge = baseEdgeMap.get(key);
            if (isEdgeModified(baseEdge, edge)) {
                diff.modifiedEdges.push({
                    base: baseEdge,
                    compare: edge
                });
            }
        }
    });
    
    // Find removed edges
    baseEdgeMap.forEach((edge, key) => {
        if (!compareEdgeMap.has(key)) {
            diff.removedEdges.push(edge);
        }
    });
    
    return diff;
}

/**
 * Display comparison results
 */
function displayComparisonResults(baseVersion, compareVersion, diff) {
    const resultsDiv = document.getElementById('comparisonResults');
    const summaryDiv = document.getElementById('comparisonSummary');
    const detailsDiv = document.getElementById('comparisonDetails');
    
    // Create summary
    const totalChanges = diff.addedNodes.length + diff.removedNodes.length + 
                        diff.addedEdges.length + diff.removedEdges.length + 
                        diff.modifiedEdges.length;
    
    summaryDiv.innerHTML = `
        <p><strong>Comparing:</strong> ${baseVersion.name} → ${compareVersion.name}</p>
        <p><strong>Total Changes:</strong> ${totalChanges}</p>
        <p><strong>Nodes:</strong> +${diff.addedNodes.length} added, -${diff.removedNodes.length} removed</p>
        <p><strong>Connections:</strong> +${diff.addedEdges.length} added, -${diff.removedEdges.length} removed, ~${diff.modifiedEdges.length} modified</p>
    `;
    
    // Create detailed view
    let detailsHTML = '';
    
    if (diff.addedNodes.length > 0) {
        detailsHTML += '<div class="diff-section"><h4>Added Systems</h4>';
        diff.addedNodes.forEach(node => {
            detailsHTML += `<div class="diff-item added">+ ${node.label}</div>`;
        });
        detailsHTML += '</div>';
    }
    
    if (diff.removedNodes.length > 0) {
        detailsHTML += '<div class="diff-section"><h4>Removed Systems</h4>';
        diff.removedNodes.forEach(node => {
            detailsHTML += `<div class="diff-item removed">- ${node.label}</div>`;
        });
        detailsHTML += '</div>';
    }
    
    if (diff.addedEdges.length > 0) {
        detailsHTML += '<div class="diff-section"><h4>Added Connections</h4>';
        diff.addedEdges.forEach(edge => {
            detailsHTML += `<div class="diff-item added">+ ${edge.from} → ${edge.to} (${edge.label}, ${edge.frequency})</div>`;
        });
        detailsHTML += '</div>';
    }
    
    if (diff.removedEdges.length > 0) {
        detailsHTML += '<div class="diff-section"><h4>Removed Connections</h4>';
        diff.removedEdges.forEach(edge => {
            detailsHTML += `<div class="diff-item removed">- ${edge.from} → ${edge.to} (${edge.label}, ${edge.frequency})</div>`;
        });
        detailsHTML += '</div>';
    }
    
    if (diff.modifiedEdges.length > 0) {
        detailsHTML += '<div class="diff-section"><h4>Modified Connections</h4>';
        diff.modifiedEdges.forEach(mod => {
            detailsHTML += `<div class="diff-item modified">~ ${mod.base.from} → ${mod.base.to}<br>`;
            if (mod.base.label !== mod.compare.label) {
                detailsHTML += `&nbsp;&nbsp;Data Form: ${mod.base.label} → ${mod.compare.label}<br>`;
            }
            if (mod.base.frequency !== mod.compare.frequency) {
                detailsHTML += `&nbsp;&nbsp;Frequency: ${mod.base.frequency} → ${mod.compare.frequency}`;
            }
            detailsHTML += '</div>';
        });
        detailsHTML += '</div>';
    }
    
    if (totalChanges === 0) {
        detailsHTML = '<p>No differences found between the selected versions.</p>';
    }
    
    detailsDiv.innerHTML = detailsHTML;
    resultsDiv.style.display = 'block';
}

/**
 * Close comparison results
 */
function closeComparisonResults() {
    comparisonMode = false;
    comparisonData = null;
    document.getElementById('comparisonResults').style.display = 'none';
    
    // Re-visualize without highlighting
    if (currentData) {
        createNetworkVisualization(currentData.nodes, currentData.edges);
    }
}

/**
 * Visualize data with comparison highlighting
 */
function visualizeWithComparison(baseData, diff) {
    // Create combined data with all nodes and edges
    const allNodes = [...baseData.nodes];
    const allEdges = [...baseData.edges];
    
    // Add new nodes from comparison
    diff.addedNodes.forEach(node => {
        if (!allNodes.find(n => n.id === node.id)) {
            allNodes.push(node);
        }
    });
    
    // Add new edges from comparison
    diff.addedEdges.forEach(edge => {
        const key = createEdgeKey(edge);
        if (!allEdges.find(e => createEdgeKey(e) === key)) {
            allEdges.push(edge);
        }
    });
    
    // Visualize
    createNetworkVisualization(allNodes, allEdges);
    
    // Apply highlighting
    setTimeout(() => {
        applyComparisonHighlighting(diff);
    }, 200);
}

/**
 * Apply visual highlighting for comparison
 */
function applyComparisonHighlighting(diff) {
    const svg = document.getElementById('networkSvg');
    
    // Highlight added nodes
    diff.addedNodes.forEach(node => {
        const nodeElem = svg.querySelector(`.node[data-id="${node.id}"]`);
        if (nodeElem) {
            nodeElem.classList.add('highlighted-added');
        }
    });
    
    // Highlight removed nodes
    diff.removedNodes.forEach(node => {
        const nodeElem = svg.querySelector(`.node[data-id="${node.id}"]`);
        if (nodeElem) {
            nodeElem.classList.add('highlighted-removed');
        }
    });
    
    // Create Sets for O(1) lookup of added/removed edges
    // This optimization replaces O(n) array.some() operations with O(1) Set.has() lookups,
    // improving performance when highlighting edges in large diagrams
    const addedEdgeKeys = new Set(diff.addedEdges.map(e => createEdgeKey(e)));
    const removedEdgeKeys = new Set(diff.removedEdges.map(e => createEdgeKey(e)));
    
    // Highlight edges
    const paths = svg.querySelectorAll('path[d]');
    let pathIndex = 0;
    
    // Get current edges list
    if (currentData && currentData.edges) {
        currentData.edges.forEach(edge => {
            if (pathIndex >= paths.length) return;
            
            const path = paths[pathIndex];
            const edgeKey = createEdgeKey(edge);
            
            // Check if edge is added
            if (addedEdgeKeys.has(edgeKey)) {
                path.classList.add('edge-added');
            }
            
            // Check if edge is removed
            if (removedEdgeKeys.has(edgeKey)) {
                path.classList.add('edge-removed');
            }
            
            pathIndex++;
        });
    }
}

// ==================== VIEW SWITCHING FUNCTIONALITY ====================

let currentView = 'network';
let dashboardCharts = {};

// Constants for visualizations
const MAX_LABEL_LENGTH = 12;
const TRUNCATED_LABEL_LENGTH = 10;
const LABEL_ELLIPSIS = '...';
const MIN_RISK_FACTOR = 0.5;
const RISK_HASH_MODULO = 50;
const RISK_SCALE_DIVISOR = 100;
const HIGH_CONNECTION_THRESHOLD = 10;
const BATCH_DOMINANCE_THRESHOLD = 0.6;

/**
 * Switch between different views (network, dashboard, executive)
 */
function switchView(viewName) {
    currentView = viewName;
    
    // Update navigation buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-view="${viewName}"]`)?.classList.add('active');
    
    // Hide all views
    document.getElementById('network').style.display = 'none';
    document.getElementById('legend').style.display = 'none';
    document.getElementById('filterSection').style.display = 'none';
    document.getElementById('networkStats').style.display = 'none';
    document.getElementById('dashboardView').style.display = 'none';
    document.getElementById('executiveView').style.display = 'none';
    
    // Show selected view
    if (viewName === 'network') {
        document.getElementById('network').style.display = 'block';
        if (currentData) {
            document.getElementById('legend').style.display = 'block';
            document.getElementById('filterSection').style.display = 'block';
            document.getElementById('networkStats').style.display = 'flex';
        }
    } else if (viewName === 'dashboard') {
        document.getElementById('dashboardView').style.display = 'block';
        if (currentData) {
            initializeDashboard();
        }
    } else if (viewName === 'executive') {
        document.getElementById('executiveView').style.display = 'block';
        if (currentData) {
            initializeExecutiveView();
        }
    }
}

// ==================== DASHBOARD FUNCTIONS ====================

/**
 * Initialize the dashboard with charts and metrics
 */
function initializeDashboard() {
    if (!currentData) return;
    
    calculateDashboardMetrics();
    createDashboardCharts();
}

/**
 * Calculate dashboard KPIs and metrics
 */
function calculateDashboardMetrics() {
    const { nodes, edges } = currentData;
    
    // Total interfaces
    document.getElementById('kpiTotalInterfaces').textContent = edges.length;
    
    // Total systems
    document.getElementById('kpiTotalSystems').textContent = nodes.length;
    
    // Average connections per system
    const avgConnections = nodes.length > 0 ? (edges.length * 2 / nodes.length).toFixed(1) : 0;
    document.getElementById('kpiAvgConnections').textContent = avgConnections;
    
    // Data quality score (based on complete fields)
    let validCount = 0;
    edges.forEach(edge => {
        if (edge.integrationPattern && edge.integrationPattern !== 'Unknown' &&
            edge.frequency && edge.frequency !== 'Unknown' &&
            edge.label && edge.label !== 'Unknown') {
            validCount++;
        }
    });
    const qualityScore = edges.length > 0 ? Math.round((validCount / edges.length) * 100) : 100;
    document.getElementById('kpiValidationScore').textContent = qualityScore + '%';
}

/**
 * Create dashboard charts using custom SVG visualizations
 */
function createDashboardCharts() {
    const { edges } = currentData;
    
    // Clear existing charts
    dashboardCharts = {};
    
    // Chart 1: Interfaces by Communication Type
    const commTypeData = getCommTypeDistribution(edges);
    createSVGBarChart('commTypeChart', commTypeData, 
        ['#FF6B6B', '#4ECDC4', '#95E1D3', '#F38181', '#AA96DA', '#FCBAD3', '#999999']);
    
    // Chart 2: Top 5 Most Connected Systems
    const topSystems = getTopConnectedSystems(5);
    const topSystemsData = {};
    topSystems.labels.forEach((label, i) => {
        topSystemsData[label] = topSystems.data[i];
    });
    createSVGBarChart('topSystemsChart', topSystemsData, ['#00d4ff']);
    
    // Chart 3: Interfaces by Frequency
    const frequencyData = getFrequencyDistribution(edges);
    createSVGBarChart('frequencyChart', frequencyData,
        ['#2196F3', '#4CAF50', '#FF9800', '#9E9E9E', '#E91E63', '#607D8B']);
    
    // Chart 4: Data Validation Stats
    const validationData = getValidationStats(edges);
    const validationChartData = {
        'Complete': validationData.complete,
        'Incomplete': validationData.incomplete
    };
    createSVGBarChart('validationChart', validationChartData, ['#10b981', '#ef4444']);
}

/**
 * Get integration pattern distribution
 */
function getCommTypeDistribution(edges) {
    const distribution = {};
    edges.forEach(edge => {
        const type = edge.integrationPattern || 'Unknown';
        distribution[type] = (distribution[type] || 0) + 1;
    });
    return distribution;
}

/**
 * Get frequency distribution
 */
function getFrequencyDistribution(edges) {
    const distribution = {};
    edges.forEach(edge => {
        const freq = edge.frequency || 'Unknown';
        distribution[freq] = (distribution[freq] || 0) + 1;
    });
    return distribution;
}

/**
 * Get top N connected systems
 */
function getTopConnectedSystems(n) {
    const { nodes, edges } = currentData;
    const connectionCount = {};
    
    // Count connections for each system
    edges.forEach(edge => {
        connectionCount[edge.from] = (connectionCount[edge.from] || 0) + 1;
        connectionCount[edge.to] = (connectionCount[edge.to] || 0) + 1;
    });
    
    // Sort and get top N
    const sorted = Object.entries(connectionCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, n);
    
    return {
        labels: sorted.map(s => s[0]),
        data: sorted.map(s => s[1])
    };
}

/**
 * Get validation statistics
 */
function getValidationStats(edges) {
    let complete = 0;
    let incomplete = 0;
    
    edges.forEach(edge => {
        if (edge.integrationPattern && edge.integrationPattern !== 'Unknown' &&
            edge.frequency && edge.frequency !== 'Unknown' &&
            edge.label && edge.label !== 'Unknown') {
            complete++;
        } else {
            incomplete++;
        }
    });
    
    return { complete, incomplete };
}

/**
 * Create a simple SVG bar chart
 */
function createSVGBarChart(canvasId, data, colors) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    
    // Clear existing content
    canvas.innerHTML = '';
    
    // Create SVG element
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '300');
    svg.setAttribute('viewBox', '0 0 400 300');
    
    const entries = Object.entries(data);
    const maxValue = Math.max(...entries.map(e => e[1]));
    const barWidth = 300 / entries.length;
    const chartHeight = 220;
    const chartTop = 20;
    
    entries.forEach(([label, value], index) => {
        const barHeight = maxValue > 0 ? (value / maxValue) * chartHeight : 0;
        const x = index * barWidth + 20;
        const y = chartTop + chartHeight - barHeight;
        const color = colors[index % colors.length];
        
        // Create bar
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', x);
        rect.setAttribute('y', y);
        rect.setAttribute('width', Math.max(barWidth - 10, 20));
        rect.setAttribute('height', barHeight);
        rect.setAttribute('fill', color);
        rect.setAttribute('rx', '4');
        svg.appendChild(rect);
        
        // Add value label on top of bar
        const valueText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        valueText.setAttribute('x', x + (barWidth - 10) / 2);
        valueText.setAttribute('y', y - 5);
        valueText.setAttribute('text-anchor', 'middle');
        valueText.setAttribute('fill', 'rgba(255, 255, 255, 0.9)');
        valueText.setAttribute('font-size', '12');
        valueText.setAttribute('font-weight', 'bold');
        valueText.textContent = value;
        svg.appendChild(valueText);
        
        // Add label below bar
        const labelText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        labelText.setAttribute('x', x + (barWidth - 10) / 2);
        labelText.setAttribute('y', chartTop + chartHeight + 20);
        labelText.setAttribute('text-anchor', 'middle');
        labelText.setAttribute('fill', 'rgba(255, 255, 255, 0.7)');
        labelText.setAttribute('font-size', '10');
        // Truncate long labels
        const truncated = label.length > MAX_LABEL_LENGTH 
            ? label.substring(0, TRUNCATED_LABEL_LENGTH) + LABEL_ELLIPSIS 
            : label;
        labelText.textContent = truncated;
        
        // Add title for full label
        const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
        title.textContent = `${label}: ${value}`;
        labelText.appendChild(title);
        
        svg.appendChild(labelText);
    });
    
    canvas.appendChild(svg);
    return svg;
}

/**
 * Create a pie chart (not used, keeping for compatibility)
 */
function createPieChart(canvasId, title, labels, data, colors) {
    // Use bar chart instead
    const chartData = {};
    labels.forEach((label, i) => {
        chartData[label] = data[i];
    });
    return createSVGBarChart(canvasId, chartData, colors);
}

/**
 * Create a bar chart (not used, keeping for compatibility)
 */
function createBarChart(canvasId, title, labels, data) {
    const chartData = {};
    labels.forEach((label, i) => {
        chartData[label] = data[i];
    });
    return createSVGBarChart(canvasId, chartData, ['#00d4ff']);
}

/**
 * Create a doughnut chart (not used, keeping for compatibility)
 */
function createDoughnutChart(canvasId, title, labels, data, colors) {
    const chartData = {};
    labels.forEach((label, i) => {
        chartData[label] = data[i];
    });
    return createSVGBarChart(canvasId, chartData, colors);
}

// ==================== EXECUTIVE VIEW FUNCTIONS ====================

/**
 * Initialize the executive view
 */
function initializeExecutiveView() {
    if (!currentData) return;
    
    calculateExecutiveMetrics();
    displayCriticalPathSystems();
    createRiskImpactChart();
    generateRecommendations();
}

/**
 * Calculate executive KPIs
 */
function calculateExecutiveMetrics() {
    const { nodes, edges } = currentData;
    
    // Calculate connection counts for each system
    const connectionCount = {};
    edges.forEach(edge => {
        connectionCount[edge.from] = (connectionCount[edge.from] || 0) + 1;
        connectionCount[edge.to] = (connectionCount[edge.to] || 0) + 1;
    });
    
    // Determine critical systems (systems with high connection count)
    const avgConnections = Object.values(connectionCount).reduce((a, b) => a + b, 0) / nodes.length;
    const criticalSystems = Object.values(connectionCount).filter(c => c > avgConnections * 1.5).length;
    document.getElementById('execCriticalSystems').textContent = criticalSystems;
    
    // Calculate overall risk score
    const maxConnections = Math.max(...Object.values(connectionCount));
    const riskScore = maxConnections > 10 ? 'High' : maxConnections > 5 ? 'Medium' : 'Low';
    document.getElementById('execRiskScore').textContent = riskScore;
    
    // Calculate complexity
    const complexity = edges.length / nodes.length;
    const complexityLevel = complexity > 5 ? 'High' : complexity > 3 ? 'Medium' : 'Low';
    document.getElementById('execComplexity').textContent = complexityLevel;
}

/**
 * Display critical path systems
 */
function displayCriticalPathSystems() {
    const { nodes, edges } = currentData;
    const connectionCount = {};
    
    // Count connections for each system
    edges.forEach(edge => {
        connectionCount[edge.from] = (connectionCount[edge.from] || 0) + 1;
        connectionCount[edge.to] = (connectionCount[edge.to] || 0) + 1;
    });
    
    // Sort by connection count
    const sorted = Object.entries(connectionCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    
    const listHTML = sorted.map(([system, count]) => {
        const criticality = count > 8 ? 'high' : count > 4 ? 'medium' : 'low';
        const criticalityLabel = criticality.charAt(0).toUpperCase() + criticality.slice(1);
        
        return `
            <div class="critical-system-item ${criticality}">
                <div class="system-info">
                    <div class="system-name">${system}</div>
                    <div class="system-details">${count} connections • Impact: ${criticalityLabel}</div>
                </div>
                <div class="criticality-badge ${criticality}">${criticalityLabel}</div>
            </div>
        `;
    }).join('');
    
    document.getElementById('criticalPathList').innerHTML = listHTML;
}

/**
 * Create risk impact chart
 */
function createRiskImpactChart() {
    const { nodes, edges } = currentData;
    const connectionCount = {};
    
    // Count connections for each system
    edges.forEach(edge => {
        connectionCount[edge.from] = (connectionCount[edge.from] || 0) + 1;
        connectionCount[edge.to] = (connectionCount[edge.to] || 0) + 1;
    });
    
    // Create scatter plot data (connections vs risk)
    // Risk is calculated deterministically based on connection count and system name hash
    const scatterData = nodes.map(node => {
        const connections = connectionCount[node.id] || 0;
        // Calculate a deterministic risk factor based on system name
        // This provides consistent visualization while simulating varying risk levels
        const nameHash = node.label.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const riskFactor = MIN_RISK_FACTOR + ((nameHash % RISK_HASH_MODULO) / RISK_SCALE_DIVISOR);
        const risk = connections * riskFactor;
        return {
            x: connections,
            y: risk,
            label: node.label
        };
    });
    
    const canvas = document.getElementById('riskImpactChart');
    if (!canvas) return;
    
    // Clear existing content
    canvas.innerHTML = '';
    
    // Create SVG scatter plot
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '400');
    svg.setAttribute('viewBox', '0 0 500 400');
    
    const maxX = Math.max(...scatterData.map(d => d.x)) || 10;
    const maxY = Math.max(...scatterData.map(d => d.y)) || 10;
    const chartWidth = 400;
    const chartHeight = 320;
    const marginLeft = 60;
    const marginBottom = 60;
    
    // Draw axes
    const xAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    xAxis.setAttribute('x1', marginLeft);
    xAxis.setAttribute('y1', chartHeight);
    xAxis.setAttribute('x2', marginLeft + chartWidth);
    xAxis.setAttribute('y2', chartHeight);
    xAxis.setAttribute('stroke', 'rgba(255, 255, 255, 0.3)');
    xAxis.setAttribute('stroke-width', '2');
    svg.appendChild(xAxis);
    
    const yAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    yAxis.setAttribute('x1', marginLeft);
    yAxis.setAttribute('y1', 20);
    yAxis.setAttribute('x2', marginLeft);
    yAxis.setAttribute('y2', chartHeight);
    yAxis.setAttribute('stroke', 'rgba(255, 255, 255, 0.3)');
    yAxis.setAttribute('stroke-width', '2');
    svg.appendChild(yAxis);
    
    // Add axis labels
    const xLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    xLabel.setAttribute('x', marginLeft + chartWidth / 2);
    xLabel.setAttribute('y', chartHeight + 40);
    xLabel.setAttribute('text-anchor', 'middle');
    xLabel.setAttribute('fill', 'rgba(255, 255, 255, 0.8)');
    xLabel.setAttribute('font-size', '12');
    xLabel.textContent = 'Number of Connections';
    svg.appendChild(xLabel);
    
    const yLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    yLabel.setAttribute('x', 15);
    yLabel.setAttribute('y', chartHeight / 2);
    yLabel.setAttribute('text-anchor', 'middle');
    yLabel.setAttribute('fill', 'rgba(255, 255, 255, 0.8)');
    yLabel.setAttribute('font-size', '12');
    yLabel.setAttribute('transform', `rotate(-90, 15, ${chartHeight / 2})`);
    yLabel.textContent = 'Risk Impact Score';
    svg.appendChild(yLabel);
    
    // Plot points
    scatterData.forEach(point => {
        const x = marginLeft + (point.x / maxX) * chartWidth;
        const y = chartHeight - (point.y / maxY) * (chartHeight - 20);
        
        let color;
        if (point.y > 8) color = '#ef4444';
        else if (point.y > 4) color = '#fbbf24';
        else color = '#10b981';
        
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', x);
        circle.setAttribute('cy', y);
        circle.setAttribute('r', '6');
        circle.setAttribute('fill', color);
        circle.setAttribute('stroke', 'rgba(255, 255, 255, 0.5)');
        circle.setAttribute('stroke-width', '1');
        
        const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
        title.textContent = `${point.label}\nConnections: ${point.x}\nRisk: ${point.y.toFixed(1)}`;
        circle.appendChild(title);
        
        svg.appendChild(circle);
    });
    
    canvas.appendChild(svg);
}

/**
 * Generate strategic recommendations
 */
function generateRecommendations() {
    const { nodes, edges } = currentData;
    const connectionCount = {};
    
    // Count connections for each system
    edges.forEach(edge => {
        connectionCount[edge.from] = (connectionCount[edge.from] || 0) + 1;
        connectionCount[edge.to] = (connectionCount[edge.to] || 0) + 1;
    });
    
    const recommendations = [];
    
    // Check for highly connected systems
    const maxConnections = Math.max(...Object.values(connectionCount));
    if (maxConnections > HIGH_CONNECTION_THRESHOLD) {
        recommendations.push({
            title: 'High System Coupling Detected',
            description: 'Several systems have a high number of connections, creating potential single points of failure. Consider implementing redundancy or load balancing strategies for critical systems.'
        });
    }
    
    // Check for data quality
    const validationStats = getValidationStats(edges);
    const qualityPercent = (validationStats.complete / (validationStats.complete + validationStats.incomplete)) * 100;
    if (qualityPercent < 90) {
        recommendations.push({
            title: 'Improve Data Quality',
            description: `Only ${qualityPercent.toFixed(0)}% of interface data is complete. Review and update missing communication types, frequencies, and data formats to improve monitoring and decision-making.`
        });
    }
    
    // Check for communication type diversity
    const commTypes = getCommTypeDistribution(edges);
    const batchCount = commTypes['Batch'] || 0;
    const totalEdges = edges.length;
    if (batchCount / totalEdges > BATCH_DOMINANCE_THRESHOLD) {
        recommendations.push({
            title: 'Consider Real-time Integration',
            description: 'Over 60% of interfaces use batch processing. Evaluate opportunities to implement real-time or API-based integrations for improved data freshness and responsiveness.'
        });
    }
    
    // Always recommend monitoring
    recommendations.push({
        title: 'Implement Comprehensive Monitoring',
        description: 'Establish monitoring and alerting for all critical interface connections. Track interface uptime, data quality, and performance metrics to proactively identify and resolve issues.'
    });
    
    // Display recommendations
    const listHTML = recommendations.map(rec => `
        <div class="recommendation-item">
            <div class="recommendation-title">${rec.title}</div>
            <div class="recommendation-description">${rec.description}</div>
        </div>
    `).join('');
    
    document.getElementById('recommendationsList').innerHTML = listHTML;
}

/**
 * Export executive report as PDF (using browser print)
 */
async function exportExecutiveReport() {
    // Create a printable version of the executive view
    const printContent = createPrintableReport();
    
    // Open print dialog
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Executive Management Report</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    padding: 20px;
                    color: #000;
                    background: #fff;
                }
                h1 { color: #00d4ff; text-align: center; }
                h2 { color: #333; margin-top: 30px; border-bottom: 2px solid #00d4ff; padding-bottom: 5px; }
                .kpi-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 20px;
                    margin: 20px 0;
                }
                .kpi-card {
                    border: 2px solid #ddd;
                    padding: 15px;
                    border-radius: 8px;
                }
                .kpi-label { font-weight: bold; color: #666; }
                .kpi-value { font-size: 24px; color: #00d4ff; margin: 10px 0; }
                .system-item {
                    padding: 10px;
                    margin: 5px 0;
                    border-left: 4px solid #00d4ff;
                    background: #f5f5f5;
                }
                .recommendation {
                    padding: 15px;
                    margin: 10px 0;
                    border-left: 4px solid #00d4ff;
                    background: #f9f9f9;
                }
                .rec-title { font-weight: bold; margin-bottom: 5px; }
                @media print {
                    body { padding: 10mm; }
                    .kpi-grid { page-break-inside: avoid; }
                }
            </style>
        </head>
        <body>
            ${printContent}
        </body>
        </html>
    `);
    
    printWindow.document.close();
    
    // Trigger print after a short delay to ensure content is loaded
    setTimeout(() => {
        printWindow.print();
    }, 500);
    
    showStatus('Opening print dialog for report export', 'success');
}

/**
 * Create printable HTML report
 */
function createPrintableReport() {
    const criticalSystems = document.getElementById('execCriticalSystems').textContent;
    const riskScore = document.getElementById('execRiskScore').textContent;
    const complexity = document.getElementById('execComplexity').textContent;
    
    let html = `
        <h1>Executive Management Report</h1>
        <p style="text-align: center; color: #666;">Interface Consolidation Analysis</p>
        <p style="text-align: center; color: #999;">Generated: ${new Date().toLocaleDateString()}</p>
        
        <h2>Key Performance Indicators</h2>
        <div class="kpi-grid">
            <div class="kpi-card">
                <div class="kpi-label">Critical Systems</div>
                <div class="kpi-value">${criticalSystems}</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-label">Risk Score</div>
                <div class="kpi-value">${riskScore}</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-label">Integration Complexity</div>
                <div class="kpi-value">${complexity}</div>
            </div>
        </div>
        
        <h2>Critical Path Systems</h2>
    `;
    
    const criticalPathList = document.getElementById('criticalPathList');
    const criticalItems = criticalPathList.querySelectorAll('.critical-system-item');
    
    criticalItems.forEach((item, index) => {
        if (index < 10) {
            const name = item.querySelector('.system-name').textContent;
            const details = item.querySelector('.system-details').textContent;
            html += `<div class="system-item"><strong>${index + 1}. ${name}</strong><br>${details}</div>`;
        }
    });
    
    html += '<h2>Strategic Recommendations</h2>';
    
    const recommendationsList = document.getElementById('recommendationsList');
    const recItems = recommendationsList.querySelectorAll('.recommendation-item');
    
    recItems.forEach((item, index) => {
        const title = item.querySelector('.recommendation-title').textContent;
        const description = item.querySelector('.recommendation-description').textContent;
        html += `
            <div class="recommendation">
                <div class="rec-title">${index + 1}. ${title}</div>
                <div>${description}</div>
            </div>
        `;
    });
    
    return html;
}

/**
 * Export executive report as PowerPoint presentation
 */
async function exportPowerPointReport() {
    try {
        showLoading();
        showStatus('Generating PowerPoint presentation...', 'info');
        
        // Constants for presentation
        const MAX_CRITICAL_SYSTEMS = 10;
        const ITEMS_PER_SLIDE = 5;
        const RECOMMENDATIONS_PER_SLIDE = 3;
        
        // Create new presentation
        const pptx = new PptxGenJS();
        
        // Get current date for report
        const reportDate = new Date().toISOString().split('T')[0];
        
        // Get data from the executive view
        const criticalSystemsEl = document.getElementById('execCriticalSystems');
        const riskScoreEl = document.getElementById('execRiskScore');
        const complexityEl = document.getElementById('execComplexity');
        
        if (!criticalSystemsEl || !riskScoreEl || !complexityEl) {
            throw new Error('Required executive view elements not found. Please ensure data is loaded.');
        }
        
        const criticalSystems = criticalSystemsEl.textContent;
        const riskScore = riskScoreEl.textContent;
        const complexity = complexityEl.textContent;
        
        // Slide 1: Title Slide
        const titleSlide = pptx.addSlide();
        titleSlide.background = { color: '1E3A5F' };
        
        titleSlide.addText('Executive Management Report', {
            x: 0.5,
            y: 1.5,
            w: 9,
            h: 1.0,
            fontSize: 44,
            bold: true,
            color: '00d4ff',
            align: 'center'
        });
        
        titleSlide.addText('Interface Consolidation Analysis', {
            x: 0.5,
            y: 2.7,
            w: 9,
            h: 0.5,
            fontSize: 24,
            color: 'FFFFFF',
            align: 'center'
        });
        
        titleSlide.addText(`Generated: ${reportDate}`, {
            x: 0.5,
            y: 3.4,
            w: 9,
            h: 0.3,
            fontSize: 14,
            color: 'CCCCCC',
            align: 'center'
        });
        
        // Slide 2: Key Performance Indicators
        const kpiSlide = pptx.addSlide();
        kpiSlide.addText('Key Performance Indicators', {
            x: 0.5,
            y: 0.5,
            w: 9,
            h: 0.6,
            fontSize: 32,
            bold: true,
            color: '1E3A5F'
        });
        
        // Add KPI boxes
        const kpiData = [
            { label: 'Critical Systems', value: criticalSystems, color: 'FF6B6B' },
            { label: 'Risk Score', value: riskScore, color: 'FFA500' },
            { label: 'Integration Complexity', value: complexity, color: '4ECDC4' }
        ];
        
        kpiData.forEach((kpi, index) => {
            const xPos = 0.5 + (index * 3.3);
            
            kpiSlide.addShape(pptx.ShapeType.rect, {
                x: xPos,
                y: 1.5,
                w: 3.0,
                h: 2.5,
                fill: { color: kpi.color }
            });
            
            kpiSlide.addText(kpi.value, {
                x: xPos,
                y: 2.0,
                w: 3.0,
                h: 0.8,
                fontSize: 48,
                bold: true,
                color: 'FFFFFF',
                align: 'center'
            });
            
            kpiSlide.addText(kpi.label, {
                x: xPos,
                y: 2.9,
                w: 3.0,
                h: 0.5,
                fontSize: 16,
                color: 'FFFFFF',
                align: 'center'
            });
        });
        
        // Slide 3: Critical Path Systems
        const criticalSlide = pptx.addSlide();
        criticalSlide.addText('Critical Path Systems', {
            x: 0.5,
            y: 0.5,
            w: 9,
            h: 0.6,
            fontSize: 32,
            bold: true,
            color: '1E3A5F'
        });
        
        const criticalPathList = document.getElementById('criticalPathList');
        if (!criticalPathList) {
            throw new Error('Critical path list element not found.');
        }
        const criticalItems = criticalPathList.querySelectorAll('.critical-system-item');
        
        let yPos = 1.5;
        let currentSlide = criticalSlide;
        let itemCount = 0;
        
        criticalItems.forEach((item, index) => {
            if (index < MAX_CRITICAL_SYSTEMS) {
                // Create new slide if needed
                if (itemCount >= ITEMS_PER_SLIDE) {
                    currentSlide = pptx.addSlide();
                    currentSlide.addText('Critical Path Systems (continued)', {
                        x: 0.5,
                        y: 0.5,
                        w: 9,
                        h: 0.6,
                        fontSize: 32,
                        bold: true,
                        color: '1E3A5F'
                    });
                    yPos = 1.5;
                    itemCount = 0;
                }
                
                const nameEl = item.querySelector('.system-name');
                const detailsEl = item.querySelector('.system-details');
                
                if (!nameEl || !detailsEl) {
                    console.warn(`Critical system item at index ${index} is missing name or details element`);
                    return;
                }
                
                const name = nameEl.textContent;
                const details = detailsEl.textContent;
                
                currentSlide.addShape(pptx.ShapeType.rect, {
                    x: 0.5,
                    y: yPos,
                    w: 9,
                    h: 0.9,
                    fill: { color: 'F5F5F5' },
                    line: { color: '00d4ff', width: 3 }
                });
                
                currentSlide.addText(`${index + 1}. ${name}`, {
                    x: 0.7,
                    y: yPos + 0.1,
                    w: 8.6,
                    h: 0.3,
                    fontSize: 16,
                    bold: true,
                    color: '1E3A5F'
                });
                
                currentSlide.addText(details, {
                    x: 0.7,
                    y: yPos + 0.45,
                    w: 8.6,
                    h: 0.35,
                    fontSize: 12,
                    color: '666666'
                });
                
                yPos += 1.1;
                itemCount++;
            }
        });
        
        // Slide 4: Risk Impact Analysis
        const riskSlide = pptx.addSlide();
        riskSlide.addText('Risk Impact Analysis', {
            x: 0.5,
            y: 0.5,
            w: 9,
            h: 0.6,
            fontSize: 32,
            bold: true,
            color: '1E3A5F'
        });
        
        riskSlide.addText('Risk Distribution Overview', {
            x: 0.5,
            y: 1.5,
            w: 9,
            h: 0.4,
            fontSize: 18,
            color: '666666'
        });
        
        // Add placeholder for risk scatter plot
        riskSlide.addShape(pptx.ShapeType.rect, {
            x: 1.0,
            y: 2.2,
            w: 8.0,
            h: 3.0,
            fill: { color: 'F9F9F9' },
            line: { color: 'CCCCCC', width: 1 }
        });
        
        riskSlide.addText('Systems are plotted based on:\n• X-axis: Number of Dependencies\n• Y-axis: Risk Score\n• Size: Relative Impact', {
            x: 1.5,
            y: 2.7,
            w: 7.0,
            h: 2.0,
            fontSize: 14,
            color: '666666',
            align: 'left'
        });
        
        // Slide 5: Strategic Recommendations
        const recsSlide = pptx.addSlide();
        recsSlide.addText('Strategic Recommendations', {
            x: 0.5,
            y: 0.5,
            w: 9,
            h: 0.6,
            fontSize: 32,
            bold: true,
            color: '1E3A5F'
        });
        
        const recommendationsList = document.getElementById('recommendationsList');
        if (!recommendationsList) {
            throw new Error('Recommendations list element not found.');
        }
        const recItems = recommendationsList.querySelectorAll('.recommendation-item');
        
        yPos = 1.5;
        currentSlide = recsSlide;
        itemCount = 0;
        
        recItems.forEach((item, index) => {
            // Create new slide if needed
            if (itemCount >= RECOMMENDATIONS_PER_SLIDE) {
                currentSlide = pptx.addSlide();
                currentSlide.addText('Strategic Recommendations (continued)', {
                    x: 0.5,
                    y: 0.5,
                    w: 9,
                    h: 0.6,
                    fontSize: 32,
                    bold: true,
                    color: '1E3A5F'
                });
                yPos = 1.5;
                itemCount = 0;
            }
            
            const titleEl = item.querySelector('.recommendation-title');
            const descriptionEl = item.querySelector('.recommendation-description');
            
            if (!titleEl || !descriptionEl) {
                console.warn(`Recommendation item at index ${index} is missing title or description element`);
                return;
            }
            
            const title = titleEl.textContent;
            const description = descriptionEl.textContent;
            
            currentSlide.addShape(pptx.ShapeType.rect, {
                x: 0.5,
                y: yPos,
                w: 9,
                h: 1.3,
                fill: { color: 'F0F8FF' },
                line: { color: '00d4ff', width: 2 }
            });
            
            currentSlide.addText(`${index + 1}. ${title}`, {
                x: 0.7,
                y: yPos + 0.15,
                w: 8.6,
                h: 0.35,
                fontSize: 16,
                bold: true,
                color: '1E3A5F'
            });
            
            currentSlide.addText(description, {
                x: 0.7,
                y: yPos + 0.55,
                w: 8.6,
                h: 0.6,
                fontSize: 12,
                color: '666666'
            });
            
            yPos += 1.5;
            itemCount++;
        });
        
        // Save the presentation
        await pptx.writeFile({ fileName: `Executive_Report_${reportDate}.pptx` });
        
        hideLoading();
        showStatus('PowerPoint presentation exported successfully!', 'success');
        
    } catch (error) {
        hideLoading();
        showStatus('Error exporting PowerPoint: ' + error.message, 'error');
        console.error('PowerPoint export error:', error);
    }
}


