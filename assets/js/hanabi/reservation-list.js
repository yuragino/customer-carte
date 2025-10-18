import { collection, getDocs, doc, getDoc, updateDoc, query, where } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { db } from '../common/firebase-config.js';
import { getYearSettings } from "../common/year-selector.js";
import { getDocsByYear, STATUS_MAP } from "../common/utils/firestore-utils.js";
import { formatTimestamp } from '../common/utils/format-utils.js';
import { handleError } from "../common/utils/ui-utils.js";
const COLLECTION_NAME = 'fireworks';
document.addEventListener('alpine:init', () => {
  Alpine.data('app', () => ({
    ...getYearSettings(),
    formatTimestamp,
    groups: [],
    boothOptionsFemale: ['A1', 'A2', 'B1', 'B2'],
    boothOptionsMale: ['C1', 'C2', 'B1', 'B2'],
    staffOptions: ['佐藤', '鈴木', '松本'],
    ...STATUS_MAP,

    init() {
      this.initYearSelector();
      this.load();
    },

    async load() {
      this.groups = [];
      try {
        this.groups = (await getDocsByYear(COLLECTION_NAME, this.selectedYear))
          .sort((a, b) => {
            // キャンセルの有無 → 時間の順
            const cancelOrder = Number(a.representative.isCanceled) - Number(b.representative.isCanceled);
            if (cancelOrder !== 0) return cancelOrder;
            return a.representative?.visitTime.localeCompare(b.representative?.visitTime);
          });
      } catch (error) {
        handleError('データの取得', error);
      }
    },

    async updateCustomerField(groupId, customerId, field, value, checked = null) {
      try {
        const docRef = doc(db, COLLECTION_NAME, groupId);
        const docSnap = await getDoc(docRef);

        const customers = docSnap.data().customers;
        const target = customers.find(c => c.id === customerId);

        // ===== フィールドごとの更新ロジック =====
        if (field === "staff") {
          const staffList = new Set(target.staff ?? []);
          checked === true ? staffList.add(value) : staffList.delete(value);
          target.staff = [...staffList];
        } else {
          target[field] = value;
        }
        await updateDoc(docRef, { customers });
      } catch (error) {
        handleError(`${field}の更新`, error);
      }
    },

    async updateStatus(group, customerId) {
      try {
        const docRef = doc(db, COLLECTION_NAME, group.id);
        const customer = group.customers.find(c => c.id === customerId);

        const currentStatus = customer.status ?? '受付完了';
        const nextStatus = this.nextStatusMap[currentStatus];
        if (!nextStatus) return;

        customer.status = nextStatus;
        const timestampKey = this.statusToTimestampKey[currentStatus];
        (customer.statusTimestamps ??= {})[timestampKey] = new Date();

        await updateDoc(docRef, { customers: group.customers });
      } catch (error) {
        handleError('ステータスの更新', error);
        this.load();
      }
    },

  }));
});
