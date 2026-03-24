import React from 'react';
import type { DashboardState, DashboardChart } from '../accumulators/DashboardAccumulator';
import { FadeSlideIn, ScaleIn, DrawBorder, CountUp, TypeReveal } from '../../components/StreamAnimations';

const trendConfig: Record<string, { icon: string; color: string }> = {
  up: { icon: '\u2191', color: 'text-emerald-400' },
  down: { icon: '\u2193', color: 'text-red-400' },
  neutral: { icon: '\u2192', color: 'text-zinc-400' },
};

export const DashboardRenderer: React.FC<{ state: DashboardState }> = ({ state }) => {
  return (
    <div className="space-y-4">
      {/* Dashboard Header */}
      {state.title && (
        <FadeSlideIn>
          <h3 className="text-lg font-semibold text-white">
            <TypeReveal text={state.title} charsPerFrame={8} />
          </h3>
          {state.description && (
            <p className="text-sm text-zinc-400 mt-1">
              <TypeReveal text={state.description} charsPerFrame={20} />
            </p>
          )}
        </FadeSlideIn>
      )}

      {/* Metrics Grid - each card scales in with stagger */}
      {state.metrics.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {state.metrics.map((m, i) => {
            const trend = trendConfig[m.trend || 'neutral'];
            return (
              <ScaleIn key={m.id} delay={i * 40}>
                <DrawBorder>
                  <div className="p-3">
                    <div className="text-xs text-zinc-500 mb-1">
                      <TypeReveal text={m.label} charsPerFrame={10} />
                    </div>
                    <div className="text-2xl font-bold font-mono text-white">
                      <TypeReveal text={m.value} charsPerFrame={5} />
                    </div>
                    {m.change && (
                      <FadeSlideIn delay={100}>
                        <div className={`text-xs font-mono mt-1 ${trend.color}`}>
                          {trend.icon} {m.change}
                        </div>
                      </FadeSlideIn>
                    )}
                  </div>
                </DrawBorder>
              </ScaleIn>
            );
          })}
        </div>
      )}

      {/* Charts - animate bars growing */}
      {state.charts.map((chart, i) => (
        <FadeSlideIn key={chart.id} delay={i * 50}>
          <DrawBorder>
            <div className="p-4">
              <div className="text-sm font-medium text-zinc-200 mb-3">
                <TypeReveal text={chart.title} charsPerFrame={10} />
              </div>
              <AnimatedBarChart chart={chart} />
            </div>
          </DrawBorder>
        </FadeSlideIn>
      ))}

      {/* Activity Feed - items slide in one by one */}
      {state.activities.length > 0 && (
        <FadeSlideIn>
          <DrawBorder>
            <div className="p-4">
              <div className="text-sm font-medium text-zinc-200 mb-3">Recent Activity</div>
              <div className="space-y-2.5">
                {state.activities.map((a, i) => (
                  <FadeSlideIn key={a.id} delay={i * 40}>
                    <div className="flex items-start gap-2.5">
                      {/* Avatar scales in */}
                      <ScaleIn delay={i * 40 + 20}>
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 mt-0.5 shadow-lg shadow-purple-500/10">
                          {a.user.charAt(0).toUpperCase()}
                        </div>
                      </ScaleIn>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-zinc-300">
                          <strong className="text-zinc-100">{a.user}</strong>{' '}
                          <TypeReveal text={a.action} charsPerFrame={15} />
                        </span>
                        <div className="text-[10px] text-zinc-500 font-mono mt-0.5">{a.timestamp}</div>
                      </div>
                    </div>
                  </FadeSlideIn>
                ))}
              </div>
            </div>
          </DrawBorder>
        </FadeSlideIn>
      )}
    </div>
  );
};

/** Bar chart with bars that grow up from zero */
const AnimatedBarChart: React.FC<{ chart: DashboardChart }> = ({ chart }) => {
  const maxVal = Math.max(...chart.data.map(d => d.value), 1);

  return (
    <div className="flex items-end gap-2 h-36">
      {chart.data.map((d, i) => {
        const heightPercent = (d.value / maxVal) * 100;
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
            {/* Value label */}
            <FadeSlideIn delay={i * 60 + 200}>
              <span className="text-[9px] font-mono text-zinc-500">
                <CountUp value={d.value} duration={500} />
              </span>
            </FadeSlideIn>

            {/* Bar that grows */}
            <div className="w-full flex flex-col justify-end flex-1">
              <div
                className="w-full rounded-t bg-gradient-to-t from-cyan-600 to-cyan-400"
                style={{
                  height: `${heightPercent}%`,
                  minHeight: 2,
                  transition: 'height 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  boxShadow: '0 0 8px rgba(6,182,212,0.15)',
                }}
              />
            </div>

            {/* Label */}
            <FadeSlideIn delay={i * 40}>
              <span className="text-[9px] text-zinc-500 truncate w-full text-center">{d.label}</span>
            </FadeSlideIn>
          </div>
        );
      })}
    </div>
  );
};
