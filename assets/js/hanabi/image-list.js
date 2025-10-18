import { collection, getDocs } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { db } from '../common/firebase-config.js';
import { getYearSettings } from "../common/year-selector.js";
import { getDocsByYear } from "../common/utils/firestore-utils.js";
import { handleError } from "../common/utils/ui-utils.js";
const COLLECTION_NAME = 'fireworks';
document.addEventListener('alpine:init', () => {
  Alpine.data('app', () => ({
    ...getYearSettings(),
    customersWithImage: [],

    init() {
      this.initYearSelector();
      this.load();
    },

    async load() {
      try {
        const snapshot = await getDocsByYear(COLLECTION_NAME, this.selectedYear);
        this.customersWithImage = snapshot.flatMap(doc =>
          doc.customers.map(customer => ({
            id: doc.id,
            name: customer.name,
            imageUrls: customer.imageUrls || [],
            currentIndex: 0,
          }))
        )
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
