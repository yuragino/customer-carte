import { collection, getDocs, query, where, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { db } from "../firebase-config.js";

// データ取得
export async function getAllDocs(collectionName) {
  const colRef = collection(db, collectionName);
  const snapshot = await getDocs(colRef);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// 年指定付きデータ取得
export async function getDocsByYear(collectionName, year) {
  const yearQuery = query(collection(db, collectionName), where('eventYear', '==', year));
  const snapshot = await getDocs(yearQuery);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Firestore 操作ログを記録する汎用関数
 * @param {string} collectionName - 操作対象のコレクション名
 * @param {('create' | 'update' | 'delete')} actionType - 操作種別
 * @param {string} targetDocId - 対象ドキュメントID
 * @param {Object} data - 登録または更新するデータ
 * @param {Object} [options] - 追加オプション（user名など）
 */
export async function logFirestoreAction(collectionName, actionType, targetDocId, data) {
  const logCollectionRef = collection(db, 'firestore_action_logs');
  const logData = {
    actionType,
    targetDocId,
    collectionName,
    data, // 実際に扱ったデータ内容
    timestamp: serverTimestamp(),
  };

  try {
    await addDoc(logCollectionRef, logData);
    console.log(`[LOGGED] ${actionType} → ${collectionName}/${targetDocId}`);
  } catch (error) {
    console.error('ログ登録に失敗しました', error);
  }
}

