import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { db } from '../common/firebase-config.js';
import { getYearSettings } from "../common/year-selector.js";
import { formatFullDateTime, formatDateOnly, formatTime, formatYen } from '../common/utils.js';
document.addEventListener('alpine:init', () => {
  Alpine.data('App', () => ({
    ...getYearSettings(),
    formatFullDateTime,
    formatDateOnly,
    formatTime,
    formatYen,
    // ===== 状態管理 =====
    currentCustomerId: null,
    isLoading: true,
    errorMessage: '',
    customerData: {},

    // ===== 初期化処理 =====
    async init() {
      const params = new URLSearchParams(window.location.search);
      this.initYearSelector();
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

    // ===== 表示用ヘルパー =====
    get sortedMeetings() {
      if (!this.customerData.meetings || this.customerData.meetings.length === 0) {
        return [];
      }
      return [...this.customerData.meetings].sort((a, b) => new Date(a.date) - new Date(b.date));
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
      // nameがあれば優先
      if (item.name) return item.name;
      // item.optionがあればそれを表示
      if (item.option) return item.option;
      // indexによるフォールバック
      if (index === 0) return '着付';
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
