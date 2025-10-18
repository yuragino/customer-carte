import { collection, getDocs } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { db } from '../common/firebase-config.js';
import { getYearSettings } from "../common/year-selector.js";
import { getDocsByYear } from "../common/utils/firestore-utils.js";
const COLLECTION_NAME = 'seijinshiki';

function normalizeForSearch(str) {
  if (!str) return "";
  return str
    .normalize("NFKC")   // 全角半角を揃える
    .replace(/\s+/g, "");// スペース削除
}

document.addEventListener('alpine:init', () => {
  Alpine.data('app', () => ({
    ...getYearSettings("seijinshiki"),
    customers: [],
    openAccordions: JSON.parse(localStorage.getItem('openAccordions') || '[]'),
    searchQuery: '',

    async init() {
      this.initYearSelector();
      this.customers = await getDocsByYear(COLLECTION_NAME, this.selectedYear);
    },

    isOpen(id) {
      return this.openAccordions.includes(id);
    },

    toggleAccordion(id) {
      if (this.isOpen(id)) {
        this.openAccordions = this.openAccordions.filter(x => x !== id);
      } else {
        this.openAccordions.push(id);
      }
      localStorage.setItem("openAccordions", JSON.stringify(this.openAccordions));
    },

    // 随時絞り込み（ひらがな/漢字両対応・スペース無視）
    get filteredCustomers() {
      if (!this.searchQuery) return this.customers;
      const query = normalizeForSearch(this.searchQuery);

      return this.customers.filter(c => {
        const kana = normalizeForSearch(c.basicInfo.kana || "");
        const name = normalizeForSearch(c.basicInfo.name || "");
        return kana.includes(query) || name.includes(query);
      });
    },
  }));
});
