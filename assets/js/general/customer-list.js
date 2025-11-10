import { db } from "../common/firebase-config.js";
import { collection, getDocs, query, where, orderBy } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { handleError } from "../common/utils/ui-utils.js";
import { setupAuth } from "../common/utils/auth-utils.js";
import { signInWithGoogle } from "../common/firebase-auth.js";
const RESERVATION_COLLECTION = "generalReservations";
const CUSTOMERS_COLLECTION = "generalCustomers";
document.addEventListener("alpine:init", () => {
  Alpine.data("app", () => ({
    customers: [],
    reservations: [],
    searchQuery: '',
    selectedCustomer: null,
    historyModalOpen: false,

    async init() {
      setupAuth(this);
      await this.loadCustomers();
      await this.loadReservations();
      this.mapReservationCounts();
    },

    login() {
      signInWithGoogle();
    },

    async loadCustomers() {
      try {
        const snap = await getDocs(query(collection(db, CUSTOMERS_COLLECTION)));
        this.customers = snap.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
      } catch (e) {
        handleError("顧客リスト読込", e);
      }
    },

    async loadReservations() {
      try {
        const snap = await getDocs(query(collection(db, RESERVATION_COLLECTION)));
        this.reservations = snap.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
      } catch (e) {
        handleError("予約データ読込", e);
      }
    },

    mapReservationCounts() {
      this.customers = this.customers.map(c => {
        const count = this.reservations.filter(r => r.customerId === c.id).length;
        return { ...c, reservationCount: count };
      });
    },

    get filteredCustomers() {
      return this.customers
        .filter(c => c.name.includes(this.searchQuery) || c.kana?.includes(this.searchQuery))
        .sort((a, b) => a.kana?.localeCompare(b.kana ?? "", "ja"));
    },

    formatDate(ts) {
      if (!ts) return "";
      const date = ts.toDate ? ts.toDate() : new Date(ts);
      return date.toLocaleDateString("ja-JP");
    },

    // モーダル開閉
    openHistoryModal(customer) {
      this.selectedCustomer = {
        ...customer,
        history: this.reservations
          .filter(r => r.customerId === customer.id)
          .sort((a, b) => new Date(b.date) - new Date(a.date))
      };
      this.historyModalOpen = true;
    },
    closeHistoryModal() {
      this.historyModalOpen = false;
      this.selectedCustomer = null;
    },

    // 新規予約作成
    openReservationForm(customer) {
      window.location.href = `../../../general/reservation-form.html?id=${customer.id}`;
    },

    openCustomerEdit(customer) {
      window.location.href = `../../../general/customer-form.html?id=${customer.id}`;
    },

    // 予約フォーム遷移（編集）
    openReservationEdit(reservation) {
      window.location.href = `../../../general/reservation-form.html?docId=${reservation.id}`;
    },

  }));
});
