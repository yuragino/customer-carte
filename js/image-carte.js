import { firestore } from "./firebase.js";
// --- 設定（必要なら変更） ---
const FIRESTORE_COLLECTION_REGISTRATION = 'reservations'; // 登録保存先
const FIRESTORE_COLLECTION_PRICING = 'pricing'; // 料金マスタ（doc: 'yukata' を期待）
const FIRESTORE_COLLECTION_EVENTS = 'eventDates'; // 年度ごとのイベント日（例: docId: '2025', field: 'fireworksDate'）
document.addEventListener('alpine:init', () => {
  Alpine.data('app', () => ({
    peopleWithImage: [],

    async init() {
      await this.loadData();
    },

    async loadData() {
      try {
        const snapshot = await firestore.collection('reservations').get();
        const peopleList = [];

        snapshot.forEach(doc => {
          const data = doc.data();
          // people 配列があることを前提にループ
          if (!data.people) return;

          data.people.forEach(person => {
            // imageUrlがある人だけ抽出
            // if (person.imageUrl) {
              peopleList.push({
                groupId: doc.id,
                id: doc.id + '_' + person.name,  // 識別用キー
                name: person.name || '',
                height: person.height || '',
                footSize: person.footSize || '',
                imageUrl: person.imageUrl,
                // 来店日時は親データから補完
                visitDate: data.visitDate || '',
                visitTime: data.visitTime || '',
              });
            // }
          });
        });

        this.peopleWithImage = peopleList;
      } catch (error) {
        console.error('データ取得エラー:', error);
        alert('データの取得に失敗しました。');
      }
    },

    formatDateTime(dateStr, timeStr) {
      if (!dateStr) return '';
      const d = new Date(dateStr + 'T' + (timeStr || '00:00'));
      return d.toLocaleString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    },

  }));
});

// cSpell:ignore jalan kitsuke firestore geta yukata