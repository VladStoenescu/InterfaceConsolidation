# InterfaceConsolidation

A simple web application to consolidate an Excel file into a visual representation of interfaces between systems.

## Features

- **Excel File Import**: Upload Excel files (.xlsx, .xls) containing interface data
- **Visual Network Diagram**: Automatically generates an interactive network diagram showing system interfaces
- **Force-Directed Layout**: Uses a physics-based algorithm to distribute nodes naturally and reduce clutter
- **Curved Edges**: Connections use curved paths to minimize visual overlap and improve readability
- **Communication Type Differentiation**: Lines are styled based on the type of communication:
  - **Batch**: Thick solid red line
  - **API/Online**: Dashed teal line
  - **Streaming/Real-time**: Dotted light teal line
  - **Mixed/Hybrid**: Complex dashed coral line
  - **File Transfer**: Dotted purple line
  - **Message Queue**: Multi-dashed pink line
  - **Unknown**: Thin gray line (default)
- **Frequency-Based Differentiation** (fallback): When Communication Type is not specified, lines are styled based on frequency:
  - **Daily**: Solid blue line (thick)
  - **Weekly**: Dashed green line
  - **Monthly**: Dotted orange line
  - **Yearly**: Solid gray line (thick)
  - **On Demand**: Solid pink line (thin)
  - **Other/Unknown**: Solid gray line (thin)
- **Data Form Labels**: Each connection shows the type of data exchange (CSV, PDF, TXT, XML, etc.)
- **Summary Insights Dashboard**: 
  - KPI cards showing total interfaces, systems, average connections, and data quality score
  - Visual charts displaying interface distribution by communication type and frequency
  - Top 5 most connected systems analysis
  - Data validation statistics
- **Executive Management View**:
  - High-level KPIs including critical systems count, risk score, and integration complexity
  - Critical path systems analysis with impact assessment
  - Risk impact scatter plot showing system dependencies vs. risk scores
  - Strategic recommendations based on current interface architecture
  - Export functionality to generate printable PDF reports

## Required Excel Columns

The Excel file should contain the following columns:

- **From App Key**: The source system (required)
- **To App Key**: The target system (required)
- **Data Form**: The type of data being exchanged (e.g., CSV, PDF, TXT, XML, Other)
- **Frequency**: How often the data exchange occurs (e.g., Daily, Weekly, Monthly, Yearly, On Demand)
- **Communication Type**: The method of communication (optional, e.g., Batch, API, Online, Streaming, Real-time, Mixed, Hybrid, File, FTP, SFTP, Queue, MQ, Message)

> **Note**: Column names are case-insensitive. The application will automatically detect variations like "from app key", "FROM APP KEY", "Communication Type", "Comm Type", etc.

## How to Use

1. Open `index.html` in a modern web browser
2. The application will automatically load sample data for demonstration
3. **Switch between views** using the navigation buttons:
   - **Network View**: Interactive network diagram of system interfaces
   - **Dashboard**: Summary insights and metrics with visual charts
   - **Executive View**: High-level strategic view with risk analysis
4. **Upload your own data**: Click "Choose File" and select an Excel file, then click "Upload and Visualize"
5. **Network View features**:
   - Hover over connections to see detailed information
   - Use the filter controls to focus on specific types of interfaces:
     - **Filter by Communication Type**: Show only Batch, API, Streaming, File Transfer, Message Queue, or Mixed interfaces
     - **Filter by Frequency**: Show only Daily, Weekly, Monthly, Yearly, or On Demand interfaces
     - **Reset Filters**: Clear all filters and show all interfaces
   - Use your mouse to:
     - Drag nodes to rearrange the layout
     - Zoom in/out using the mouse wheel
     - Pan the view by dragging the background
6. **Dashboard features**:
   - View KPIs: Total interfaces, systems, average connections, and data quality score
   - Analyze charts showing interface distribution and top connected systems
   - Monitor data validation statistics
7. **Executive View features**:
   - Review critical systems and overall risk assessment
   - Analyze critical path systems with impact ratings
   - View risk impact scatter plot
   - Read strategic recommendations
   - Export report as PDF using the "Export PDF Report" button (opens browser print dialog)
8. **Version Management**:
   - Save current data as a version for comparison
   - Load previously saved versions
   - Compare different versions to track changes

## Example Excel File Structure

| From App Key | To App Key | Data Form | Frequency | Communication Type |
|--------------|------------|-----------|-----------|-------------------|
| System A     | System B   | CSV       | Daily     | Batch             |
| System A     | System C   | XML       | Weekly    | API               |
| System B     | System C   | PDF       | Monthly   | File              |
| System D     | System A   | TXT       | On Demand | Streaming         |

## Technical Details

- **Frontend**: HTML, CSS, JavaScript
- **Excel Parsing**: SheetJS (xlsx library)
- **Visualization**: 
  - Network diagram: Custom SVG-based visualization with force-directed layout algorithm
  - Dashboard charts: Custom SVG bar charts
  - Executive view: Custom SVG scatter plot for risk analysis
- **No Backend Required**: Runs entirely in the browser
- **No External Dependencies**: All visualizations use custom SVG implementations for offline compatibility

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
