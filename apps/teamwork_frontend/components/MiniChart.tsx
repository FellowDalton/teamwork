import React from 'react';

// Types
export interface ChartDataPoint {
  label: string;
  value: number;
}

export interface MiniChartProps {
  data: ChartDataPoint[];
  type?: 'line' | 'bar' | 'area' | 'sparkline' | 'pie' | 'donut';
  title?: string;
  theme?: 'light' | 'dark';
  showLabels?: boolean;
  showPoints?: boolean;
  maxItems?: number;
  height?: 'sm' | 'md' | 'lg';
}

// Validation
function validateData(data: unknown): { valid: boolean; data: ChartDataPoint[]; error?: string } {
  if (!data || !Array.isArray(data)) {
    return { valid: false, data: [], error: 'No data' };
  }
  
  const validData = data.filter((d): d is ChartDataPoint => 
    d && 
    typeof d.label === 'string' && 
    typeof d.value === 'number' && 
    !isNaN(d.value) &&
    isFinite(d.value)
  );
  
  if (validData.length === 0) {
    return { valid: false, data: [], error: 'No valid points' };
  }
  
  return { valid: true, data: validData };
}

// Empty state
const EmptyState: React.FC<{ message: string; isLight: boolean }> = ({ message, isLight }) => (
  <div 
    className="flex items-center justify-center h-16 rounded border border-dashed"
    style={{
      borderColor: isLight ? '#d4d4d8' : '#3f3f46',
      color: isLight ? '#71717a' : '#52525b',
    }}
  >
    <span className="text-[10px] font-mono">{message}</span>
  </div>
);

// Main component
export const MiniChart: React.FC<MiniChartProps> = ({
  data,
  type = 'line',
  title,
  theme = 'dark',
  showLabels = true,
  showPoints = true,
  maxItems = 10,
  height = 'md',
}) => {
  const isLight = theme === 'light';
  
  // Colors
  const lineColor = isLight ? '#0891b2' : '#06b6d4';
  const gridColor = isLight ? '#e4e4e7' : '#3f3f46';
  const textColor = isLight ? '#71717a' : '#71717a';
  const labelColor = isLight ? '#27272a' : '#e4e4e7';
  const bgBar = isLight ? '#f4f4f5' : '#27272a';
  
  // Heights
  const aspectRatios = { sm: '6 / 1', md: '4 / 1', lg: '3 / 1' };
  const minHeights = { sm: '40px', md: '60px', lg: '80px' };
  const maxHeights = { sm: '80px', md: '120px', lg: '160px' };
  
  // Validate
  const { valid, data: validData, error } = validateData(data);
  if (!valid) {
    return <EmptyState message={error || 'No data'} isLight={isLight} />;
  }
  
  // Slice for bar charts
  const chartData = type === 'bar' ? validData.slice(0, maxItems) : validData;
  
  // Calculate bounds
  const values = chartData.map(d => d.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;
  const yMin = Math.min(0, minVal);
  const yMax = maxVal + range * 0.05;
  
  // Single point edge case
  if (chartData.length === 1 && (type === 'line' || type === 'area' || type === 'sparkline')) {
    return (
      <div className="w-full">
        {title && <div className="text-[10px] font-medium mb-1" style={{ color: labelColor }}>{title}</div>}
        <div 
          className="flex items-center justify-center rounded"
          style={{ aspectRatio: aspectRatios[height], backgroundColor: isLight ? '#fafafa' : '#1a1a1a' }}
        >
          <div className="text-center">
            <div className="w-2 h-2 rounded-full mx-auto mb-1" style={{ backgroundColor: lineColor }} />
            <div className="text-[10px] font-mono" style={{ color: textColor }}>
              {chartData[0].label}: {chartData[0].value.toFixed(1)}
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // All zeros edge case
  if (maxVal === 0) {
    return (
      <div className="w-full">
        {title && <div className="text-[10px] font-medium mb-1" style={{ color: labelColor }}>{title}</div>}
        <div 
          className="relative flex items-end justify-center rounded"
          style={{ aspectRatio: aspectRatios[height], backgroundColor: isLight ? '#fafafa' : '#1a1a1a' }}
        >
          <div className="absolute bottom-4 left-0 right-0 h-px" style={{ backgroundColor: lineColor, opacity: 0.3 }} />
          <span className="text-[9px] font-mono mb-6" style={{ color: textColor }}>No activity</span>
        </div>
      </div>
    );
  }
  
  // Generate points for line/area charts
  const points = chartData.map((d, i) => {
    const x = chartData.length > 1 ? (i / (chartData.length - 1)) * 100 : 50;
    const y = 100 - ((d.value - yMin) / (yMax - yMin)) * 100;
    return { x, y, ...d };
  });
  
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaPath = `${linePath} L100,100 L0,100 Z`;
  
  // Bar Chart
  if (type === 'bar') {
    return (
      <div className="w-full">
        {title && <div className="text-[10px] font-medium mb-2" style={{ color: labelColor }}>{title}</div>}
        <div className="space-y-1">
          {chartData.map((d, i) => (
            <div key={i} className="flex items-center gap-2">
              <div 
                className="w-20 text-[9px] font-mono truncate"
                style={{ color: textColor }}
                title={d.label}
              >
                {d.label}
              </div>
              <div className="flex-1 h-3 rounded-sm overflow-hidden" style={{ backgroundColor: bgBar }}>
                <div
                  className="h-full rounded-sm"
                  style={{
                    width: `${(d.value / maxVal) * 100}%`,
                    backgroundColor: lineColor,
                    minWidth: d.value > 0 ? '2px' : '0',
                  }}
                />
              </div>
              <div className="w-10 text-[9px] font-mono text-right" style={{ color: textColor }}>
                {d.value.toFixed(1)}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  
  // Pie / Donut Chart
  if (type === 'pie' || type === 'donut') {
    const total = chartData.reduce((sum, d) => sum + d.value, 0);
    const pieColors = [
      '#06b6d4', '#22d3ee', '#67e8f9', '#a5f3fc', // cyan shades
      '#0891b2', '#0e7490', '#155e75', '#164e63', // darker cyans
      '#14b8a6', '#2dd4bf', '#5eead4', '#99f6e4', // teal accents
    ];
    
    // Calculate pie slices
    let currentAngle = -90; // Start from top
    const slices = chartData.slice(0, 8).map((d, i) => {
      const percentage = total > 0 ? (d.value / total) * 100 : 0;
      const angle = (percentage / 100) * 360;
      const startAngle = currentAngle;
      currentAngle += angle;
      const endAngle = currentAngle;
      
      // Convert angles to radians for path calculation
      const startRad = (startAngle * Math.PI) / 180;
      const endRad = (endAngle * Math.PI) / 180;
      
      const radius = 40;
      const innerRadius = type === 'donut' ? 20 : 0;
      const cx = 50;
      const cy = 50;
      
      // Calculate arc points
      const x1 = cx + radius * Math.cos(startRad);
      const y1 = cy + radius * Math.sin(startRad);
      const x2 = cx + radius * Math.cos(endRad);
      const y2 = cy + radius * Math.sin(endRad);
      
      const largeArc = angle > 180 ? 1 : 0;
      
      let path: string;
      if (type === 'donut') {
        const ix1 = cx + innerRadius * Math.cos(startRad);
        const iy1 = cy + innerRadius * Math.sin(startRad);
        const ix2 = cx + innerRadius * Math.cos(endRad);
        const iy2 = cy + innerRadius * Math.sin(endRad);
        path = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix1} ${iy1} Z`;
      } else {
        path = `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
      }
      
      return {
        ...d,
        path,
        color: pieColors[i % pieColors.length],
        percentage,
      };
    });
    
    return (
      <div className="w-full">
        {title && <div className="text-[10px] font-medium mb-2" style={{ color: labelColor }}>{title}</div>}
        <div className="flex items-start gap-3">
          {/* Pie/Donut SVG */}
          <div className="w-24 h-24 flex-shrink-0">
            <svg viewBox="0 0 100 100" className="w-full h-full">
              {slices.map((slice, i) => (
                <path
                  key={i}
                  d={slice.path}
                  fill={slice.color}
                  stroke={isLight ? '#fff' : '#18181b'}
                  strokeWidth="1"
                >
                  <title>{`${slice.label}: ${slice.value.toFixed(1)} (${slice.percentage.toFixed(1)}%)`}</title>
                </path>
              ))}
            </svg>
          </div>
          
          {/* Legend */}
          <div className="flex-1 space-y-1">
            {slices.map((slice, i) => (
              <div key={i} className="flex items-center gap-2 text-[9px]">
                <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: slice.color }} />
                <span className="truncate flex-1" style={{ color: textColor }}>{slice.label}</span>
                <span className="font-mono" style={{ color: labelColor }}>{slice.percentage.toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
  
  // Sparkline (minimal, no labels)
  if (type === 'sparkline') {
    return (
      <div className="w-full">
        {title && <div className="text-[10px] font-medium mb-1" style={{ color: labelColor }}>{title}</div>}
        <div className="relative" style={{ aspectRatio: '8 / 1', minHeight: '24px', maxHeight: '40px' }}>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
            <path d={linePath} fill="none" stroke={lineColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          </svg>
        </div>
      </div>
    );
  }
  
  // Line / Area Chart
  return (
    <div className="w-full">
      {title && <div className="text-[10px] font-medium mb-1" style={{ color: labelColor }}>{title}</div>}
      
      <div 
        className="relative w-full"
        style={{ aspectRatio: aspectRatios[height], minHeight: minHeights[height], maxHeight: maxHeights[height] }}
      >
        {/* SVG Layer */}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
          {/* Grid */}
          {[25, 50, 75].map(y => (
            <line key={y} x1="0" y1={y} x2="100" y2={y} stroke={gridColor} strokeWidth="0.5" opacity="0.2" vectorEffect="non-scaling-stroke" />
          ))}
          
          {/* Area fill */}
          {(type === 'area' || type === 'line') && (
            <path d={areaPath} fill={lineColor} opacity="0.08" />
          )}
          
          {/* Line */}
          <path
            d={linePath}
            fill="none"
            stroke={lineColor}
            strokeWidth="1"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        
        {/* HTML Points */}
        {showPoints && points.map((p, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: '4px',
              height: '4px',
              transform: 'translate(-50%, -50%)',
              backgroundColor: lineColor,
            }}
            title={`${p.label}: ${p.value.toFixed(1)}`}
          />
        ))}
        
        {/* Y-axis */}
        {showLabels && (
          <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between text-[8px] font-mono" style={{ color: textColor }}>
            <span>{yMax.toFixed(0)}</span>
            <span>{((yMax + yMin) / 2).toFixed(0)}</span>
            <span>{yMin.toFixed(0)}</span>
          </div>
        )}
      </div>
      
      {/* X-axis */}
      {showLabels && (
        <div className="flex justify-between text-[8px] font-mono mt-0.5" style={{ color: textColor }}>
          {chartData.length <= 8 
            ? chartData.map((d, i) => <span key={i} className="truncate max-w-[40px]">{d.label}</span>)
            : <>
                <span>{chartData[0].label}</span>
                <span>{chartData[Math.floor(chartData.length / 2)].label}</span>
                <span>{chartData[chartData.length - 1].label}</span>
              </>
          }
        </div>
      )}
    </div>
  );
};

export default MiniChart;
