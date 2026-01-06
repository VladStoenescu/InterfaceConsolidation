// Global variables
let currentData = null;
let isDragging = false;
let draggedNode = null;
let offsetX = 0;
let offsetY = 0;
let zoom = 1;
let panX = 0;
let panY = 0;

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
        
        // Calculate curve control point for quadratic bezier
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
        
        const controlX = midX + perpX;
        const controlY = midY + perpY;
        
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
        
        // Calculate curve control point for quadratic bezier
        const dx = toPos.x - fromPos.x;
        const dy = toPos.y - fromPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Curve offset perpendicular to the line
        const curveOffset = Math.min(distance * 0.25, 80);
        const midX = (fromPos.x + toPos.x) / 2;
        const midY = (fromPos.y + toPos.y) / 2;
        
        // Perpendicular offset
        const perpX = -dy / distance * curveOffset;
        const perpY = dx / distance * curveOffset;
        
        const controlX = midX + perpX;
        const controlY = midY + perpY;
        
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
