# Data Visualization Skill

Generate minimal, responsive, and reliable data visualizations that work on the first try.

## When to Use This Skill

Use this skill when:
- User asks to visualize data (charts, graphs, trends)
- Displaying time entries, hours, or metrics
- Creating dashboards or data summaries
- The visualization needs to be generated dynamically

## Quick Reference

### Available Components
- `MiniChart` - Flexible chart component (`apps/teamwork_frontend/components/MiniChart.tsx`)
- `ChartCard` - Styled card wrapper (`apps/teamwork_frontend/components/ChartCard.tsx`)

### Data Transform Utilities
Located in `apps/teamwork_frontend/utils/chartDataTransform.ts`:
- `groupByWeek(entries)` - Time series by week
- `groupByMonth(entries)` - Time series by month  
- `groupByDay(entries)` - Time series by day
- `groupByCategory(entries, key, valueKey, lookupMap)` - Categorical data
- `validateChartData(data)` - Validate before render
- `recommendChartType(data)` - Auto-select chart type
- `createChartSpec(result, title, type)` - Create visualization spec

## Core Principles

1. **Validate First** - Never render without validating data
2. **Minimal by Default** - Thin lines (1px), small points (4px), subtle grids
3. **Hybrid Rendering** - SVG for paths, HTML for points/labels (prevents stretching)
4. **Responsive** - Use aspect-ratio, not fixed heights
5. **Self-Contained** - No external dependencies, inline styles

## Data Validation (REQUIRED)

Before ANY visualization, validate the data:

```typescript
interface ChartDataPoint {
  label: string;
  value: number;
}

function validateChartData(data: unknown): { valid: boolean; data: ChartDataPoint[]; error?: string } {
  // 1. Check existence
  if (!data || !Array.isArray(data)) {
    return { valid: false, data: [], error: 'No data provided' };
  }
  
  // 2. Filter valid points
  const validData = data.filter(d => 
    d && 
    typeof d.label === 'string' && 
    typeof d.value === 'number' && 
    !isNaN(d.value) &&
    isFinite(d.value)
  );
  
  // 3. Check minimum points
  if (validData.length === 0) {
    return { valid: false, data: [], error: 'No valid data points' };
  }
  
  return { valid: true, data: validData };
}
```

## Chart Type Selection Guide

| Data Shape | Recommended Chart | When to Use |
|------------|-------------------|-------------|
| Time series (5-50 points) | Line | Trends over time |
| Time series (50+ points) | Area/Sparkline | Dense time data |
| Categories (3-15 items) | Bar (horizontal) | Comparisons |
| Categories (15+ items) | Bar (top 10 only) | Truncate for readability |
| Single value vs target | Progress/Gauge | KPIs |
| Proportions (2-6 parts) | Donut | Part of whole |
| Two variables | Scatter | Correlation |

## Design Specifications

### Colors (Dark Theme)
```
Primary Data:    #06b6d4 (cyan-500)
Secondary:       #22d3ee (cyan-400)
Grid Lines:      #3f3f46 (zinc-700)
Background:      #18181b (zinc-900)
Text Primary:    #e4e4e7 (zinc-200)
Text Secondary:  #71717a (zinc-500)
```

### Colors (Light Theme)
```
Primary Data:    #0891b2 (cyan-600)
Secondary:       #06b6d4 (cyan-500)
Grid Lines:      #e4e4e7 (zinc-200)
Background:      #ffffff (white)
Text Primary:    #27272a (zinc-800)
Text Secondary:  #71717a (zinc-500)
```

### Sizing
```
Line stroke:     1px (use vectorEffect="non-scaling-stroke")
Point diameter:  4px (as HTML element, not SVG)
Grid stroke:     0.5px, 10% opacity
Font size:       10px labels, 9px axis
Aspect ratio:    Line/Area: 4:1, Bar: varies by items
Min height:      60px
Max height:      200px
```

## Component Templates

### Line Chart (Minimal)

```tsx
interface LineChartProps {
  data: { label: string; value: number }[];
  title?: string;
  theme?: 'light' | 'dark';
}

const LineChart: React.FC<LineChartProps> = ({ data, title, theme = 'dark' }) => {
  // VALIDATION FIRST
  if (!data || data.length === 0) {
    return <EmptyState message="No data available" theme={theme} />;
  }
  
  const validData = data.filter(d => typeof d.value === 'number' && !isNaN(d.value));
  if (validData.length === 0) {
    return <EmptyState message="No valid data points" theme={theme} />;
  }
  
  // Calculate bounds with padding
  const values = validData.map(d => d.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1; // Prevent division by zero
  const padding = range * 0.1;
  const yMin = Math.max(0, minVal - padding);
  const yMax = maxVal + padding;
  
  // Colors
  const isLight = theme === 'light';
  const lineColor = isLight ? '#0891b2' : '#06b6d4';
  const gridColor = isLight ? '#e4e4e7' : '#3f3f46';
  const textColor = isLight ? '#71717a' : '#71717a';
  
  // Generate path
  const points = validData.map((d, i) => {
    const x = validData.length > 1 ? (i / (validData.length - 1)) * 100 : 50;
    const y = 100 - ((d.value - yMin) / (yMax - yMin)) * 100;
    return { x, y, ...d };
  });
  
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  
  return (
    <div className="w-full">
      {title && (
        <div className="text-xs font-medium mb-2" style={{ color: isLight ? '#27272a' : '#e4e4e7' }}>
          {title}
        </div>
      )}
      
      <div 
        className="relative w-full"
        style={{ aspectRatio: '4 / 1', minHeight: '60px', maxHeight: '160px' }}
      >
        {/* SVG Layer - lines and fills only */}
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full"
        >
          {/* Grid lines */}
          {[25, 50, 75].map(y => (
            <line
              key={y}
              x1="0" y1={y} x2="100" y2={y}
              stroke={gridColor}
              strokeWidth="0.5"
              opacity="0.3"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          
          {/* Area fill */}
          <path
            d={`${pathD} L100,100 L0,100 Z`}
            fill={lineColor}
            opacity="0.1"
          />
          
          {/* Line */}
          <path
            d={pathD}
            fill="none"
            stroke={lineColor}
            strokeWidth="1"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        
        {/* HTML Layer - points (won't stretch) */}
        {points.map((p, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 rounded-full"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              transform: 'translate(-50%, -50%)',
              backgroundColor: lineColor,
              boxShadow: `0 0 4px ${lineColor}40`,
            }}
            title={`${p.label}: ${p.value}`}
          />
        ))}
        
        {/* Y-axis labels */}
        <div 
          className="absolute left-0 top-0 bottom-0 flex flex-col justify-between text-[9px] font-mono pr-1"
          style={{ color: textColor }}
        >
          <span>{yMax.toFixed(1)}</span>
          <span>{((yMax + yMin) / 2).toFixed(1)}</span>
          <span>{yMin.toFixed(1)}</span>
        </div>
      </div>
      
      {/* X-axis labels */}
      <div 
        className="flex justify-between text-[9px] font-mono mt-1 px-1"
        style={{ color: textColor }}
      >
        {validData.length <= 10 
          ? validData.map((d, i) => <span key={i}>{d.label}</span>)
          : <>
              <span>{validData[0].label}</span>
              <span>{validData[Math.floor(validData.length / 2)].label}</span>
              <span>{validData[validData.length - 1].label}</span>
            </>
        }
      </div>
    </div>
  );
};
```

### Bar Chart (Minimal)

```tsx
interface BarChartProps {
  data: { label: string; value: number }[];
  title?: string;
  theme?: 'light' | 'dark';
  maxItems?: number;
}

const BarChart: React.FC<BarChartProps> = ({ 
  data, 
  title, 
  theme = 'dark',
  maxItems = 10 
}) => {
  // VALIDATION
  if (!data || data.length === 0) {
    return <EmptyState message="No data available" theme={theme} />;
  }
  
  const validData = data
    .filter(d => typeof d.value === 'number' && !isNaN(d.value))
    .slice(0, maxItems);
    
  if (validData.length === 0) {
    return <EmptyState message="No valid data points" theme={theme} />;
  }
  
  const maxVal = Math.max(...validData.map(d => d.value)) || 1;
  
  const isLight = theme === 'light';
  const barColor = isLight ? '#0891b2' : '#06b6d4';
  const bgColor = isLight ? '#f4f4f5' : '#27272a';
  const textColor = isLight ? '#71717a' : '#a1a1aa';
  const labelColor = isLight ? '#27272a' : '#e4e4e7';
  
  return (
    <div className="w-full">
      {title && (
        <div className="text-xs font-medium mb-2" style={{ color: labelColor }}>
          {title}
        </div>
      )}
      
      <div className="space-y-1">
        {validData.map((d, i) => (
          <div key={i} className="flex items-center gap-2">
            {/* Label */}
            <div 
              className="w-24 text-[10px] font-mono truncate"
              style={{ color: textColor }}
              title={d.label}
            >
              {d.label}
            </div>
            
            {/* Bar */}
            <div 
              className="flex-1 h-4 rounded-sm overflow-hidden"
              style={{ backgroundColor: bgColor }}
            >
              <div
                className="h-full rounded-sm transition-all duration-300"
                style={{
                  width: `${(d.value / maxVal) * 100}%`,
                  backgroundColor: barColor,
                  minWidth: d.value > 0 ? '2px' : '0',
                }}
              />
            </div>
            
            {/* Value */}
            <div 
              className="w-12 text-[10px] font-mono text-right"
              style={{ color: textColor }}
            >
              {d.value.toFixed(1)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
```

### Empty State Component

```tsx
const EmptyState: React.FC<{ message: string; theme?: 'light' | 'dark' }> = ({ 
  message, 
  theme = 'dark' 
}) => {
  const isLight = theme === 'light';
  return (
    <div 
      className="flex items-center justify-center h-20 rounded border border-dashed"
      style={{
        borderColor: isLight ? '#d4d4d8' : '#3f3f46',
        color: isLight ? '#71717a' : '#52525b',
      }}
    >
      <span className="text-xs font-mono">{message}</span>
    </div>
  );
};
```

## Edge Case Handling

### Single Data Point
```tsx
// For line charts with single point, show as centered dot
if (validData.length === 1) {
  return (
    <div className="flex items-center justify-center" style={{ aspectRatio: '4/1' }}>
      <div 
        className="w-2 h-2 rounded-full"
        style={{ backgroundColor: lineColor }}
        title={`${validData[0].label}: ${validData[0].value}`}
      />
    </div>
  );
}
```

### All Zero Values
```tsx
// Show flat line at bottom
if (maxVal === 0) {
  return (
    <div className="relative" style={{ aspectRatio: '4/1' }}>
      <div 
        className="absolute bottom-0 left-0 right-0 h-px"
        style={{ backgroundColor: lineColor, opacity: 0.5 }}
      />
      <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[9px]" style={{ color: textColor }}>
        No activity
      </span>
    </div>
  );
}
```

### Negative Values
```tsx
// Adjust scale to include zero line
const yMin = Math.min(0, ...values);
const yMax = Math.max(0, ...values);
// Draw zero line more prominently
{yMin < 0 && yMax > 0 && (
  <line
    x1="0" y1={/* calculate zero position */} x2="100" y2={/* zero */}
    stroke={gridColor}
    strokeWidth="1"
    vectorEffect="non-scaling-stroke"
  />
)}
```

## Usage Examples

### From Raw API Data
```tsx
// Always validate and transform
const rawData = apiResponse.timeEntries;
const chartData = rawData?.map(entry => ({
  label: new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  value: entry.hours ?? entry.minutes / 60 ?? 0,
})) ?? [];

<LineChart data={chartData} title="Hours by Day" theme={theme} />
```

### Aggregating Data
```tsx
// Group by week/month before visualization
const weeklyData = Object.entries(
  entries.reduce((acc, e) => {
    const week = getWeekStart(e.date);
    acc[week] = (acc[week] || 0) + e.hours;
    return acc;
  }, {} as Record<string, number>)
).map(([label, value]) => ({ label, value }));
```

## Checklist Before Rendering

- [ ] Data array exists and is not empty
- [ ] Each point has valid label (string) and value (number)
- [ ] Max value calculated (not zero or NaN)
- [ ] Theme colors applied correctly
- [ ] Aspect ratio set (not fixed pixel height)
- [ ] Points rendered as HTML (not SVG circles)
- [ ] Lines use vectorEffect="non-scaling-stroke"
- [ ] Font sizes are small (9-10px)
- [ ] Stroke widths are thin (1px)
