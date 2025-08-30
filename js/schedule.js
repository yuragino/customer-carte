import { firestore } from "./firebase.js";
document.addEventListener('alpine:init', () => {
  Alpine.data('schedulePage', () => ({
    groups: [],
    boothOptions: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
    staffOptions: ['佐藤', '鈴木', '松本'],

    // ステータスの遷移を定義
    statusCycle: {
      '受付完了': '案内完了',
      '案内完了': '着付完了',
      '着付完了': '見送り完了',
      '見送り完了': '対応完了',
      '対応完了': '対応完了', // 最終ステータス
    },

    // ステータスとタイムスタンプのキーをマッピング
    statusTimestampKeys: {
      '受付完了': 'receptionCompletedAt',
      '案内完了': 'guidanceCompletedAt',
      '着付完了': 'dressingCompletedAt',
      '見送り完了': 'sendOffCompletedAt',
      '対応完了': 'serviceCompletedAt',
    },

    // --- ヘッダー関連 ---
    selectedYear: new Date().getFullYear(),
    get yearOptions() {
      const currentYear = new Date().getFullYear();
      return [currentYear, currentYear + 1, currentYear - 1, currentYear - 2, currentYear - 3];
    },

    init() {
      // 年の変更を監視して再フェッチ
      this.$watch('selectedYear', () => this.fetchSchedule());
      this.fetchSchedule();
    },

    async fetchSchedule() {
      this.groups = [];
      const collectionName = `${this.selectedYear}_fireworks`;

      try {
        // firestore 変数を使ってコレクションにアクセス
        const querySnapshot = await firestore.collection(collectionName).get();
        const fetchedGroups = [];
        querySnapshot.forEach((doc) => {
          fetchedGroups.push({
            groupId: doc.id,
            ...doc.data()
          });
        });

        // 来店予定時刻でソート
        fetchedGroups.sort((a, b) => {
          if (a.representative.visitTime < b.representative.visitTime) return -1;
          if (a.representative.visitTime > b.representative.visitTime) return 1;
          return 0;
        });

        this.groups = fetchedGroups;
      } catch (error) {
        console.error("Error fetching schedule: ", error);
        alert("データの取得に失敗しました。");
      }
    },

    async updateStatus(groupId, customerId) {
      const group = this.groups.find(g => g.groupId === groupId);
      if (!group) return;

      const customerIndex = group.customers.findIndex(c => c.id === customerId);
      if (customerIndex === -1) return;

      const currentStatus = group.customers[customerIndex].status || '受付完了';
      const nextStatus = this.statusCycle[currentStatus];

      // UIを即時反映
      group.customers[customerIndex].status = nextStatus;

      try {
        const docRef = firestore.collection(`${this.selectedYear}_fireworks`).doc(groupId);

        // ドキュメントデータを取得
        const doc = await docRef.get();
        if (!doc.exists) {
          console.error("Document not found.");
          return;
        }

        const docData = doc.data();
        const updatedCustomers = docData.customers.map(c => {
          if (c.id === customerId) {
            return {
              ...c,
              status: nextStatus,
              statusTimestamps: {
                ...(c.statusTimestamps || {}),
                [this.statusTimestampKeys[currentStatus]]: firebase.firestore.FieldValue.serverTimestamp(), // ← firebase じゃなくて firestore 経由
              },
            };
          }
          return c;
        });

        // 更新データをまとめる（customerForm と同じスタイル）
        const dataToSave = {
          customers: updatedCustomers,
          updatedAt: firestore.FieldValue.serverTimestamp(), // おまけで全体の更新日時も入れるとよい
        };

        await docRef.update(dataToSave);
        console.log("Status and timestamp updated successfully!");

      } catch (error) {
        console.error("Error updating status: ", error);
        alert("ステータスの更新に失敗しました。");
        // エラー時はUIを元に戻す
        this.fetchSchedule();
      }
    },

    async updateCustomerField(groupId, customerId, field, value) {
      try {
        const collectionName = `${this.selectedYear}_fireworks`;
        const docRef = firestore.collection(collectionName).doc(groupId);
        const doc = await docRef.get();
        if (!doc.exists) throw new Error("Document not found");

        const customers = doc.data().customers;
        const customerIndex = customers.findIndex(c => c.id === customerId);
        if (customerIndex === -1) throw new Error("Customer not found");

        customers[customerIndex][field] = value;

        await docRef.update({ customers: customers });
      } catch (error) {
        console.error(`Error updating ${field}:`, error);
        alert(`${field}の更新に失敗しました。`);
      }
    },

    formatTimestamp(timestamp) {
      if (!timestamp) return '--:--';
      const date = timestamp.toDate();
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return `${hours}:${minutes}`;
    },

    getStatusClass(status) {
      const currentStatus = status || '受付完了';
      const classMap = {
        '受付完了': 'status-received',
        '案内完了': 'status-guided',
        '着付完了': 'status-dressing-done',
        '見送り完了': 'status-sent-off',
        '対応完了': 'status-completed',
      };
      return classMap[currentStatus] || 'status-received';
    }
  }));
});

// cspell:ignore Firestore