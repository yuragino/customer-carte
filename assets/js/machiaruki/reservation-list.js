import { getAllDocs } from "../common/utils/firestore-utils.js";
import { setupAuth } from "../common/utils/auth-utils.js";
import { handleError } from "../common/utils/ui-utils.js";
import { formatFullDateTime } from "../common/utils/format-utils.js";
import { normalizeText } from "../common/utils/format-utils.js";
const COLLECTION_NAME = 'machiaruki';
document.addEventListener('alpine:init', () => {
  Alpine.data('app', () => ({
    formatFullDateTime,
    isLoggedIn: false,
    searchQuery: '',

    get searchedGroups() {
      const query = normalizeText(this.searchQuery);
      return this.groups.filter(g => {
        const kana = normalizeText(g.representative.kana);
        const name = normalizeText(g.representative.name);
        const matchRepresentative = kana.includes(query) || name.includes(query);
        const matchCustomers = g.customers.some(c => {
          const customerName = normalizeText(c.name);
          const customerKana = normalizeText(c.kana);
          return customerName.includes(query) || customerKana.includes(query);
        });
        return matchRepresentative || matchCustomers;
      });
    },

    init() {
      setupAuth(this);
      this.load();
    },

    async load() {
      this.groups = [];
      try {
        this.groups = (await getAllDocs(COLLECTION_NAME))
          .sort((a, b) => {
            // キャンセルの有無 → 時間の順
            const cancelOrder = Number(a.representative.isCanceled) - Number(b.representative.isCanceled);
            if (cancelOrder !== 0) return cancelOrder;
            return a.representative.visitDateTime.localeCompare(b.representative.visitDateTime);
          });
      } catch (error) {
        handleError('データの取得', error);
      }
    },

  }));
});
