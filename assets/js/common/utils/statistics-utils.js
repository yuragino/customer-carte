import { formatDuration } from "./format-utils.js";

// 配列内の指定キーの平均値を求め、時間形式に整形して返す
export function averageDuration(array, key) {
  if (array.length === 0) return '--';
  let totalMinutes = 0;
  array.forEach(record => totalMinutes += record[key] ?? 0);
  const averageMinutes = totalMinutes / array.length;
  return formatDuration(averageMinutes);
}

// 最短 & 最長
export function findMinBy(records, key) {
  return records.reduce((min, current) => current[key] < min[key] ? current : min);
}

export function findMaxBy(records, key) {
  return records.reduce((max, current) => current[key] > max[key] ? current : max);
}

export function calcMinutesBetween(start, end, asFormatted = false) {
  if (!start || !end) return null;
  const startDate = start.toDate ? start.toDate() : start;
  const endDate = end.toDate ? end.toDate() : end;
  const diffMin = (endDate - startDate) / 60000;
  return asFormatted ? formatDuration(diffMin) : diffMin;
}
