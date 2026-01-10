import { formatDuration } from "./format-utils.js";

// 配列内の指定キーの平均値を求めて返す
export function averageValue(array, key) {
  if (array.length === 0) return '--';
  let total = 0;
  array.forEach(record => total += record[key] ?? 0);
  const average = total / array.length;
  return average;
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
