import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

// ----- FirebaseとCloudinaryの設定 -----
const firebaseConfig = {
  apiKey: "AIzaSyBOMtAoCObyoalTk6_nVpGlsnLcGSw4Jzc",
  authDomain: "kimono-coordinate.firebaseapp.com",
  databaseURL: "https://kimono-coordinate-default-rtdb.firebaseio.com",
  projectId: "kimono-coordinate",
  storageBucket: "kimono-coordinate.firebasestorage.app",
  messagingSenderId: "399031825104",
  appId: "1:399031825104:web:5ea4da3fb129cf935724d5",
  measurementId: "G-VVTT0QVXQQ"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ----- Alpine.js Component -----
document.addEventListener('alpine:init', () => {
  Alpine.data('printView', () => ({
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
      const groupId = params.get('group');

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
    formatDateTime(isoString) {
      if (!isoString) return '-';
      try {
        const date = new Date(isoString);
        if (isNaN(date)) return '-';
        const day = ["日", "月", "火", "水", "木", "金", "土"][date.getDay()];
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const dayOfMonth = date.getDate();
        const hours = date.getHours();
        const minutes = String(date.getMinutes()).padStart(2, '0');

        return `${year}年${month}月${dayOfMonth}日（${day}）${hours}:${minutes}`;
      } catch (e) {
        return '-';
      }
    },
    formatTime(timeStr) {
      if (!timeStr) return '-';
      try {
        const d = new Date(`1970-01-01T${timeStr}`);
        if (isNaN(d)) return '-';
        const h = d.getHours(); // ← ゼロ埋めしない
        const m = String(d.getMinutes()).padStart(2, '0'); // ← 分だけ2桁固定
        return `${h}:${m}`;
      } catch (e) {
        return '-';
      }
    },

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
