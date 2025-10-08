import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

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

// 文字正規化（スペース無視）
function normalizeForSearch(str) {
  if (!str) return "";
  return str
    .normalize("NFKC")   // 全角半角を揃える
    .replace(/\s+/g, "");// スペース削除
}

document.addEventListener('alpine:init', () => {
  Alpine.data('app', () => ({
    customers: [],
    openAccordions: JSON.parse(localStorage.getItem('openAccordions') || '[]'),
    searchQuery: '',
    selectedYear: new Date().getFullYear(),

    get yearOptions() {
      const currentYear = new Date().getFullYear();
      return [currentYear + 1, currentYear, currentYear - 1, currentYear - 2];
    },

    async init() {
      const params = new URLSearchParams(window.location.search);
      const yearFromUrl = params.get('year');
      this.selectedYear = yearFromUrl ? Number(yearFromUrl) : new Date().getFullYear();
      const snapshot = await getDocs(collection(db, `${this.selectedYear}_seijinshiki`));
      this.customers = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    },

    changeYear() {
      const url = new URL(window.location.href);
      url.searchParams.set("year", this.selectedYear);
      window.history.pushState({}, "", url);
      this.init();
    },

    isOpen(id) {
      return this.openAccordions.includes(id);
    },

    toggleAccordion(id) {
      if (this.isOpen(id)) {
        this.openAccordions = this.openAccordions.filter(x => x !== id);
      } else {
        this.openAccordions.push(id);
      }
      localStorage.setItem("openAccordions", JSON.stringify(this.openAccordions));
    },

    // 随時絞り込み（ひらがな/漢字両対応・スペース無視）
    get filteredCustomers() {
      if (!this.searchQuery) return this.customers;
      const query = normalizeForSearch(this.searchQuery);

      return this.customers.filter(c => {
        const kana = normalizeForSearch(c.basic?.kana || "");
        const name = normalizeForSearch(c.basic?.name || "");
        return kana.includes(query) || name.includes(query);
      });
    },
  }));
});
