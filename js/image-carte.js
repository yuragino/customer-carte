import { firestore } from "./firebase.js";

document.addEventListener('alpine:init', () => {
  Alpine.data('app', () => ({
    // --- ヘッダー関連 ---
    selectedYear: new Date().getFullYear(),
    get yearOptions() {
      const currentYear = new Date().getFullYear();
      return [currentYear, currentYear + 1, currentYear - 1, currentYear - 2, currentYear - 3];
    },

    customersWithImage: [],

    async init() {
      this.$watch('selectedYear', () => this.loadData());
      await this.loadData();
    },

    async loadData() {
      try {
        const collectionName = `${this.selectedYear}_fireworks`;
        const snapshot = await firestore.collection(collectionName).get();
        const customersList = [];

        snapshot.forEach(doc => {
          const data = doc.data();
          if (!data.customers) return;

          data.customers.forEach((customer, customerIndex) => {
            // imageUrls が存在し、空でない場合のみ処理
            if (customer.imageUrls && customer.imageUrls.length > 0) {
              customersList.push({
                groupId: doc.id,
                // ユニークなキーを生成
                id: `${doc.id}_${customer.firstName}_${customerIndex}`,
                // 代表者名と顧客名を連結
                name: `${customer.lastName}${customer.firstName}`,
                height: customer.height || '',
                footSize: customer.footSize || '',
                imageUrls: customer.imageUrls,
                // 来店時間を代表者情報から取得
                visitTime: data.representative.visitTime || '',
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
  }));
});
// cSpell:ignore jalan kitsuke firestore geta yukata