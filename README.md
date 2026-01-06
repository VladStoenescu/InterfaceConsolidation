# InterfaceConsolidation

A simple web application to consolidate an Excel file into a visual representation of interfaces between systems.

## Features

- **Excel File Import**: Upload Excel files (.xlsx, .xls) containing interface data
- **Visual Network Diagram**: Automatically generates an interactive network diagram showing system interfaces
- **Force-Directed Layout**: Uses a physics-based algorithm to distribute nodes naturally and reduce clutter
- **Curved Edges**: Connections use curved paths to minimize visual overlap and improve readability
- **Frequency-Based Differentiation**: Lines are styled differently based on communication frequency:
  - **Daily**: Solid blue line (thick)
  - **Weekly**: Dashed green line
  - **Monthly**: Dotted orange line
  - **Yearly**: Solid gray line (thick)
  - **On Demand**: Solid pink line (thin)
  - **Other/Unknown**: Solid gray line (thin)
- **Data Form Labels**: Each connection shows the type of data exchange (CSV, PDF, TXT, XML, etc.)

## Required Excel Columns

The Excel file should contain the following columns:

- **From App Key**: The source system (required)
- **To App Key**: The target system (required)
- **Data Form**: The type of data being exchanged (e.g., CSV, PDF, TXT, XML, Other)
- **Frequency**: How often the data exchange occurs (e.g., Daily, Weekly, Monthly, Yearly, On Demand)

> **Note**: Column names are case-insensitive. The application will automatically detect variations like "from app key", "FROM APP KEY", etc.

## How to Use

1. Open `index.html` in a modern web browser
2. Click on the file input or drag and drop an Excel file
3. Click the "Upload and Visualize" button
4. The application will parse the Excel file and display an interactive network diagram
5. Hover over connections to see detailed information
6. Use your mouse to:
   - Drag nodes to rearrange the layout
   - Zoom in/out using the mouse wheel
   - Pan the view by dragging the background

## Example Excel File Structure

| From App Key | To App Key | Data Form | Frequency |
|--------------|------------|-----------|-----------|
| System A     | System B   | CSV       | Daily     |
| System A     | System C   | XML       | Weekly    |
| System B     | System C   | PDF       | Monthly   |
| System D     | System A   | TXT       | On Demand |

## Technical Details

- **Frontend**: HTML, CSS, JavaScript
- **Excel Parsing**: SheetJS (xlsx library)
- **Visualization**: Custom SVG-based network diagram with force-directed layout algorithm
- **No Backend Required**: Runs entirely in the browser

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
