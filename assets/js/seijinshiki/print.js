import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getFirestore, doc, getDoc, collection, addDoc, updateDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

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

document.addEventListener('alpine:init', () => {
  Alpine.data('app', () => ({
    // ===== 状態管理 =====
    selectedYear: new Date().getFullYear(),
    currentCustomerId: null,
    isLoading: true,
    errorMessage: '',
    customerData: {},

    // ===== 初期化処理 =====
    async init() {
      const params = new URLSearchParams(window.location.search);
      this.selectedYear = parseInt(params.get('year')) || new Date().getFullYear();
      this.currentCustomerId = params.get('customer');

      if (this.currentCustomerId) {
        await this.loadCustomerData();
      } else {
        this.errorMessage = 'お客様が指定されていません。';
        this.isLoading = false;
      }
    },

    // ===== データ読み込み =====
    async loadCustomerData() {
      this.isLoading = true;
      this.errorMessage = '';
      try {
        const collectionName = `${this.selectedYear}_seijinshiki`;
        const docRef = doc(db, collectionName, this.currentCustomerId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          this.customerData = docSnap.data();
        } else {
          this.errorMessage = '指定されたデータが見つかりませんでした。';
        }
      } catch (error) {
        console.error("データ取得エラー: ", error);
        this.errorMessage = 'データの読み込みに失敗しました。';
      } finally {
        this.isLoading = false;
      }
    },

    // ===== ヘッダー関連 =====
    get yearOptions() {
      const currentYear = new Date().getFullYear();
      return [currentYear + 1, currentYear, currentYear - 1, currentYear - 2];
    },
    changeYear() {
      const url = new URL(window.location.href);
      url.searchParams.set('year', this.selectedYear);
      window.location.href = url.toString();
    },

    // ===== 表示用ヘルパー =====
    get sortedMeetings() {
      if (!this.customerData.meetings || this.customerData.meetings.length === 0) {
        return [];
      }
      return [...this.customerData.meetings].sort((a, b) => new Date(a.date) - new Date(b.date));
    },

    formatDisplayDate(datetimeString) {
      if (!datetimeString) return 'ー';
      const date = new Date(datetimeString);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${year}/${month}/${day} ${hours}:${minutes}`;
    },

    formatYen(amount) {
      if (typeof amount !== 'number' || isNaN(amount)) return '¥0';
      return `¥${amount.toLocaleString()}`;
    },

    getEstimateUsageText(item) {
      const forToujitsu = item.toujitsu;
      const forMaedori = item.maedori;

      if (item.option === 'none') return '対象外';
      if (forToujitsu && forMaedori) return '前撮り＆当日';
      if (forToujitsu) return '当日のみ';
      if (forMaedori) return '前撮りのみ';
      return 'なし';
    },

    getEstimateItemName(item, index) {
      // データにnameがあればそれを優先
      if (item.name) return item.name;

      // 従来のデータ構造のためのフォールバック
      if (index === 0) return '着付';
      if (index === 1) {
        switch (item.option) {
          case 'hairMake': return 'ヘア＆メイク';
          case 'hairOnly': return 'ヘアのみ';
          default: return 'ヘアメイクなし';
        }
      }
      return '(名称未設定)';
    },

    // ===== 計算ロジック (シンプル版) =====
    calcPrice(item) {
      const count = (item.toujitsu ? 1 : 0) + (item.maedori ? 1 : 0);
      if (count === 0 || item.option === 'none') return 0;

      // 全ての項目で item.price を参照する
      const basePrice = item.price || 0;
      return basePrice * count;
    },

    get totalAmount() {
      if (!this.customerData.estimateItems) return 0;
      return this.customerData.estimateItems.reduce((sum, item) => {
        return sum + this.calcPrice(item);
      }, 0);
    },
  }));
});