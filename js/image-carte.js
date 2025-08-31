import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

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
  Alpine.data('app', () => ({
    // --- ヘッダー関連 ---
    selectedYear: new Date().getFullYear(),
    get yearOptions() {
      const currentYear = new Date().getFullYear();
      return [currentYear + 1, currentYear, currentYear - 1, currentYear - 2, currentYear - 3];
    },

    customersWithImage: [],

    async init() {
      const params = new URLSearchParams(window.location.search);
      // URLからyearパラメータを取得し、なければ現在の年をデフォルト値にする
      const yearFromUrl = params.get('year');
      this.selectedYear = yearFromUrl ? Number(yearFromUrl) : new Date().getFullYear();

      await this.loadData();
    },

    async loadData() {
      const url = new URL(window.location.href);
      url.searchParams.set('year', this.selectedYear);
      window.history.pushState({}, '', url);
      try {
        const collectionName = `${this.selectedYear}_fireworks`;
        const colRef = collection(db, collectionName); // コレクション参照
        const snapshot = await getDocs(colRef);        // スナップショットを取得

        const customersList = [];

        snapshot.forEach(doc => {
          const data = doc.data();
          if (!data.customers) return;

          data.customers.forEach((customer, customerIndex) => {
            // imageUrls が存在し、かつ空でない場合のみ処理
            if (customer.imageUrls && customer.imageUrls.length > 0) {
              customersList.push({
                groupId: doc.id,
                id: `${doc.id}_${customer.firstName}_${customerIndex}`,
                name: `${customer.lastName}${customer.firstName}`,
                imageUrls: customer.imageUrls,
                currentIndex: 0,
              });
            }
          });
        });

        this.customersWithImage = customersList;
      } catch (error) {
        console.error('データ取得エラー:', error);
        alert('データの取得に失敗しました。');
      }
    },

    nextImage(cardIndex) {
      const customer = this.customersWithImage[cardIndex];
      customer.currentIndex = (customer.currentIndex + 1) % customer.imageUrls.length;
    },

    prevImage(cardIndex) {
      const customer = this.customersWithImage[cardIndex];
      customer.currentIndex =
        (customer.currentIndex - 1 + customer.imageUrls.length) % customer.imageUrls.length;
    },
  }));
});
// cSpell:ignore jalan kitsuke firestore geta yukata