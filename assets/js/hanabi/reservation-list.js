import { collection, getDocs, doc, getDoc, updateDoc, query, where } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { db } from '../common/firebase-config.js';
import { getYearSettings } from "../common/year-selector.js";
import { formatTimestamp } from '../common/utils/format-utils.js';
const COLLECTION_NAME = 'fireworks';
document.addEventListener('alpine:init', () => {
  Alpine.data('app', () => ({
    ...getYearSettings(),
    formatTimestamp,
    groups: [],
    boothOptionsFemale: ['A1', 'A2', 'B1', 'B2'],
    boothOptionsMale: ['C1', 'C2', 'B1', 'B2'],
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
      this.groups = [];
      try {
        const yearQuery = query(collection(db, COLLECTION_NAME), where('eventYear', '==', this.selectedYear));
        const snapshot = await getDocs(yearQuery);
        this.groups = snapshot.docs
          .map(doc => ({ groupId: doc.id, ...doc.data() }))
          .sort((a, b) => {
            // キャンセルの有無 → 時間の順
            const cancelOrder = Number(a.representative.isCanceled) - Number(b.representative.isCanceled);
            if (cancelOrder !== 0) return cancelOrder;
            return a.representative.visitTime.localeCompare(b.representative.visitTime);
          });
      } catch (error) {
        console.error("Error fetching schedule: ", error);
        alert("データの取得に失敗しました。");
      }
    },

    async updateCustomerField(groupId, customerId, field, value, checked = null) {
      try {
        const docRef = doc(db, COLLECTION_NAME, groupId);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) throw new Error("Document not found");

        const customers = docSnap.data().customers;
        const target = customers.find(c => c.id === customerId);
        if (!target) throw new Error("Customer not found");

        // ===== フィールドごとの更新ロジック =====
        if (field === "staff") {
          const staffList = new Set(target.staff ?? []);
          if (checked === true) {
            staffList.add(value);
          } else {
            staffList.delete(value);
          }
          target.staff = Array.from(staffList);
        } else {
          target[field] = value;
        }
        await updateDoc(docRef, { customers });
      } catch (error) {
        console.error(`Error updating ${field}:`, error);
        alert(`${field}の更新に失敗しました。`);
      }
    },

    async updateStatus(group, customerId) {
      try {
        const docRef = doc(db, COLLECTION_NAME, group.groupId);
        const customer = group.customers.find(c => c.id === customerId);
        if (!customer) throw new Error("Customer not found");

        const currentStatus = customer.status ?? '受付完了';
        const nextStatus = this.nextStatusMap[currentStatus];
        if (!nextStatus) return;

        customer.status = nextStatus;
        const timestampKey = this.statusToTimestampKey[currentStatus];
        (customer.statusTimestamps ??= {})[timestampKey] = new Date();

        await updateDoc(docRef, { customers: group.customers });
      } catch (error) {
        console.error("ステータス更新エラー:", error);
        alert("ステータス更新に失敗しました。");
        this.loadReservationSchedule();
      }
    },

    getStatusClass(status) {
      const currentStatus = status || '受付完了';
      const classMap = {
        '受付完了': 'status-received',
        '案内完了': 'status-guided',
        '着付完了': 'status-dressing-done',
        '見送り完了': 'status-sent-off',
        '済': 'status-completed',
      };
      return classMap[currentStatus] || 'status-received';
    },
  }));
});
