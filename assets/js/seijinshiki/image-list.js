import { getYearSettings } from "../common/year-selector.js";
import { getDocsByYear } from "../common/utils/firestore-utils.js";
import { normalizeText } from "../common/utils/format-utils.js";
import { storage } from "../common/utils/storage-utils.js";
const COLLECTION_NAME = 'seijinshiki';
document.addEventListener('alpine:init', () => {
  Alpine.data('app', () => ({
    ...getYearSettings("seijinshiki"),
    customers: [],
    searchQuery: '',
    openAccordionIds: [],
    selectedImageUrl: null,

    get storageKey() {
      return `seijinshiki-open-accordion-${this.selectedYear}`;
    },

    get searchedCustomers() {
      const query = normalizeText(this.searchQuery);
      return this.customers.filter(c => {
        const kana = normalizeText(c.basicInfo.kana);
        const name = normalizeText(c.basicInfo.name);
        return kana.includes(query) || name.includes(query);
      });
    },

    async init() {
      this.initYearSelector();
      this.customers = await getDocsByYear(COLLECTION_NAME, this.selectedYear);
      this.openAccordionIds = storage.load(this.storageKey, []);
    },

    openImageModal(url) {
      this.selectedImageUrl = url;
    },

    isAccordionOpen(customerId) {
      return this.openAccordionIds.includes(customerId);
    },

    toggleAccordion(customerId) {
      if (this.isAccordionOpen(customerId)) {
        this.openAccordionIds = this.openAccordionIds.filter(openId => openId !== customerId);
      } else {
        this.openAccordionIds.push(customerId);
      }
      storage.save(this.storageKey, this.openAccordionIds);
    },

  }));
});
