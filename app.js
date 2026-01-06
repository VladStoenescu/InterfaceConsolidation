// Global variables
let currentData = null;
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
                showStatus('No data found in the Excel file', 'error');
                return;
            }
            
            // Process and visualize the data
            processAndVisualize(jsonData);
            
        } catch (error) {
            showStatus('Error processing file: ' + error.message, 'error');
            console.error(error);
        }
    };
    
    reader.onerror = function() {
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
        
        // Enable version controls
        enableVersionControls();
        
        // Show legend
        document.getElementById('legend').style.display = 'block';
        
    } catch (error) {
        showStatus('Error creating visualization: ' + error.message, 'error');
        console.error(error);
    }
}

/**
 * Extract nodes and edges from data
 */
function extractNodesAndEdges(data) {
    const nodesMap = new Map();
    const edges = [];
    
    data.forEach((row, index) => {
        // Extract the required fields (case-insensitive)
        const fromApp = getFieldValue(row, ['From App Key', 'from app key', 'FROM APP KEY', 'FromAppKey', 'Source']);
        const toApp = getFieldValue(row, ['To App Key', 'to app key', 'TO APP KEY', 'ToAppKey', 'Target', 'Destination']);
        const dataForm = getFieldValue(row, ['Data Form', 'data form', 'DATA FORM', 'DataForm', 'Format', 'Type']) || 'Unknown';
        const frequency = getFieldValue(row, ['Frequency', 'frequency', 'FREQUENCY', 'Freq']) || 'Unknown';
        
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
        
        // Create edge
        edges.push({
            from: fromApp,
            to: toApp,
            label: dataForm,
            frequency: frequency,
            tooltip: `From: ${fromApp}\nTo: ${toApp}\nData Form: ${dataForm}\nFrequency: ${frequency}`
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
    
    // Draw edges with curves
    edges.forEach(edge => {
        const fromPos = positions[edge.from];
        const toPos = positions[edge.to];
        
        if (!fromPos || !toPos) return;
        
        const style = getEdgeStyle(edge.frequency);
        
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
        if (style.dasharray) {
            path.setAttribute('stroke-dasharray', style.dasharray);
        }
        path.setAttribute('marker-end', `url(#${markerId})`);
        
        const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
        title.textContent = edge.tooltip;
        path.appendChild(title);
        
        g.appendChild(path);
        
        // Position label along the curve (at the control point offset)
        const labelX = midX + perpX * 0.6;
        const labelY = midY + perpY * 0.6;
        
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', labelX);
        text.setAttribute('y', labelY);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('font-size', '11');
        text.setAttribute('fill', '#333');
        text.setAttribute('font-weight', 'bold');
        text.textContent = edge.label;
        
        const textBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        // Use default dimensions initially (getBBox needs the element to be in DOM)
        const bbox = { x: labelX - DEFAULT_TEXT_WIDTH/2, y: labelY - DEFAULT_TEXT_HEIGHT, width: DEFAULT_TEXT_WIDTH, height: DEFAULT_TEXT_HEIGHT };
        // Update with actual dimensions after a delay to allow DOM to render
        setTimeout(() => {
            const bbox = text.getBBox();
            textBg.setAttribute('x', bbox.x - TEXT_BG_PADDING);
            textBg.setAttribute('y', bbox.y - TEXT_BG_PADDING);
            textBg.setAttribute('width', bbox.width + TEXT_BG_PADDING * 2);
            textBg.setAttribute('height', bbox.height + TEXT_BG_PADDING * 2);
        }, TEXT_MEASUREMENT_DELAY);
        
        textBg.setAttribute('fill', 'white');
        textBg.setAttribute('opacity', '0.85');
        textBg.setAttribute('rx', '3');
        
        g.appendChild(textBg);
        g.appendChild(text);
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
        
        // Create rectangle
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        const textWidth = node.label.length * CHAR_WIDTH_ESTIMATE;
        rect.setAttribute('x', pos.x - textWidth / 2 - NODE_PADDING);
        rect.setAttribute('y', pos.y - NODE_HEIGHT / 2);
        rect.setAttribute('width', textWidth + NODE_PADDING * 2);
        rect.setAttribute('height', NODE_HEIGHT);
        rect.setAttribute('fill', '#97C2FC');
        rect.setAttribute('stroke', '#2B7CE9');
        rect.setAttribute('stroke-width', '2');
        rect.setAttribute('rx', '5');
        
        // Create text
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', pos.x);
        text.setAttribute('y', pos.y + 5);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('font-size', '14');
        text.setAttribute('fill', '#000');
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
    
    // Initialize nodes with random positions in a larger spread
    const margin = 100;
    nodes.forEach(node => {
        positions[node.id] = {
            x: margin + Math.random() * (width - 2 * margin),
            y: margin + Math.random() * (height - 2 * margin),
            vx: 0,
            vy: 0
        };
    });
    
    // Force-directed layout parameters
    const iterations = 100;
    const repulsionStrength = 8000;
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
    const paths = svg.querySelectorAll('path[d]');
    const nodes = svg.querySelectorAll('.node');
    
    const positions = {};
    nodes.forEach(node => {
        const id = node.dataset.id;
        positions[id] = {
            x: parseFloat(node.dataset.x),
            y: parseFloat(node.dataset.y)
        };
    });
    
    let pathIndex = 0;
    currentData.edges.forEach(edge => {
        const fromPos = positions[edge.from];
        const toPos = positions[edge.to];
        
        if (!fromPos || !toPos || pathIndex >= paths.length) return;
        
        const path = paths[pathIndex];
        
        // Calculate curve control points
        const { controlX, controlY } = calculateCurveControlPoint(fromPos, toPos);
        
        const pathData = `M ${fromPos.x} ${fromPos.y} Q ${controlX} ${controlY} ${toPos.x} ${toPos.y}`;
        path.setAttribute('d', pathData);
        
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

// Load sample data automatically for demo
document.addEventListener('DOMContentLoaded', function() {
    // Load sample data
    loadSampleData();
    
    // Load saved versions from localStorage
    loadVersionsFromStorage();
    updateVersionDropdowns();
});

/**
 * Load sample data for demonstration
 */
function loadSampleData() {
    const sampleData = [
        {
            "From App Key": "CRM System",
            "To App Key": "Data Warehouse",
            "Data Form": "CSV",
            "Frequency": "Daily"
        },
        {
            "From App Key": "CRM System",
            "To App Key": "Email Service",
            "Data Form": "XML",
            "Frequency": "On Demand"
        },
        {
            "From App Key": "ERP System",
            "To App Key": "Data Warehouse",
            "Data Form": "CSV",
            "Frequency": "Daily"
        },
        {
            "From App Key": "ERP System",
            "To App Key": "Reporting Tool",
            "Data Form": "XML",
            "Frequency": "Weekly"
        },
        {
            "From App Key": "Payment Gateway",
            "To App Key": "CRM System",
            "Data Form": "JSON",
            "Frequency": "Daily"
        },
        {
            "From App Key": "Payment Gateway",
            "To App Key": "Audit System",
            "Data Form": "TXT",
            "Frequency": "Monthly"
        },
        {
            "From App Key": "Mobile App",
            "To App Key": "API Gateway",
            "Data Form": "JSON",
            "Frequency": "Daily"
        },
        {
            "From App Key": "API Gateway",
            "To App Key": "CRM System",
            "Data Form": "JSON",
            "Frequency": "Daily"
        },
        {
            "From App Key": "API Gateway",
            "To App Key": "ERP System",
            "Data Form": "XML",
            "Frequency": "Daily"
        },
        {
            "From App Key": "Reporting Tool",
            "To App Key": "Dashboard",
            "Data Form": "PDF",
            "Frequency": "Weekly"
        },
        {
            "From App Key": "Data Warehouse",
            "To App Key": "Analytics Platform",
            "Data Form": "CSV",
            "Frequency": "Daily"
        },
        {
            "From App Key": "Analytics Platform",
            "To App Key": "Dashboard",
            "Data Form": "JSON",
            "Frequency": "Daily"
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
    return `${edge.from}||${edge.to}`;
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
    
    // Visualize the version
    createNetworkVisualization(currentData.nodes, currentData.edges);
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
            if (baseEdge.label !== edge.label || baseEdge.frequency !== edge.frequency) {
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

