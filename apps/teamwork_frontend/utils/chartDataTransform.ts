/**
 * Chart Data Transformation Utilities
 * 
 * Transforms raw Teamwork API data into validated chart-ready format.
 * Always validates before returning to ensure visualizations work first try.
 */

export interface ChartDataPoint {
  label: string;
  value: number;
}

export interface TransformResult {
  success: boolean;
  data: ChartDataPoint[];
  error?: string;
  meta?: {
    total: number;
    average: number;
    min: number;
    max: number;
    count: number;
  };
}

/**
 * Validates chart data points
 */
export function validateChartData(data: unknown[]): TransformResult {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return { success: false, data: [], error: 'No data provided' };
  }

  const validData = data.filter((d): d is ChartDataPoint =>
    d !== null &&
    typeof d === 'object' &&
    'label' in d &&
    'value' in d &&
    typeof (d as any).label === 'string' &&
    typeof (d as any).value === 'number' &&
    !isNaN((d as any).value) &&
    isFinite((d as any).value)
  );

  if (validData.length === 0) {
    return { success: false, data: [], error: 'No valid data points' };
  }

  const values = validData.map(d => d.value);
  const total = values.reduce((a, b) => a + b, 0);

  return {
    success: true,
    data: validData,
    meta: {
      total,
      average: total / validData.length,
      min: Math.min(...values),
      max: Math.max(...values),
      count: validData.length,
    },
  };
}

/**
 * Group time entries by week
 */
export function groupByWeek(
  entries: Array<{ date?: string; timeLogged?: string; minutes?: number; hours?: number }>
): TransformResult {
  if (!entries || entries.length === 0) {
    return { success: false, data: [], error: 'No entries' };
  }

  const weekData: Record<string, number> = {};

  for (const entry of entries) {
    const dateStr = entry.timeLogged || entry.date;
    if (!dateStr) continue;

    const date = new Date(dateStr);
    if (isNaN(date.getTime())) continue;

    // Get week start (Sunday)
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    const weekKey = weekStart.toISOString().split('T')[0];

    const hours = entry.hours ?? (entry.minutes ? entry.minutes / 60 : 0);
    weekData[weekKey] = (weekData[weekKey] || 0) + hours;
  }

  const data = Object.entries(weekData)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, value]) => ({
      label: new Date(week).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      value: parseFloat(value.toFixed(1)),
    }));

  return validateChartData(data);
}

/**
 * Group time entries by month
 */
export function groupByMonth(
  entries: Array<{ date?: string; timeLogged?: string; minutes?: number; hours?: number }>
): TransformResult {
  if (!entries || entries.length === 0) {
    return { success: false, data: [], error: 'No entries' };
  }

  const monthData: Record<string, number> = {};

  for (const entry of entries) {
    const dateStr = entry.timeLogged || entry.date;
    if (!dateStr) continue;

    const date = new Date(dateStr);
    if (isNaN(date.getTime())) continue;

    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const hours = entry.hours ?? (entry.minutes ? entry.minutes / 60 : 0);
    monthData[monthKey] = (monthData[monthKey] || 0) + hours;
  }

  const data = Object.entries(monthData)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, value]) => ({
      label: new Date(month + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      value: parseFloat(value.toFixed(1)),
    }));

  return validateChartData(data);
}

/**
 * Group by category (task, project, etc.)
 */
export function groupByCategory(
  entries: Array<{ [key: string]: any }>,
  categoryKey: string,
  valueKey: string = 'minutes',
  lookupMap?: Record<string, { name?: string }>
): TransformResult {
  if (!entries || entries.length === 0) {
    return { success: false, data: [], error: 'No entries' };
  }

  const categoryData: Record<string, number> = {};

  for (const entry of entries) {
    const categoryId = entry[categoryKey];
    const categoryName = lookupMap?.[String(categoryId)]?.name || `Item ${categoryId}` || 'Unknown';
    
    let value = entry[valueKey] ?? 0;
    if (valueKey === 'minutes') value = value / 60; // Convert to hours
    
    categoryData[categoryName] = (categoryData[categoryName] || 0) + value;
  }

  const data = Object.entries(categoryData)
    .sort(([, a], [, b]) => b - a) // Sort descending
    .map(([label, value]) => ({
      label,
      value: parseFloat(value.toFixed(1)),
    }));

  return validateChartData(data);
}

/**
 * Group by day
 */
export function groupByDay(
  entries: Array<{ date?: string; timeLogged?: string; minutes?: number; hours?: number }>
): TransformResult {
  if (!entries || entries.length === 0) {
    return { success: false, data: [], error: 'No entries' };
  }

  const dayData: Record<string, number> = {};

  for (const entry of entries) {
    const dateStr = entry.timeLogged || entry.date;
    if (!dateStr) continue;

    const date = new Date(dateStr);
    if (isNaN(date.getTime())) continue;

    const dayKey = date.toISOString().split('T')[0];
    const hours = entry.hours ?? (entry.minutes ? entry.minutes / 60 : 0);
    dayData[dayKey] = (dayData[dayKey] || 0) + hours;
  }

  const data = Object.entries(dayData)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, value]) => ({
      label: new Date(day).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      value: parseFloat(value.toFixed(1)),
    }));

  return validateChartData(data);
}

/**
 * Recommend chart type based on data characteristics
 */
export function recommendChartType(data: ChartDataPoint[]): 'line' | 'bar' | 'sparkline' | 'area' {
  if (data.length === 0) return 'bar';
  if (data.length <= 3) return 'bar';
  if (data.length > 20) return 'sparkline';
  
  // Check if labels look like dates/time series
  const firstLabel = data[0].label;
  const looksLikeTimeSeries = /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d)/i.test(firstLabel);
  
  if (looksLikeTimeSeries) {
    return data.length > 15 ? 'area' : 'line';
  }
  
  return 'bar';
}

/**
 * Create chart spec for visualization agent
 */
export function createChartSpec(
  result: TransformResult,
  title: string,
  chartType?: 'line' | 'bar' | 'area' | 'sparkline'
): {
  type: 'chart';
  chartType: string;
  title: string;
  data: ChartDataPoint[];
  summary?: { total: number; average: number };
} | null {
  if (!result.success || result.data.length === 0) {
    return null;
  }

  return {
    type: 'chart',
    chartType: chartType || recommendChartType(result.data),
    title,
    data: result.data,
    summary: result.meta ? {
      total: parseFloat(result.meta.total.toFixed(1)),
      average: parseFloat(result.meta.average.toFixed(1)),
    } : undefined,
  };
}
