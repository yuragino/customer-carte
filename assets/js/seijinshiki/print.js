import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { db } from '../common/firebase-config.js';
import { getYearSettings } from "../common/year-selector.js";
import { SEIJINSHIKI_PRICES, OUTFIT_KEY_MAP } from '../common/constants.js';
import { formatFullDateTime, formatDateOnly, formatTime, formatYen } from '../common/utils.js';
document.addEventListener('alpine:init', () => {
  Alpine.data('App', () => ({
    ...getYearSettings(),
    formatFullDateTime,
    formatDateOnly,
    formatTime,
    formatYen,
    // ===== 状態管理 =====
    docId: null,
    isLoading: true,
    formData: {},

    get collectionName() {
      return `${this.selectedYear}_seijinshiki`;
    },
    get docRef() {
      return doc(db, this.collectionName, this.docId);
    },
    get totalAmount() {
      const { kitsuke, hairMake, options } = this.formData.estimateInfo;
      const baseTotal = this.calcPrice(kitsuke) + this.calcPrice(hairMake);
      const optionsTotal = options.reduce((sum, option) => sum + option.price, 0);
      return baseTotal + optionsTotal;
    },
    get sortedMeetings() {
      return [...this.formData.meetings].sort((a, b) => new Date(a.date) - new Date(b.date));
    },

    async init() {
      const params = new URLSearchParams(window.location.search);
      this.initYearSelector();
      this.docId = params.get('docId');
      if (this.docId) await this.loadData();
    },

    async loadData() {
      this.isLoading = true;
      try {
        const docSnap = await getDoc(this.docRef);
        if (docSnap.exists()) {
          this.formData = docSnap.data();
        } else {
          alert('指定されたデータが見つかりませんでした。');
          this.docId = null;
        }
      } catch (error) {
        console.error("データ取得エラー: ", error);
        alert('データの読み込みに失敗しました。');
      } finally {
        this.isLoading = false;
      }
    },

    getTimingLabel(item) {
      const { hasToujitsu, hasMaedori } = item;
      const both = hasToujitsu && hasMaedori;
      if (item.type === 'ヘアメイクなし') return '対象外';
      if (both) return '前撮り＆当日';
      if (hasToujitsu) return '当日のみ';
      if (hasMaedori) return '前撮りのみ';
      return 'なし';
    },

    calcPrice(item) {
      const outfitKey = OUTFIT_KEY_MAP[this.formData.basicInfo.outfit];
      const priceTable = SEIJINSHIKI_PRICES[outfitKey];
      const { hasToujitsu, hasMaedori } = item;
      const both = hasToujitsu && hasMaedori;
      if (item.name === '着付') {
        if (both) return priceTable.KITSUKE.BOTH;
        if (hasToujitsu) return priceTable.KITSUKE.TOUJITSU;
        if (hasMaedori) return priceTable.KITSUKE.MAEDORI;
      }
      if (item.name === 'ヘアメイク') {
        if (outfitKey !== 'FURISODE') return 0;
        let unitPrice = 0;
        if (item.type === 'ヘア＆メイク') unitPrice = priceTable.HAIR_MAKE;
        else if (item.type === 'ヘアのみ') unitPrice = priceTable.HAIR_ONLY;
        return (hasToujitsu + hasMaedori) * unitPrice;
      }
      return 0;
    },

  }));
});
