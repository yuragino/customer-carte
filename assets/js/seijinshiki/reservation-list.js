import { collection, getDocs, doc, updateDoc, serverTimestamp, getDoc, query, where } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { db } from '../common/firebase-config.js';
import { getYearSettings } from "../common/year-selector.js";
import { formatTimestamp } from '../common/utils/format-utils.js';
import { handleError } from "../common/utils/ui-utils.js";
const COLLECTION_NAME = 'seijinshiki';
document.addEventListener('alpine:init', () => {
  Alpine.data('app', () => ({
    ...getYearSettings(),
    formatTimestamp,
    customers: [],
    boothOptionsFemale: ['A1', 'A2', 'B1', 'B2'],
    boothOptionsMale: ['C1', 'C2'],
    staffOptions: ['佐藤', '鈴木', '松本'],

    nextStatusMap: {
      '受付完了': '案内完了',
      '案内完了': '着付完了',
      '着付完了': '見送り完了',
      '見送り完了': '済',
    },

    statusToTimestampKey: {
      '受付完了': 'receptionCompletedAt',
      '案内完了': 'guidanceCompletedAt',
      '着付完了': 'dressingCompletedAt',
      '見送り完了': 'sendOffCompletedAt',
    },

    init() {
      this.initYearSelector();
      this.loadReservationSchedule();
    },

    async loadReservationSchedule() {
      this.customers = [];
      try {
        const yearQuery = query(collection(db, COLLECTION_NAME), where('eventYear', '==', this.selectedYear));
        const snapshot = await getDocs(yearQuery);
        this.customers = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
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

    async updateCustomerField(customerId, field, value, checked = null) {
      try {
        const docRef = doc(db, COLLECTION_NAME, customerId);
        const docSnap = await getDoc(docRef);
        const customer = docSnap.data();
        // ===== フィールドごとの更新ロジック =====
        if (field === "staff") {
          const staffList = new Set(customer.staff ?? []);
          checked === true ? staffList.add(value) : staffList.delete(value);
          customer.staff = [...staffList];
        } else {
          customer[field] = value;
        }
        await updateDoc(docRef, { ...customer });
      } catch (error) {
        handleError(`${field}の更新`, error);
      }
    },

    async updateStatus(customer) {
      try {
        const docRef = doc(db, COLLECTION_NAME, customer.id);
        const currentStatus = customer.status ?? '受付完了';
        const nextStatus = this.nextStatusMap[currentStatus];
        if (!nextStatus) return;

        customer.status = nextStatus;
        const timestampKey = this.statusToTimestampKey[currentStatus];
        (customer.statusTimestamps ??= {})[timestampKey] = new Date();

        await updateDoc(docRef, { ...customer });
      } catch (error) {
        handleError('ステータスの更新', error);
        this.loadReservationSchedule();
      }
    },

    getStatusClass(status) {
      const currentStatus = status ?? '受付完了';
      const classMap = {
        '受付完了': 'status-received',
        '案内完了': 'status-guided',
        '着付完了': 'status-dressing-done',
        '見送り完了': 'status-sent-off',
        '済': 'status-completed',
      };
      return classMap[currentStatus] ?? 'status-received';
    },

  }));
});
