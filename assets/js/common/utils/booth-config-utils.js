import { doc, setDoc } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { db } from '../firebase-config.js';
import { getDocsByYear } from './firestore-utils.js';
import { handleError } from './ui-utils.js';

export const DEFAULT_BOOTH_OPTIONS = {
  female: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
  male: ['C1', 'C2', 'B1', 'B2'],
};

/**
 * ブース設定を Firestore から読み込む
 * @param {string} collectionName - イベントの設定コレクション名（例: 'fireworks_config'）
 * @param {number} year - 対象年
 * @returns {Promise<{female: string[], male: string[]}>} ブース設定
 */
export async function loadBoothConfig(collectionName, year) {
  try {
    const configs = await getDocsByYear(collectionName, year);
    const boothOptions = configs[0]?.boothOptions;
    if (boothOptions) {
      return {
        female: boothOptions.female ?? DEFAULT_BOOTH_OPTIONS.female,
        male: boothOptions.male ?? DEFAULT_BOOTH_OPTIONS.male,
      };
    }
    return { ...DEFAULT_BOOTH_OPTIONS };
  } catch (error) {
    handleError('ブース設定の読み込み', error);
    return { ...DEFAULT_BOOTH_OPTIONS };
  }
}

/**
 * ブース設定を Firestore に保存する
 * @param {string} collectionName - イベントの設定コレクション名
 * @param {number} year - 対象年
 * @param {{female: string[], male: string[]}} boothOptions - ブース設定
 * @returns {Promise<void>}
 */
export async function saveBoothConfig(collectionName, year, boothOptions) {
  try {
    const docRef = doc(db, collectionName, String(year));
    await setDoc(
      docRef,
      { eventYear: year, boothOptions, updatedAt: new Date() },
      { merge: true }
    );
  } catch (error) {
    handleError('ブース設定の保存', error);
  }
}
