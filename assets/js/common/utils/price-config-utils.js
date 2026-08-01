import { doc, setDoc } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { db } from '../firebase-config.js';
import { getDocsByYear } from './firestore-utils.js';
import { handleError } from './ui-utils.js';

export const DEFAULT_PRICES = {
  dressingOnly: 3800,
  rentalDressing: 6800,
  childRentalDressing: 3400,
  footwear: 500,
  bag: 500,
};

/**
 * 料金設定を Firestore から読み込む
 * @param {string} collectionName - イベントの設定コレクション名（例: 'fireworks_config'）
 * @param {number} year - 対象年
 * @returns {Promise<object>} 料金設定
 */
export async function loadPriceConfig(collectionName, year) {
  try {
    const configs = await getDocsByYear(collectionName, year);
    if (configs.length > 0 && configs[0].prices) {
      return { ...DEFAULT_PRICES, ...configs[0].prices };
    }
    return { ...DEFAULT_PRICES };
  } catch (error) {
    handleError('料金設定の読み込み', error);
    return { ...DEFAULT_PRICES };
  }
}

/**
 * 料金設定を Firestore に保存する
 * @param {string} collectionName - イベントの設定コレクション名
 * @param {number} year - 対象年
 * @param {object} prices - 料金設定
 * @returns {Promise<void>}
 */
export async function savePriceConfig(collectionName, year, prices) {
  try {
    const docRef = doc(db, collectionName, String(year));
    await setDoc(
      docRef,
      { eventYear: year, prices, updatedAt: new Date() },
      { merge: true }
    );
  } catch (error) {
    handleError('料金設定の保存', error);
  }
}
