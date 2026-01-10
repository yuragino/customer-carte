import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { db } from '../common/firebase-config.js';
import { formatFullDateTime, formatDateOnly, formatTime, formatYen } from '../common/utils/format-utils.js';
import { setupAuth } from "../common/utils/auth-utils.js";
const COLLECTION_NAME = 'seijinshiki';
document.addEventListener('alpine:init', () => {
  Alpine.data('app', () => ({
    formatFullDateTime,
    formatDateOnly,
    formatTime,
    formatYen,
    // ===== 状態管理 =====
    docId: null,
    selectedYear: '',
    formData: {
      basicInfo: {},
      toujitsuInfo: { schedule: [], note: '' },
      meetings: [],
      maedoriInfo: {},
      estimateInfo: { kitsuke: {}, hairMake: {}, options: [], receiptDate: '', isMiyuki: false },
    },

    get docRef() {
      return doc(db, COLLECTION_NAME, this.docId);
    },
    get totalAmount() {
      const { kitsuke, hairMake, options } = this.formData.estimateInfo;
      const optionsTotal = options.reduce((sum, o) => sum + (o.price || 0), 0);
      return (kitsuke.price || 0) + (hairMake.price || 0) + optionsTotal;
    },
    get sortedMeetings() {
      return [...this.formData.meetings].sort((a, b) => new Date(a.date) - new Date(b.date));
    },

    async init() {
      setupAuth(this);
      const params = new URLSearchParams(window.location.search);
      this.selectedYear = params.get('year') || '';
      this.docId = params.get('docId');
      if (this.docId) await this.load();
    },

    async load() {
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

  }));
});
