import React from 'react';
import type { DashboardState, DashboardChart } from '../accumulators/DashboardAccumulator';

const trendIcons: Record<string, { icon: string; color: string }> = {
  up: { icon: '\u2191', color: 'text-emerald-400' },
  down: { icon: '\u2193', color: 'text-red-400' },
  neutral: { icon: '\u2192', color: 'text-zinc-400' },
};

export const DashboardRenderer: React.FC<{ state: DashboardState }> = ({ state }) => {
  return (
    <div className="space-y-4">
      {/* Dashboard Header */}
      {state.title && (
        <div className="stream-item">
          <h3 className="text-lg font-semibold text-white">{state.title}</h3>
          {state.description && (
            <p className="text-sm text-zinc-400 mt-1">{state.description}</p>
          )}
        </div>
      )}

      {/* Metrics Grid */}
      {state.metrics.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {state.metrics.map((m) => {
            const trend = trendIcons[m.trend || 'neutral'];
            return (
              <div key={m.id} className="stream-item bg-zinc-800/50 rounded-lg p-3 border border-zinc-700/50">
                <div className="text-xs text-zinc-500 mb-1">{m.label}</div>
                <div className="text-2xl font-bold font-mono text-white">{m.value}</div>
                {m.change && (
                  <div className={`text-xs font-mono mt-1 ${trend.color}`}>
                    {trend.icon} {m.change}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Charts */}
      {state.charts.map((chart) => (
        <div key={chart.id} className="stream-item bg-zinc-800/50 rounded-lg p-4 border border-zinc-700/50">
          <div className="text-sm font-medium text-zinc-200 mb-3">{chart.title}</div>
          <MiniBarChart chart={chart} />
        </div>
      ))}

      {/* Activity Feed */}
      {state.activities.length > 0 && (
        <div className="stream-item bg-zinc-800/50 rounded-lg p-4 border border-zinc-700/50">
          <div className="text-sm font-medium text-zinc-200 mb-3">Recent Activity</div>
          <div className="space-y-2">
            {state.activities.map((a) => (
              <div key={a.id} className="stream-item flex items-start gap-2">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 mt-0.5">
                  {a.user.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-zinc-300">
                    <strong className="text-zinc-100">{a.user}</strong> {a.action}
                  </span>
                  <div className="text-[10px] text-zinc-500 font-mono">{a.timestamp}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/** Simple CSS-only bar chart visualization */
const MiniBarChart: React.FC<{ chart: DashboardChart }> = ({ chart }) => {
  const maxVal = Math.max(...chart.data.map(d => d.value), 1);
  return (
    <div className="flex items-end gap-1.5 h-32">
      {chart.data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div className="w-full flex flex-col justify-end flex-1">
            <div
              className="w-full rounded-t bg-gradient-to-t from-cyan-600 to-cyan-400 transition-all duration-500"
              style={{ height: `${(d.value / maxVal) * 100}%`, minHeight: 2 }}
            />
          </div>
          <span className="text-[9px] text-zinc-500 truncate w-full text-center">{d.label}</span>
        </div>
      ))}
    </div>
  );
};
