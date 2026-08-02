import { doc, setDoc } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { db } from '../common/firebase-config.js';
import { getYearSettings } from "../common/year-selector.js";
import { getDocsByYear } from "../common/utils/firestore-utils.js";
import { formatYen } from "../common/utils/format-utils.js";
import { calculateCustomerPayment } from "../common/utils/calc-utils.js";
import { loadPriceConfig, DEFAULT_PRICES } from "../common/utils/price-config-utils.js";
import { setupAuth } from "../common/utils/auth-utils.js";
import { handleError } from "../common/utils/ui-utils.js";
const COLLECTION_NAME = 'fireworks';
const CONFIG_COLLECTION_NAME = 'fireworks_config';
document.addEventListener('alpine:init', () => {
  Alpine.data('app', () => ({
    ...getYearSettings(),
    formatYen,
    prices: { ...DEFAULT_PRICES },
    cashEntries: [],
    paypayEntries: [],
    denominations: [10000, 5000, 1000, 500, 100, 10],
    preparedCounts: {},
    currentCounts: {},

    async init() {
      setupAuth(this);
      this.initYearSelector();
      await this.load();
      await this.loadCashCounts();

      // 入力値をFirestoreに自動保存する（他端末とも共有・リロードや画面遷移でも消えないように）
      let isFirstRun = true;
      let saveTimer = null;
      Alpine.effect(() => {
        JSON.stringify(this.preparedCounts);
        JSON.stringify(this.currentCounts);
        if (isFirstRun) { isFirstRun = false; return; }
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => this.saveCashCounts(), 800);
      });
    },

    async loadCashCounts() {
      try {
        const configs = await getDocsByYear(CONFIG_COLLECTION_NAME, this.selectedYear);
        const cashCount = configs[0]?.cashCount;
        this.preparedCounts = cashCount?.prepared ?? {};
        this.currentCounts = cashCount?.current ?? {};
      } catch (error) {
        handleError('現金カウントの読み込み', error);
        this.preparedCounts = {};
        this.currentCounts = {};
      }
    },

    async saveCashCounts() {
      try {
        const docRef = doc(db, CONFIG_COLLECTION_NAME, String(this.selectedYear));
        await setDoc(docRef, {
          eventYear: this.selectedYear,
          cashCount: { prepared: this.preparedCounts, current: this.currentCounts },
          updatedAt: new Date(),
        }, { merge: true });
      } catch (error) {
        handleError('現金カウントの保存', error);
      }
    },

    async load() {
      this.prices = await loadPriceConfig(CONFIG_COLLECTION_NAME, this.selectedYear);
      const groups = await getDocsByYear(COLLECTION_NAME, this.selectedYear);

      const entries = groups
        .filter(group => !group.representative.isCanceled)
        .flatMap(group => group.customers.map(customer => {
          const paymentMethod = group.representative.paymentType === 'group'
            ? group.representative.groupPaymentMethod
            : customer.paymentMethod;
          const amount = calculateCustomerPayment({ formData: group, prices: this.prices }, customer, 'onSiteAdjusted', true);
          return {
            id: `${group.id}-${customer.id}`,
            docId: group.id,
            visitTime: group.representative.visitTime,
            representative: group.representative.name,
            name: customer.name,
            paymentMethod,
            amount,
          };
        }))
        .filter(entry => entry.amount > 0)
        .sort((a, b) => (a.visitTime ?? '').localeCompare(b.visitTime ?? ''));

      this.cashEntries = entries.filter(entry => entry.paymentMethod === '現金');
      this.paypayEntries = entries.filter(entry => entry.paymentMethod === 'PayPay');
    },

    get totalCash() {
      return this.cashEntries.reduce((sum, entry) => sum + entry.amount, 0);
    },

    get totalPaypay() {
      return this.paypayEntries.reduce((sum, entry) => sum + entry.amount, 0);
    },

    get preparedTotal() {
      return this.denominations.reduce((sum, denom) => sum + denom * (this.preparedCounts[denom] || 0), 0);
    },

    get currentTotal() {
      return this.denominations.reduce((sum, denom) => sum + denom * (this.currentCounts[denom] || 0), 0);
    },
  }));
});
