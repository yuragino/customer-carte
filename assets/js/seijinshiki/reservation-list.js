import { collection, getDocs, doc, updateDoc, serverTimestamp, getDoc } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { db } from '../common/firebase-config.js';

document.addEventListener('alpine:init', () => {
  Alpine.data('app', () => ({
    customers: [],
    isLoading: true,
    boothOptionsFemale: ['A1', 'A2', 'B1', 'B2'],
    boothOptionsMale: ['C1', 'C2'],
    staffOptions: ['佐藤', '鈴木', '松本'],

    statusCycle: {
      '受付完了': '案内完了',
      '案内完了': '着付完了',
      '着付完了': '見送り完了',
      '見送り完了': '済',
    },

    statusTimestampKeys: {
      '受付完了': 'receptionCompletedAt',
      '案内完了': 'guidanceCompletedAt',
      '着付完了': 'dressingCompletedAt',
      '見送り完了': 'sendOffCompletedAt',
    },

    selectedYear: new Date().getFullYear(),
    get yearOptions() {
      const currentYear = new Date().getFullYear();
      return [currentYear + 1, currentYear, currentYear - 1, currentYear - 2];
    },

    init() {
      const params = new URLSearchParams(window.location.search);
      this.selectedYear = parseInt(params.get('year')) || new Date().getFullYear();
      this.fetchSchedule();
    },

    async fetchSchedule() {
      this.isLoading = true;
      const url = new URL(window.location.href);
      url.searchParams.set('year', this.selectedYear);
      window.history.pushState({}, '', url);

      this.customers = [];
      const collectionName = `${this.selectedYear}_seijinshiki`;
      try {
        const querySnapshot = await getDocs(collection(db, collectionName));
        const fetchedCustomers = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // お客様リストのソート
        fetchedCustomers.sort((a, b) => {
          if (a.isCanceled !== b.isCanceled) {
            return a.isCanceled ? 1 : -1;
          }
          const timeA = a.toujitsu?.schedule[0]?.start || '99:99';
          const timeB = b.toujitsu?.schedule[0]?.start || '99:99';
          return timeA.localeCompare(timeB);
        });

        this.customers = fetchedCustomers;
      } catch (error) {
        console.error("スケジュールデータの取得に失敗しました: ", error);
        alert("データの取得に失敗しました。");
      } finally {
        this.isLoading = false;
      }
    },

    async updateCustomerField(customerId, field, value,) {
      const collectionName = `${this.selectedYear}_seijinshiki`;
      const docRef = doc(db, collectionName, customerId);
      try {
        await updateDoc(docRef, { [field]: value });
        console.log(`顧客ID:${customerId} の ${field} を更新しました。`);
      } catch (error) {
        console.error(`${field} の更新に失敗しました:`, error);
        alert(`${field} の更新に失敗しました。`);
        // エラー発生時はデータを再取得して画面を元に戻す
        this.fetchSchedule();
      }
    },
    async updateCustomerStaff(customerId, staffName, checked) {
      const collectionName = `${this.selectedYear}_seijinshiki`;
      const docRef = doc(db, collectionName, customerId);
      try {
        // 一度現在のデータを取得
        const snap = await getDoc(docRef);
        if (!snap.exists()) throw new Error("Document not found");
        const customer = snap.data();

        let staffArray = customer.staff || [];

        if (checked) {
          // チェック → 配列に追加（重複なし）
          if (!staffArray.includes(staffName)) {
            staffArray.push(staffName);
          }
        } else {
          // チェック外す → 配列から削除
          staffArray = staffArray.filter(s => s !== staffName);
        }

        await updateDoc(docRef, { staff: staffArray });

        // 画面上の customer も即座に更新して反映
        const target = this.customers.find(c => c.id === customerId);
        if (target) target.staff = staffArray;

        console.log(`顧客ID:${customerId} の staff 更新成功`, staffArray);
      } catch (error) {
        console.error("スタッフ更新失敗:", error);
        alert("スタッフ更新に失敗しました。");
        this.fetchSchedule();
      }
    },

    async updateStatus(customer) {
      const currentStatus = customer.status || '受付完了';
      const nextStatus = this.statusCycle[currentStatus];
      if (!nextStatus) return; // 最終ステータスなら何もしない

      const collectionName = `${this.selectedYear}_seijinshiki`;
      const docRef = doc(db, collectionName, customer.id);

      // 更新するデータを準備
      const updatePayload = {
        status: nextStatus
      };

      // タイムスタンプを記録するキーを取得し、更新データに追加
      const timestampKey = this.statusTimestampKeys[currentStatus];
      if (timestampKey) {
        // Firestoreのネストされたオブジェクトのフィールドを更新する記法
        updatePayload[`statusTimestamps.${timestampKey}`] = serverTimestamp();
      }

      try {
        await updateDoc(docRef, updatePayload);
        // 画面上の表示を即時反映
        customer.status = nextStatus;
        // タイムスタンプも仮の値を設定しておく（正確な値はリロード時に反映）
        if (timestampKey) {
          if (!customer.statusTimestamps) customer.statusTimestamps = {};
          customer.statusTimestamps[timestampKey] = new Date();
        }
        console.log(`ステータスを "${nextStatus}" に更新しました。`);
      } catch (error) {
        console.error("ステータスの更新に失敗しました:", error);
        alert("ステータス更新に失敗しました。");
        this.fetchSchedule();
      }
    },

    getStatusClass(status) {
      const classMap = {
        '受付完了': 'status-received',
        '案内完了': 'status-guided',
        '着付完了': 'status-dressing-done',
        '見送り完了': 'status-sent-off',
        '済': 'status-completed',
      };
      return classMap[status || '受付完了'];
    },

    formatTimestamp(timestamp) {
      if (!timestamp) return '--:--';
      // FirestoreのTimestampオブジェクトとJSのDateオブジェクトの両方に対応
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      if (isNaN(date)) return '--:--';
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${hours}:${minutes}`;
    },
  }));
});
