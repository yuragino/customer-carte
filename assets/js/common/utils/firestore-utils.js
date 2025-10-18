import { collection, getDocs, updateDoc, query, where } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { db } from "../firebase-config.js";

// 年指定付きデータ取得
export async function getDocsByYear(collectionName, year) {
  const yearQuery = query(collection(db, collectionName), where('eventYear', '==', year));
  const snapshot = await getDocs(yearQuery);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// ステータス関連ユーティリティ
export const STATUS_MAP = {
  nextStatusMap: {
    '受付完了': '案内完了',
    '案内完了': '着付完了',
    '着付完了': '見送り完了',
    '見送り完了': '済',
  },
  statusToTimestampKey: {
    '受付完了': 'receptionCompletedAt',
    '案内完了': 'guidanceCompletedAt',
    '着付完了': 'dressingCompletedAt',
    '見送り完了': 'sendOffCompletedAt',
  },
  getStatusClass(status) {
    const current = status ?? '受付完了';
    return {
      '受付完了': 'status-received',
      '案内完了': 'status-guided',
      '着付完了': 'status-dressing-done',
      '見送り完了': 'status-sent-off',
      '済': 'status-completed',
    }[current] ?? 'status-received';
  }
};
