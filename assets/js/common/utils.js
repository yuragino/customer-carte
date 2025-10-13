// 分(minute)を「X時間Y分Z秒」形式に
export const formatTime = minutes => {
  if (minutes === null) return null;
  const totalSec = Math.round(minutes * 60);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;

  if (h > 0) return `${h}時間${m}分${s}秒`;
  if (m > 0) return `${m}分${s}秒`;
  return `${s}秒`;
};

// Firestore Timestamp → HH:MM
export const formatTimestamp = ts => {
  if (!ts) return null;
  const d = ts.toDate();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

// 配列から平均時間を計算
export const avg = arr => arr.length ? formatTime(arr.reduce((acc, c) => acc + c.guideRaw, 0) / arr.length) : null;

// 最短 & 最長
export const minBy = arr => arr.reduce((p, c) => p.guideRaw < c.guideRaw ? p : c);
export const maxBy = arr => arr.reduce((p, c) => p.guideRaw > c.guideRaw ? p : c);

