import { collection, getDocs } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { db } from '../common/firebase-config.js';

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
        const colRef = collection(db, collectionName);
        const snapshot = await getDocs(colRef);

        const customersList = [];

        snapshot.forEach(doc => {
          const data = doc.data();
          if (!data.customers) return;

          data.customers.forEach((customer, customerIndex) => {
            // imageUrlsがない場合でも空の配列を設定することで、カードが作成される
            customersList.push({
              groupId: doc.id,
              id: `${doc.id}_${customer.firstName}_${customerIndex}`,
              name: `${customer.lastName}${customer.firstName}`,
              imageUrls: customer.imageUrls || [],
              currentIndex: 0,
            });
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
