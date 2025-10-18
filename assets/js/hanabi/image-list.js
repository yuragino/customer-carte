import { collection, getDocs } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { db } from '../common/firebase-config.js';
import { getYearSettings } from "../common/year-selector.js";
import { handleError } from "../common/utils/ui-utils.js";
const COLLECTION_NAME = 'fireworks';
document.addEventListener('alpine:init', () => {
  Alpine.data('app', () => ({
    ...getYearSettings(),
    customersWithImage: [],

    async init() {
      this.initYearSelector();
      await this.loadData();
    },

    async loadData() {
      try {
        const colRef = collection(db, COLLECTION_NAME);
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
        handleError('データの取得', error);
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
