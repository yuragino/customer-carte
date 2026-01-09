import { getYearSettings } from "../common/year-selector.js";
import { getDocsByYear } from "../common/utils/firestore-utils.js";
import { storage } from "../common/utils/storage-utils.js";

const COLLECTION_NAME = 'seijinshiki';

document.addEventListener('alpine:init', () => {
  Alpine.data('app', () => ({
    ...getYearSettings("seijinshiki"),
    customers: [],
    currentIndex: 0,
    selectedImageUrl: null,

    async init() {
      this.initYearSelector();
      this.customers = await getDocsByYear(COLLECTION_NAME, this.selectedYear);
      this.currentIndex = 0;
    },

    get currentCustomer() {
      return this.customers[this.currentIndex] || {
        basicInfo: { name: '' },
        media: { imageUrls: [], videoUrls: [] }
      };
    },

    openImageModal(url) {
      this.selectedImageUrl = url;
    },

    prevCustomer() {
      if (this.customers.length === 0) return;
      this.currentIndex = this.currentIndex === 0 ? this.customers.length - 1 : this.currentIndex - 1;
    },

    nextCustomer() {
      if (this.customers.length === 0) return;
      this.currentIndex = this.currentIndex === this.customers.length - 1 ? 0 : this.currentIndex + 1;
    },
    
  }));
});
