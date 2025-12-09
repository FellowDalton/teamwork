import React from 'react';
import { BarChart3, TrendingUp } from 'lucide-react';

export interface ChartDataPoint {
  label: string;
  value: number;
}

export interface ChartDisplayData {
  chartType: 'bar' | 'line';
  title: string;
  data: ChartDataPoint[];
  summary?: {
    total?: number;
    average?: number;
  };
}

interface ChartCardProps {
  data: ChartDisplayData;
  theme?: 'light' | 'dark';
}

export const ChartCard: React.FC<ChartCardProps> = ({ data, theme = 'dark' }) => {
  const isLight = theme === 'light';
  const { chartType, title, data: chartData, summary } = data;

  // Find max value for scaling
  const maxValue = Math.max(...chartData.map(d => d.value), 1);

  // Card styles matching DataCard
  const cardBody = isLight
    ? "bg-white border-zinc-300 text-zinc-800 shadow-[0_3px_0_#cbd5e1]"
    : "bg-[#27272a] border-[#3f3f46] text-zinc-200 shadow-[0_3px_0_#000000]";

  const metaColor = isLight ? "text-zinc-400" : "text-zinc-500";
  const textureClass = isLight ? 'bg-texture-card-light' : 'bg-texture-card-dark';
  const barBg = isLight ? 'bg-zinc-200' : 'bg-zinc-700';
  const barFill = 'bg-gradient-to-r from-cyan-500 to-cyan-400';

  return (
    <div className={`
      relative w-full col-span-2
      rounded-lg border-[1px]
      p-4 overflow-hidden
      ${cardBody}
    `}>
      {/* Texture Overlay */}
      <div className={`absolute inset-0 ${textureClass} opacity-40 pointer-events-none mix-blend-overlay`} />

      {/* Content wrapper */}
      <div className="relative z-10">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-8 rounded-full bg-cyan-500 shadow-[0_0_6px_rgba(6,182,212,0.8)]" />
            <span className={`text-[10px] font-mono uppercase tracking-wider ${metaColor}`}>
              {chartType === 'bar' ? 'BAR CHART' : 'LINE CHART'}
            </span>
          </div>
          {chartType === 'bar' ? (
            <BarChart3 size={14} className={metaColor} />
          ) : (
            <TrendingUp size={14} className={metaColor} />
          )}
        </div>

        {/* Title */}
        <h4 className="text-sm font-bold mb-4">{title}</h4>

        {/* Bar Chart */}
        {chartType === 'bar' && (
          <div className="space-y-3">
            {chartData.map((point, idx) => {
              const percentage = (point.value / maxValue) * 100;
              return (
                <div key={idx} className="space-y-1">
                  {/* Label row */}
                  <div className="flex items-center justify-between">
                    <span 
                      className={`text-[11px] font-mono truncate max-w-[70%] ${metaColor}`}
                      title={point.label}
                    >
                      {point.label}
                    </span>
                    <span className="text-xs font-mono font-bold">
                      {point.value.toFixed(1)}h
                    </span>
                  </div>
                  {/* Bar */}
                  <div className={`w-full h-4 ${barBg} rounded overflow-hidden`}>
                    <div
                      className={`h-full ${barFill} rounded transition-all duration-500`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Line Chart with SVG */}
        {chartType === 'line' && chartData.length > 0 && (
          <div className="relative">
            {/* Chart area with aspect ratio */}
            <div className="relative w-full" style={{ aspectRatio: '4 / 1', minHeight: '80px', maxHeight: '160px' }}>
              {/* SVG for lines and area fill */}
              <svg 
                viewBox="0 0 100 50" 
                preserveAspectRatio="none" 
                className="w-full h-full"
              >
                {/* Grid lines */}
                <line x1="0" y1="12.5" x2="100" y2="12.5" stroke={isLight ? '#e4e4e7' : '#3f3f46'} strokeWidth="0.2" vectorEffect="non-scaling-stroke" />
                <line x1="0" y1="25" x2="100" y2="25" stroke={isLight ? '#e4e4e7' : '#3f3f46'} strokeWidth="0.2" vectorEffect="non-scaling-stroke" />
                <line x1="0" y1="37.5" x2="100" y2="37.5" stroke={isLight ? '#e4e4e7' : '#3f3f46'} strokeWidth="0.2" vectorEffect="non-scaling-stroke" />
                
                {/* Area fill under line */}
                <path
                  d={(() => {
                    const points = chartData.map((point, idx) => {
                      const x = chartData.length > 1 ? (idx / (chartData.length - 1)) * 100 : 50;
                      const y = 50 - (point.value / maxValue) * 45;
                      return `${x},${y}`;
                    });
                    const firstX = chartData.length > 1 ? 0 : 50;
                    const lastX = chartData.length > 1 ? 100 : 50;
                    return `M${firstX},50 L${points.join(' L')} L${lastX},50 Z`;
                  })()}
                  fill="url(#lineGradient)"
                  opacity="0.25"
                />
                
                {/* Gradient definition */}
                <defs>
                  <linearGradient id="lineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.5" />
                    <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
                  </linearGradient>
                </defs>
                
                {/* Line - thinner with non-scaling stroke */}
                <polyline
                  points={chartData.map((point, idx) => {
                    const x = chartData.length > 1 ? (idx / (chartData.length - 1)) * 100 : 50;
                    const y = 50 - (point.value / maxValue) * 45;
                    return `${x},${y}`;
                  }).join(' ')}
                  fill="none"
                  stroke="#06b6d4"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                  style={{ filter: 'drop-shadow(0 0 2px rgba(6, 182, 212, 0.4))' }}
                />
              </svg>
              
              {/* Data points as HTML elements (won't stretch) */}
              {chartData.map((point, idx) => {
                const xPercent = chartData.length > 1 ? (idx / (chartData.length - 1)) * 100 : 50;
                const yPercent = 100 - ((point.value / maxValue) * 90); // 90% of height for data, 10% padding
                return (
                  <div
                    key={idx}
                    className="absolute w-2 h-2 rounded-full bg-cyan-500 border border-zinc-800 transform -translate-x-1/2 -translate-y-1/2"
                    style={{
                      left: `${xPercent}%`,
                      top: `${yPercent}%`,
                      boxShadow: '0 0 4px rgba(6, 182, 212, 0.5)',
                    }}
                  />
                );
              })}
              
              {/* Y-axis labels */}
              <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between text-[8px] font-mono pointer-events-none" style={{ color: metaColor.includes('400') ? '#a1a1aa' : '#71717a' }}>
                <span>{maxValue.toFixed(0)}h</span>
                <span>{(maxValue / 2).toFixed(0)}h</span>
                <span>0h</span>
              </div>
            </div>
            
            {/* X-axis labels */}
            <div className="flex justify-between mt-2">
              {chartData.map((point, idx) => (
                <span 
                  key={idx} 
                  className={`text-[9px] font-mono truncate ${metaColor}`}
                  style={{ maxWidth: `${100 / chartData.length}%` }}
                  title={point.label}
                >
                  {point.label}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Empty Line Chart State */}
        {chartType === 'line' && chartData.length === 0 && (
          <div className={`h-32 flex items-center justify-center ${metaColor}`}>
            <p className="text-xs font-mono">No data available for this period</p>
          </div>
        )}

        {/* Summary */}
        {summary && (
          <div className={`flex items-center justify-between mt-4 pt-3 border-t ${isLight ? 'border-zinc-200' : 'border-zinc-600/30'}`}>
            {summary.average !== undefined && (
              <div>
                <span className={`text-[10px] font-mono uppercase ${metaColor}`}>Avg</span>
                <span className="text-sm font-bold font-mono ml-2">{summary.average.toFixed(1)}h</span>
              </div>
            )}
            {summary.total !== undefined && (
              <div>
                <span className={`text-[10px] font-mono uppercase ${metaColor}`}>Total</span>
                <span className="text-lg font-bold font-mono ml-2">{summary.total.toFixed(1)}h</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
