import { addDoc, onSnapshot, collection } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { db } from "./common/firebase-config.js";
import { getAllDocs } from "./common/utils/firestore-utils.js";
const COLLECTION_NAME = "activityLogs";
document.addEventListener('alpine:init', () => {
  Alpine.data('app', () => ({
    logs: [],
    docs:[],

    async init() {
      const targets = ["fireworks", "machiaruki", "seijinshiki"];
      this.docs = await getAllDocs(COLLECTION_NAME);

      targets.forEach((col) => {
        onSnapshot(collection(db, col), async (snapshot) => {
          snapshot.docChanges().forEach(async (change) => {
            if (change.type === "removed") return;
            const now = new Date();
            const expireAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30日後

            // const Y = now.getFullYear();
            // const M = String(now.getMonth() + 1).padStart(2, "0");
            // const D = String(now.getDate()).padStart(2, "0");
            // const h = String(now.getHours()).padStart(2, "0");
            // const m = String(now.getMinutes()).padStart(2, "0");
            // const s = String(now.getSeconds()).padStart(2, "0");
            // const docId = `${Y}-${M}-${D}-${h}-${m}-${s}`;

            const logEntry = {
              collection: col,
              documentId: change.doc.id,
              type: change.type,
              data: change.doc.data(),
              timestamp: now.toISOString(),
              expireAt: expireAt,
            };
            // 画面表示用ログ
            this.logs.push(logEntry);


            // Firestore にも保存
            await addDoc(collection(db, COLLECTION_NAME), logEntry);
            // await setDoc(doc(db, "activityLogs", docId), logEntry);
          });
        });
      });
    },

  }));
});

