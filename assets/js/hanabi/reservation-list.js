import { doc, getDoc, updateDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { setupAuth } from "../common/utils/auth-utils.js";
import { signInWithGoogle } from "../common/firebase-auth.js";
import { db } from '../common/firebase-config.js';
import { getYearSettings } from "../common/year-selector.js";
import { getDocsByYear } from "../common/utils/firestore-utils.js";
import { formatTimestamp } from '../common/utils/format-utils.js';
import { handleError } from "../common/utils/ui-utils.js";
import { calculateCustomerPayment } from "../common/utils/calc-utils.js";
import { STATUS_MAP } from "../common/constants.js";
import { loadStaffConfig, saveStaffConfig } from "../common/utils/staff-config-utils.js";
import { loadPriceConfig, savePriceConfig, DEFAULT_PRICES } from "../common/utils/price-config-utils.js";
import { loadBoothConfig, saveBoothConfig, DEFAULT_BOOTH_OPTIONS } from "../common/utils/booth-config-utils.js";
const COLLECTION_NAME = 'fireworks';
const CONFIG_COLLECTION_NAME = 'fireworks_config';   // 年次設定関連
document.addEventListener('alpine:init', () => {
  Alpine.data('app', () => ({
    ...getYearSettings(),
    formatTimestamp,
    groups: [],
    boothOptions: { ...DEFAULT_BOOTH_OPTIONS },
    ...STATUS_MAP,
    openSettings: false,
    openPriceSettings: false,
    settings: {
      staff: '',
      boothFemale: '',
      boothMale: '',
    },
    prices: { ...DEFAULT_PRICES },
    eventMemo: '',
    notesModal: {
      isOpen: false,
      content: '',
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
            return (a.representative.visitTime ?? '').localeCompare(b.representative.visitTime ?? '');
          });
      } catch (error) {
        handleError('データの取得', error);
      }
    },

    async loadConfig() {
      this.staffOptions = await loadStaffConfig(CONFIG_COLLECTION_NAME, this.selectedYear);
      this.settings.staff = this.staffOptions.join(' ');
      this.boothOptions = await loadBoothConfig(CONFIG_COLLECTION_NAME, this.selectedYear);
      this.settings.boothFemale = this.boothOptions.female.join(' ');
      this.settings.boothMale = this.boothOptions.male.join(' ');
      this.prices = await loadPriceConfig(CONFIG_COLLECTION_NAME, this.selectedYear);
      const configs = await getDocsByYear(CONFIG_COLLECTION_NAME, this.selectedYear);
      this.eventMemo = configs[0]?.eventMemo ?? '';
    },

    async saveEventMemo() {
      try {
        const docRef = doc(db, CONFIG_COLLECTION_NAME, String(this.selectedYear));
        await setDoc(docRef, { eventYear: this.selectedYear, eventMemo: this.eventMemo, updatedAt: new Date() }, { merge: true });
      } catch (error) {
        handleError('メモの保存', error);
      }
    },

    async saveSettings() {
      const staffOptions = this.settings.staff
        .split(/\s+/)
        .map(s => s.trim())
        .filter(Boolean);
      const boothOptions = {
        female: this.settings.boothFemale.split(/\s+/).map(s => s.trim()).filter(Boolean),
        male: this.settings.boothMale.split(/\s+/).map(s => s.trim()).filter(Boolean),
      };

      await saveStaffConfig(CONFIG_COLLECTION_NAME, this.selectedYear, staffOptions);
      await saveBoothConfig(CONFIG_COLLECTION_NAME, this.selectedYear, boothOptions);
      this.staffOptions = staffOptions;
      this.boothOptions = boothOptions;
      this.openSettings = false;
    },

    async savePriceConfig() {
      await savePriceConfig(CONFIG_COLLECTION_NAME, this.selectedYear, this.prices);
      this.openPriceSettings = false;
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

    hasOnSitePayment(group, customer) {
      return calculateCustomerPayment({ formData: group, prices: this.prices }, customer, 'onSite') > 0;
    },

    openNotesModal(notes) {
      this.notesModal.content = notes;
      this.notesModal.isOpen = true;
    },

    allNotStarted(group) {
      return group.customers.every(customer => !customer.status);
    },

    async startGroupReception(group) {
      if (!confirm('受付開始で間違いないですか？')) return;
      try {
        const docRef = doc(db, COLLECTION_NAME, group.id);
        const now = new Date();
        const timestampKey = this.statusToTimestampKey['受付開始'];
        group.customers.forEach(customer => {
          customer.status = this.nextStatusMap['受付開始'];
          (customer.statusTimestamps ??= {})[timestampKey] = now;
        });

        await updateDoc(docRef, { customers: group.customers });
      } catch (error) {
        handleError('ステータスの更新', error);
      }
    },

    readyForGroupSendOff(group) {
      return group.customers.every(customer => customer.status === '着付完了' && customer.waitingForSendOff);
    },

    isGroupFinished(group) {
      return group.customers.every(customer => customer.status === '済');
    },

    async confirmDressingComplete(group, customerId) {
      if (!confirm('着付完了で間違いないですか？')) return;
      try {
        const docRef = doc(db, COLLECTION_NAME, group.id);
        const customer = group.customers.find(c => c.id === customerId);
        customer.waitingForSendOff = true;
        await updateDoc(docRef, { customers: group.customers });
      } catch (error) {
        handleError('ステータスの更新', error);
      }
    },

    async completeGroupSendOff(group) {
      if (!confirm('見送り完了で間違いないですか？')) return;
      try {
        const docRef = doc(db, COLLECTION_NAME, group.id);
        const now = new Date();
        const timestampKey = this.statusToTimestampKey['見送り完了'];
        group.customers.forEach(customer => {
          customer.status = this.nextStatusMap['見送り完了'];
          customer.waitingForSendOff = false;
          (customer.statusTimestamps ??= {})[timestampKey] = now;
        });

        await updateDoc(docRef, { customers: group.customers });
      } catch (error) {
        handleError('ステータスの更新', error);
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
