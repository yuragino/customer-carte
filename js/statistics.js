import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

// Firebase 初期化
const firebaseConfig = {
  apiKey: "AIzaSyBOMtAoCObyoalTk6_nVpGlsnLcGSw4Jzc",
  authDomain: "kimono-coordinate.firebaseapp.com",
  databaseURL: "https://kimono-coordinate-default-rtdb.firebaseio.com",
  projectId: "kimono-coordinate",
  storageBucket: "kimono-coordinate.firebasestorage.app",
  messagingSenderId: "399031825104",
  appId: "1:399031825104:web:639225192503ab895724d5",
  measurementId: "G-MCBZVD9D22"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

document.addEventListener('alpine:init', () => {
  Alpine.data('statisticsPage', () => ({
    selectedYear: new Date().getFullYear(),
    customerStats: [],

    async init() {
      const params = new URLSearchParams(window.location.search);
      const yearFromUrl = params.get('year');
      this.selectedYear = yearFromUrl ? parseInt(yearFromUrl) : new Date().getFullYear();

      await this.loadStatistics();
    },

    async loadStatistics() {
      const colRef = collection(db, `${this.selectedYear}_fireworks`);
      const snapshot = await getDocs(colRef);

      const stats = [];

      snapshot.forEach(doc => {
        const group = doc.data();
        if (!group.customers) return;

        group.customers.forEach(cust => {
          const ts = cust.statusTimestamps || {};

          const reception = ts.receptionCompletedAt?.toDate();
          const guidance = ts.guidanceCompletedAt?.toDate();
          const dressing = ts.dressingCompletedAt?.toDate();
          const sendoff = ts.sendOffCompletedAt?.toDate();

          // 差分計算（分単位）
          const guideToDress = (guidance && dressing) ? (dressing - guidance) / 60000 : null;
          const dressToSendOff = (dressing && sendoff) ? (sendoff - dressing) / 60000 : null;
          const total = (reception && sendoff) ? (sendoff - reception) / 60000 : null;

          stats.push({
            id: `${doc.id}_${cust.id}`,
            representative: (group.representative?.lastName || '') + (group.representative?.firstName || ''),
            name: (cust.lastName || '') + (cust.firstName || ''),
            receptionTime: reception ? `${reception.getHours().toString().padStart(2, '0')}:${reception.getMinutes().toString().padStart(2, '0')}` : null,
            guideToDress: guideToDress ? guideToDress.toFixed(1) : null,
            dressToSendOff: dressToSendOff ? dressToSendOff.toFixed(1) : null,
            total: total ? total.toFixed(1) : null,
            receptionDate: reception || null // ソート用
          });
        });
      });

      // 受付時間順に並べる
      this.customerStats = stats.sort((a, b) => {
        if (!a.receptionDate) return 1;
        if (!b.receptionDate) return -1;
        return a.receptionDate - b.receptionDate;
      });
    }
  }))
});

// cSpell:ignore firestore