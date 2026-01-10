import { getYearSettings } from "../common/year-selector.js";
import { getDocsByYear } from "../common/utils/firestore-utils.js";
import { handleError } from "../common/utils/ui-utils.js";
import { setupAuth } from "../common/utils/auth-utils.js";
const COLLECTION_NAME = 'fireworks';
document.addEventListener('alpine:init', () => {
  Alpine.data('app', () => ({
    ...getYearSettings(),
    customers: [],

    init() {
      setupAuth(this);
      this.initYearSelector();
      this.load();
    },

    async load() {
      try {
        const snapshot = await getDocsByYear(COLLECTION_NAME, this.selectedYear);
        this.customers = snapshot.flatMap(doc =>
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

    nextImage(customerIndex) {
      const customer = this.customers[customerIndex];
      customer.currentIndex = (customer.currentIndex + 1) % customer.imageUrls.length;
    },

    prevImage(customerIndex) {
      const customer = this.customers[customerIndex];
      customer.currentIndex = (customer.currentIndex + customer.imageUrls.length - 1) % customer.imageUrls.length;
    },

  }));
});
