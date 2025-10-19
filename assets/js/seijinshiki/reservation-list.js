import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { db } from '../common/firebase-config.js';
import { getYearSettings } from "../common/year-selector.js";
import { getDocsByYear } from "../common/utils/firestore-utils.js";
import { formatTimestamp } from '../common/utils/format-utils.js';
import { handleError } from "../common/utils/ui-utils.js";
import { STATUS_MAP } from "../common/constants.js";
const COLLECTION_NAME = 'seijinshiki';
document.addEventListener('alpine:init', () => {
  Alpine.data('app', () => ({
    ...getYearSettings("seijinshiki"),
    formatTimestamp,
    customers: [],
    boothOptionsFemale: ['A1', 'A2', 'B1', 'B2'],
    boothOptionsMale: ['C1', 'C2'],
    staffOptions: ['小林', '谷口', '大矢'],
    ...STATUS_MAP,

    init() {
      this.initYearSelector();
      this.load();
    },

    async load() {
      this.customers = [];
      try {
        this.customers = (await getDocsByYear(COLLECTION_NAME, this.selectedYear))
          .sort((a, b) => {
            // キャンセルの有無 → 時間の順
            const cancelOrder = Number(a.isCanceled) - Number(b.isCanceled);
            if (cancelOrder !== 0) return cancelOrder;
            return a.toujitsuInfo?.schedule[0]?.start.localeCompare(b.toujitsuInfo?.schedule[0]?.start);
          });
      } catch (error) {
        handleError('データの取得', error);
      }
    },

    async updateCustomerField(customerId, field, value) {
      try {
        const docRef = doc(db, COLLECTION_NAME, customerId);
        await updateDoc(docRef, { [field]: value });
      } catch (error) {
        handleError(`${field}の更新`, error);
      }
    },

    async updateStatus(customer) {
      try {
        const docRef = doc(db, COLLECTION_NAME, customer.id);
        const currentStatus = customer.status ?? '受付完了';
        if (!confirm(`${currentStatus}で間違いないですか？`)) return;

        const nextStatus = this.nextStatusMap[currentStatus];
        if (!nextStatus) return;

        customer.status = nextStatus;
        const timestampKey = this.statusToTimestampKey[currentStatus];
        (customer.statusTimestamps ??= {})[timestampKey] = new Date();

        await updateDoc(docRef, { ...customer });
      } catch (error) {
        handleError('ステータスの更新', error);
        this.load();
      }
    },

  }));
});
