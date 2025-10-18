import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { db } from '../common/firebase-config.js';
import { formatFullDateTime, formatTime, formatYen } from '../common/utils/format-utils.js';

document.addEventListener('alpine:init', () => {
  Alpine.data('printView', () => ({
    formatFullDateTime,
    formatTime,
    formatYen,
    // ===== State =====
    isLoading: true,
    error: null,
    representative: {},
    customers: [],
    femaleCount: 0,
    maleCount: 0,
    totalPrepayment: 0,
    totalOnSitePayment: 0,

    // ===== Computed Properties for Totals =====
    get groupTotalPrepayment() {
      if (!this.customers) return 0;
      return this.customers.reduce((total, customer) => total + this.calculateCustomerPrepayment(customer), 0);
    },

    get groupTotalOnSitePayment() {
      if (!this.customers) return 0;
      return this.customers.reduce((total, customer) => total + this.calculateCustomerOnSitePayment(customer), 0);
    },

    // ===== Initialization =====
    async init() {
      const params = new URLSearchParams(window.location.search);
      const groupId = params.get('docId');

      if (!groupId) {
        this.error = "予約IDが指定されていません。";
        this.isLoading = false;
        return;
      }

      await this.loadReservationData(groupId);
    },

    // ===== Data Loading =====
    async loadReservationData(groupId) {
      try {
        // NOTE: Assumes the collection is named 'machiaruki'
        const docRef = doc(db, 'machiaruki', groupId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          this.representative = data.representative || {};
          this.customers = data.customers || [];
          this.femaleCount = data.femaleCount ?? 0;
          this.maleCount = data.maleCount ?? 0;

          this.totalPrepayment = data.totalPrepayment ?? 0;
          this.totalOnSitePaymentAdjusted = data.totalOnSitePaymentAdjusted ?? 0;
          this.totalOnSitePayment = data.totalOnSitePayment ?? 0;
        } else {
          this.error = "指定された予約データが見つかりませんでした。";
        }
      } catch (e) {
        console.error("Error loading document:", e);
        this.error = "データの読み込み中にエラーが発生しました。";
      } finally {
        this.isLoading = false;
      }
    },

    // ===== Helper Functions =====
    getCheckpointLabel(key) {
      const labels = {
        rentalPage: 'きものレンタルページ',
        footwearBag: '履物バッグ',
        price: '料金',
        location: '当店の場所',
        parking: '駐車場'
      };
      return labels[key] || key;
    },


  }));
});
