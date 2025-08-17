# P-Q Curve Calculator - Requirements Document

## 1. Project Overview

### Purpose
Create a web application to graph Pressure-Flow (P-Q) curves for various combinations of fans and air filters, calculating the system operating point (intersection) which represents the actual CFM (Cubic Feet per Minute) of a given configuration.

### Technology Stack
- Pure HTML/JavaScript (no React or other frameworks)
- Modern CSS for styling
- Local storage for saved configurations
- URL-based parameter sharing

## 2. Core Features

### 2.1 Data Management
- **Data Format**: JSON file containing all fan and filter P-Q curve data
- **P-Q Data Storage**: CSV strings within JSON objects for easy copy/paste from WebPlotDigitizer or Excel
- **Metadata**: Each component includes units and column meanings

### 2.2 Fan Configuration
- Select a single fan model from available options
- Specify quantity of fans (multiple identical fans allowed)
- Combined P-Q calculation: Multiply CFM values by number of fans
- Note: v1.0 supports only one fan type per build

### 2.3 Filter Configuration
- Select filter media type from dataset
- P-Q data normalized to 1 square foot of filter media
- Preconfigured filter sizes with:
  - Human-readable size (e.g., "14x20")
  - Actual filter media area in square feet
- Support multiple filter sizes in same build
- Only one filter media type per build
- Combined P-Q calculation: Multiply CFM values by total filter area

### 2.4 Calculations
- Linear interpolation between data points
- Find intersection point of fan and filter curves
- Display operating point (CFM and pressure drop)

### 2.5 Unit Support
- Input support for both inches and millimeters of H2O
- Conversion capability between units
- User-selectable display units via toggle control
- Remember unit preference in localStorage between sessions
- Update axis labels and all displayed values when units change
- Internal storage in single unit system with conversion as needed

### 2.6 Visualization
- Real-time graph updates as user modifies inputs
- Display fan P-Q curve (blue - e.g., #2563eb or similar modern blue)
- Display filter P-Q curve (red/orange - e.g., #dc2626 or #ea580c)
- Mark and label intersection point
- Axis labels:
  - X-axis: "Airflow (CFM)"
  - Y-axis: "Static Pressure (in H₂O)" or "Static Pressure (mm H₂O)"
- Include grid lines for readability

### 2.7 Sharing & History
- URL parameters encode current configuration only (selections and quantities)
- Save builds with optional name/note (stored only in localStorage)
- History stored in local storage
- History features:
  - Delete saved builds
  - Copy shareable link (configuration only)
  - Load saved values
  - Confirmation prompt before overwriting unsaved changes

## 3. User Interface Requirements

### 3.1 Layout
- Modern, clean design
- Responsive layout
- Mobile-friendly interface
- Clear visual hierarchy

### 3.2 Main Components
- Fan selection and quantity input
- Filter media selection
- Filter size and quantity inputs
- P-Q curve graph
- Results display (intersection point)
- History/saved builds section

### 3.3 Interactivity
- Real-time updates without page refresh
- Smooth transitions
- Clear feedback for user actions

## 4. Technical Specifications

### 4.1 Implementation Details
- **Charting Library**: Use lightweight library (e.g., Chart.js) for graph rendering
- **Data File**: External `data.json` file in same directory as HTML/JS files
- **Intersection Handling**: 
  - P-Q curves should always intersect (filter curves start at 0,0 with positive slope, fan curves start with positive y-intercept and negative slope)
  - If no intersection found due to data error, display "No stable operating point"
- **Performance**: Expect 25-125 data points per P-Q curve
- **Unit System**: Store all data internally in one unit system (e.g., inches H₂O) and convert for display
  - Conversion: 1 inch H₂O = 25.4 mm H₂O

### 4.2 Data Structure (Proposed)
```json
{
  "fans": [
    {
      "id": "fan1",
      "name": "Model XYZ 120mm",
      "manufacturer": "Company A",
      "dataFormat": {
        "columns": ["cfm", "pressure_inches_h2o"],
        "units": {
          "cfm": "CFM",
          "pressure": "inches H2O"
        }
      },
      "data": "100,0.5\n90,0.6\n80,0.7\n..."
    }
  ],
  "filters": [
    {
      "id": "filter1",
      "name": "MERV 13 Pleated",
      "manufacturer": "Company B",
      "dataFormat": {
        "columns": ["cfm_per_sqft", "pressure_drop_inches_h2o"],
        "units": {
          "cfm": "CFM/sq ft",
          "pressure": "inches H2O"
        }
      },
      "data": "50,0.1\n40,0.15\n30,0.2\n...",
      "availableSizes": [
        {
          "label": "14x20",
          "area": 1.8
        },
        {
          "label": "16x25",
          "area": 2.6
        }
      ]
    }
  ]
}
```

## 5. Fast Follow Improvements (v1.1)

These features should be implemented shortly after the initial release:

1. **Quick Presets**: Pre-configured common combinations for rapid testing
2. **CFM Change Indicators**: Automatically show the change in CFM when adding/removing fans or changing filter sizes
3. **Power Consumption**: Add wattage information to fan data and display total power consumption for the build

## 6. Future Enhancements (v2.0+)

- **Interactive Crosshair Tooltip**: 
  - Show vertical crosshair line that follows cursor position
  - Display interpolated values for both curves at cursor x-position
  - Custom tooltip with CFM and pressure values for fan and filter curves
- **Multiple Fan Types**: Support different fan models in single build with interpolation to standard pressure values
- **Data Import/Validation**: 
  - User-uploaded JSON data files
  - Validation for monotonic P-Q curves
  - Copy/paste data import interface
- **Visual Operating Hints**: Show helpful indicators like "Not enough filter area to achieve high efficiency with this many fans. Consider increasing filter area, reducing the number of fans, or switching to a fan with higher static pressure."
- Export results to PDF or image
- Custom P-Q curve input
- Advanced interpolation methods (polynomial, spline)
- System resistance curve overlay
- Cloud storage for saved builds
- Comparison mode for multiple builds

## 7. Success Criteria

- Accurate P-Q curve plotting and intersection calculation
- Responsive real-time updates
- Intuitive user interface
- Reliable URL sharing
- Persistent local storage
- Cross-browser compatibility (modern browsers)
- Mobile-friendly responsive design

## 8. Constraints

- No external frameworks (React, Vue, etc.)
- Client-side only (no backend)
- Must work offline after initial load
- Modern browser support only (ES6+ JavaScript acceptable)
- Single fan type per build (v1.0)
- Data loaded from external `data.json` file