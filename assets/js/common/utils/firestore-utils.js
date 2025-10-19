import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
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
