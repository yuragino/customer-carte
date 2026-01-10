import { doc, setDoc } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { db } from '../firebase-config.js';
import { getDocsByYear } from './firestore-utils.js';
import { handleError } from './ui-utils.js';

/**
 * スタッフ設定を Firestore から読み込む
 * @param {string} collectionName - イベントの設定コレクション名（例: 'seijinshiki_config' / 'fireworks_config'）
 * @param {number} year - 対象年
 * @returns {Promise<string[]>} スタッフ一覧の配列
 */
export async function loadStaffConfig(collectionName, year) {
  try {
    const configs = await getDocsByYear(collectionName, year);
    if (configs.length > 0) {
      const config = configs[0];
      return config.staffOptions ?? [];
    } else {
      return ['小林', '矢口', '大矢']; // デフォルト値
    }
  } catch (error) {
    handleError('スタッフ設定の読み込み', error);
    return [];
  }
}

/**
 * スタッフ設定を Firestore に保存する
 * @param {string} collectionName - イベントの設定コレクション名
 * @param {number} year - 対象年
 * @param {string[]} staffOptions - スタッフ名配列
 * @returns {Promise<void>}
 */
export async function saveStaffConfig(collectionName, year, staffOptions) {
  try {
    const docRef = doc(db, collectionName, String(year));
    await setDoc(
      docRef,
      { eventYear: year, staffOptions, updatedAt: new Date() },
      { merge: true }
    );
  } catch (error) {
    handleError('スタッフ設定の保存', error);
  }
}
