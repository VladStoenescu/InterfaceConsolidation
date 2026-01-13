# InterfaceConsolidation

A simple web application to consolidate an Excel file into a visual representation of interfaces between systems.

## Features

- **Excel File Import**: Upload Excel files (.xlsx, .xls) containing interface data
- **Level-Based Integration Layout**: Organize systems by integration levels:
  - **Level 1 (Core)**: Core applications defined by the user
  - **Level 2**: Applications directly connected to Level 1 (core) systems
  - **Level 3**: Applications connected to Level 2 systems (not directly to core)
  - Visual grouping by level with color-coded nodes and level badges
  - Optional: upload a core applications list to enable level-based organization
- **Visual Network Diagram**: Automatically generates an interactive network diagram showing system interfaces
- **Force-Directed Layout**: Uses a physics-based algorithm to distribute nodes naturally and reduce clutter
- **Curved Edges**: Connections use curved paths to minimize visual overlap and improve readability
- **Integration Pattern Differentiation**: Lines are styled based on the integration pattern:
  - **Direct DB Connection**: Thick solid red line
  - **Web Service / API**: Dashed teal line
  - **Streaming/Real-time**: Dotted light teal line
  - **File Transfer**: Dotted purple line
  - **Messaging / Message Queue**: Multi-dashed pink line
  - **UI Interaction**: Dash-dot yellow line
  - **Batch**: Thick solid red line (legacy support)
  - **Mixed/Hybrid**: Complex dashed coral line (automatically applied when multiple patterns exist)
  - **Unknown**: Thin gray line (default)
- **Frequency-Based Differentiation** (fallback): When Integration Pattern is not specified, lines are styled based on frequency:
  - **Daily**: Solid blue line (thick)
  - **Weekly**: Dashed green line
  - **Monthly**: Dotted orange line
  - **Yearly**: Solid gray line (thick)
  - **On Demand**: Solid pink line (thin)
  - **Other/Unknown**: Solid gray line (thin)
- **Multi-Line Edge Labels**: Each connection displays:
  - **First line**: Integration Pattern (e.g., "Mixed", "Web Service", "Direct DB Connection")
  - **Second line**: Data Format(s) (e.g., "CSV, XML", "JSON", "PDF")
- **Interactive Interface Details**: Click on any connection label to view detailed information including:
  - Source and target systems
  - Integration pattern type
  - All consolidated flows with individual patterns, frequencies, and descriptions
- **Enhanced Tooltips**: Hover over connections to see comprehensive information about all data flows
- **Flow Consolidation**: Automatically consolidates multiple flows between the same systems, showing all integration patterns and frequencies
- **Summary Insights Dashboard**: 
  - KPI cards showing total interfaces, systems, average connections, and data quality score
  - Visual charts displaying interface distribution by integration pattern and frequency
  - Top 5 most connected systems analysis
  - Data validation statistics
- **Executive Management View**:
  - High-level KPIs including critical systems count, risk score, and integration complexity
  - Critical path systems analysis with impact assessment
  - Risk impact scatter plot showing system dependencies vs. risk scores
  - Strategic recommendations based on current interface architecture
  - Export functionality to generate printable PDF reports
  - Export functionality to generate PowerPoint presentations for senior management

## Required Excel Columns

The Excel file should contain the following columns:

- **From App Key**: The source system (required)
- **To App Key**: The target system (required)
- **Data Form** (or **Data Format**): The type of data being exchanged (e.g., CSV, PDF, TXT, XML, JSON, Other)
- **Frequency**: How often the data exchange occurs (e.g., Daily, Weekly, Monthly, Yearly, On Demand)
- **Integration Pattern** (or **Communication Type**): The method of communication (optional, e.g., Direct DB Connection, Web Service, File Transfer, Messaging, Streaming, UI Interaction, Batch, API, Mixed, Hybrid)
- **Description**: Detailed description of the interface or data flow (optional)

> **Note**: Column names are case-insensitive. The application will automatically detect variations like "from app key", "FROM APP KEY", "Integration Pattern", "Communication Type", "Comm Type", etc.

### Integration Pattern Values

The application supports the following integration pattern types, each displayed with a distinct line style:

- **Direct DB Connection**: Solid thick line - for direct database connections
- **Web Service / API**: Dashed line - for REST, SOAP, HTTP APIs
- **Streaming / Real-time**: Dotted line - for real-time data streams
- **File Transfer**: Dotted line (different pattern) - for FTP, SFTP file transfers
- **Messaging / Message Queue**: Double dash pattern - for MQ, messaging systems
- **UI Interaction**: Dash-dot pattern - for user interface integrations
- **Batch**: Solid thick line - for batch processing
- **Mixed / Hybrid**: Alternating dash pattern - automatically applied when multiple integration patterns exist for the same interface

## How to Use

1. Open `index.html` in a modern web browser
2. The application will automatically load sample data for demonstration
3. **Switch between views** using the navigation buttons:
   - **Network View**: Interactive network diagram of system interfaces
   - **Dashboard**: Summary insights and metrics with visual charts
   - **Executive View**: High-level strategic view with risk analysis
4. **Upload your own data**:
   - **(Optional) Core Applications**: Upload an Excel/CSV file with a single column listing your core applications (Level 1). This enables level-based visualization.
     - Example format: See `sample_core_applications.csv`
     - Column name: "Application", "App", "System", "App Key", or similar
   - **Connection Files**: Upload one or more Excel files with interface data
     - Existing Connections: Current production interfaces
     - Target Connections (New): Planned new interfaces
     - Changed Connections: Modified interfaces
   - Click "Upload and Visualize" to process the files
5. **Level-Based Organization** (when core applications are provided):
   - **Level 1 (Red)**: Core applications as defined in your core applications file
   - **Level 2 (Teal)**: Applications directly connected to Level 1 systems
   - **Level 3 (Yellow)**: Applications connected to Level 2 (but not directly to Level 1)
   - Nodes are automatically grouped by level in the visualization
   - Level badges (L1, L2, L3) appear on each node
   - Legend shows level color coding
6. **Network View features**:
   - **Hover over connections** to see detailed tooltip information including all consolidated flows
   - **Click on connections** to view detailed interface descriptions in a modal dialog
   - Connection labels show:
     - First line: Integration Pattern (e.g., "Mixed", "Web Service")
     - Second line: Data Format(s) (e.g., "CSV, XML", "JSON")
   - Use the filter controls to focus on specific types of interfaces:
     - **Filter by Integration Pattern**: Show only specific pattern types (Direct DB Connection, Web Service/API, Streaming, File Transfer, Messaging, UI Interaction, or Mixed)
     - **Filter by Frequency**: Show only Daily, Weekly, Monthly, Yearly, or On Demand interfaces
     - **Reset Filters**: Clear all filters and show all interfaces
   - Use your mouse to:
     - Drag nodes to rearrange the layout
     - Zoom in/out using the mouse wheel
     - Pan the view by dragging the background
7. **Dashboard features**:
   - View KPIs: Total interfaces, systems, average connections, and data quality score
   - Analyze charts showing interface distribution and top connected systems
   - Monitor data validation statistics
8. **Executive View features**:
   - Review critical systems and overall risk assessment
   - Analyze critical path systems with impact ratings
   - View risk impact scatter plot
   - Read strategic recommendations
   - Export report as PDF using the "Export PDF Report" button (opens browser print dialog)
   - Export report as PowerPoint presentation using the "Export PowerPoint" button (generates .pptx file with professional slides)
8. **Version Management**:
   - Save current data as a version for comparison
   - Load previously saved versions
   - Compare different versions to track changes

## Example Excel File Structure

| From App Key | To App Key | Data Form | Frequency | Integration Pattern | Description |
|--------------|------------|-----------|-----------|---------------------|-------------|
| System A     | System B   | CSV       | Daily     | Direct DB Connection | Direct database connection for transaction data |
| System A     | System C   | XML       | Weekly    | Web Service         | RESTful API for data sync |
| System B     | System C   | PDF       | Monthly   | File Transfer       | Monthly FTP transfer of reports |
| System D     | System A   | JSON      | On Demand | Streaming           | Real-time event stream |

## Core Applications File (Optional)

To enable level-based visualization, you can upload a file listing your core (Level 1) applications. The file should contain a single column with application names.

**Supported formats**: Excel (.xlsx, .xls) or CSV (.csv)

**Example CSV file** (`sample_core_applications.csv`):
```csv
Application
System A
System D
```

**Example Excel file structure**:

| Application |
|-------------|
| System A    |
| System D    |

**Accepted column names** (case-insensitive):
- Application
- App
- System
- App Key
- Application Name
- System Name
- Name
- Core Application

Once uploaded, the application will automatically:
1. Identify these as **Level 1 (Core)** applications (shown in red)
2. Determine **Level 2** applications (those directly connected to Level 1, shown in teal)
3. Determine **Level 3** applications (those connected to Level 2 but not directly to Level 1, shown in yellow)
4. Organize the visualization with levels grouped vertically
5. Add level badges (L1, L2, L3) to each node

## Technical Details

- **Frontend**: HTML, CSS, JavaScript
- **Excel Parsing**: SheetJS (xlsx library)
- **PowerPoint Export**: PptxGenJS library (v3.12.0)
- **Visualization**: 
  - Network diagram: Custom SVG-based visualization with force-directed layout algorithm
  - Level-based organization: Automatic grouping by integration levels when core applications are provided
  - Dashboard charts: Custom SVG bar charts
  - Executive view: Custom SVG scatter plot for risk analysis
- **No Backend Required**: Runs entirely in the browser
- **No External Dependencies**: All visualizations use custom SVG implementations for offline compatibility
- **Export Capabilities**:
  - PDF export via browser print dialog
  - PowerPoint export generates professional .pptx presentations with multiple slides including:
    - Executive title slide
    - KPI dashboard with visual cards
    - Critical systems analysis
    - Risk impact overview
    - Strategic recommendations

## Browser Compatibility

Works with modern browsers that support ES6:
- Chrome/Edge (recommended)
- Firefox
- Safari

## Local Development

Simply open `index.html` in your browser. No build process or server required.

## Privacy

All data processing happens locally in your browser. No data is sent to any server.

## Security

Please see [SECURITY.md](SECURITY.md) for information about dependencies and security considerations.

For production use, only upload Excel files from trusted sources.
