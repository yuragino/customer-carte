import { doc, getDoc, updateDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { setupAuth } from "../common/utils/auth-utils.js";
import { signInWithGoogle } from "../common/firebase-auth.js";
import { db } from '../common/firebase-config.js';
import { getYearSettings } from "../common/year-selector.js";
import { getDocsByYear } from "../common/utils/firestore-utils.js";
import { formatTimestamp } from '../common/utils/format-utils.js';
import { handleError } from "../common/utils/ui-utils.js";
import { STATUS_MAP } from "../common/constants.js";
import { loadStaffConfig, saveStaffConfig } from "../common/utils/staff-config-utils.js";
const COLLECTION_NAME = 'fireworks';
const CONFIG_COLLECTION_NAME = 'fireworks_config';   // 年次設定関連
document.addEventListener('alpine:init', () => {
  Alpine.data('app', () => ({
    ...getYearSettings(),
    formatTimestamp,
    groups: [],
    boothOptionsFemale: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
    boothOptionsMale: ['C1', 'C2', 'B1', 'B2'],
    ...STATUS_MAP,
    openSettings: false,
    settings: {
      staff: '',
    },

    async init() {
      setupAuth(this);
      this.initYearSelector();
      await this.loadConfig();  // ← 設定読み込み
      await this.load();        // ← 顧客データ読み込み
    },
    
    async load() {
      this.groups = [];
      try {
        this.groups = (await getDocsByYear(COLLECTION_NAME, this.selectedYear))
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

    async loadConfig() {
      this.staffOptions = await loadStaffConfig(CONFIG_COLLECTION_NAME, this.selectedYear);
      this.settings.staff = this.staffOptions.join(' ');
    },

    async saveStaffConfig() {
      const staffOptions = this.settings.staff
        .split(/\s+/)
        .map(s => s.trim())
        .filter(Boolean);

      await saveStaffConfig(CONFIG_COLLECTION_NAME, this.selectedYear, staffOptions);
      this.staffOptions = staffOptions;
      this.openSettings = false;
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
        const currentStatus = customer.status ?? '受付開始';
        if (!confirm(`${currentStatus}で間違いないですか？`)) return;

        const nextStatus = this.nextStatusMap[currentStatus];
        if (!nextStatus) return;

        customer.status = nextStatus;
        const timestampKey = this.statusToTimestampKey[currentStatus];
        (customer.statusTimestamps ??= {})[timestampKey] = new Date();

        await updateDoc(docRef, { customers: group.customers });
      } catch (error) {
        handleError('ステータスの更新', error);
      }
    },

  }));
});
