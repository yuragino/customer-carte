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
                name: `${customer.lastName}${customer.firstName}`,
                imageUrls: customer.imageUrls,
                currentIndex: 0, // ★ 新しいプロパティを追加: 現在表示中の画像インデックス
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

    /**
     * 次の画像に切り替える
     * @param {number} cardIndex - 切り替えるカードのインデックス
     */
    nextImage(cardIndex) {
      const customer = this.customersWithImage[cardIndex];
      customer.currentIndex = (customer.currentIndex + 1) % customer.imageUrls.length;
    },

    /**
     * 前の画像に切り替える
     * @param {number} cardIndex - 切り替えるカードのインデックス
     */
    prevImage(cardIndex) {
      const customer = this.customersWithImage[cardIndex];
      customer.currentIndex = (customer.currentIndex - 1 + customer.imageUrls.length) % customer.imageUrls.length;
    },
  }));
});
// cSpell:ignore jalan kitsuke firestore geta yukata