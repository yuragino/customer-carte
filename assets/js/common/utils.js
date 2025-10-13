// 分(minute)を「X時間Y分Z秒」形式に
export function formatDuration(minutes) {
  if (minutes === null) return null;
  const totalSec = Math.round(minutes * 60);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;

  if (h > 0) return `${h}時間${m}分${s}秒`;
  if (m > 0) return `${m}分${s}秒`;
  return `${s}秒`;
}

// Firestore Timestamp → HH:MM
export function formatTimestamp (timestamp){
  if (!timestamp) return null;
  const date = timestamp instanceof Date ? timestamp : timestamp.toDate();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

// 配列から平均時間を計算
export const avg = arr => arr.length ? formatTime(arr.reduce((acc, c) => acc + c.guideRaw, 0) / arr.length) : null;

// 最短 & 最長
export const minBy = arr => arr.reduce((p, c) => p.guideRaw < c.guideRaw ? p : c);
export const maxBy = arr => arr.reduce((p, c) => p.guideRaw > c.guideRaw ? p : c);

// 曜日リスト
const WEEK_DAYS = ['日', '月', '火', '水', '木', '金', '土'];

// ISO文字列 → 日付＋時刻（例: 2025年05月03日(土) 14:45）
export function formatFullDateTime(isoString) {
  if (!isoString) return 'ー';
  const date = new Date(isoString);
  if (isNaN(date)) return 'ー';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const w = WEEK_DAYS[date.getDay()];
  const hh = String(date.getHours());
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${y}年${m}月${d}日(${w}) ${hh}:${mm}`;
}

// ISO文字列 → 日付のみ（例: 2025年5月3日(土)）
export function formatDateOnly(isoString) {
  if (!isoString) return 'ー';
  const date = new Date(isoString);
  if (isNaN(date)) return 'ー';
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const w = WEEK_DAYS[date.getDay()];
  return `${y}年${m}月${d}日(${w})`;
}

// 時刻フォーマット（例: 06:09 → 6:09）
export function formatTime(timeStr) {
  if (!timeStr) return 'ー';
  const [hh, mm] = timeStr.split(':');
  return `${Number(hh)}:${mm}`;
}

// 数値を「1,234円」形式に
export function formatYen(amount) {
  return isFinite(amount) ? Number(amount).toLocaleString('ja-JP') + '円' : '—';
}
