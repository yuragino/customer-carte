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
      // groups配列から、指定されたgroupIdに一致するグループを見つける
      const foundGroup = this.groups.find(groupItem => groupItem.groupId === groupId);
      if (!foundGroup) return;
      // 見つかったグループのcustomers配列から、指定されたcustomerIdに一致する顧客のインデックスを見つける
      const foundCustomerIndex = foundGroup.customers.findIndex(customerItem => customerItem.id === customerId);
      if (foundCustomerIndex === -1) return;

      // 変数名を修正：foundGroupとfoundCustomerIndexを使用
      const currentStatus = foundGroup.customers[foundCustomerIndex].status || '受付完了';
      const nextStatus = this.statusCycle[currentStatus];

      // UIを即時反映（変数名を修正）
      foundGroup.customers[foundCustomerIndex].status = nextStatus;

      try {
        const docRef = firestore.collection(`${this.selectedYear}_fireworks`).doc(groupId);
        // ドキュメントデータを取得
        const doc = await docRef.get();
        if (!doc.exists) {
          console.error("Document not found.");
          return;
        }
        const docData = doc.data();
        // 更新するフィールドへのパスを直接指定する
        const updateData = {};
        updateData[`customers.${foundCustomerIndex}.status`] = nextStatus;
        updateData[`customers.${foundCustomerIndex}.statusTimestamps.${this.statusTimestampKeys[currentStatus]}`] = firebase.firestore.FieldValue.serverTimestamp();
        updateData.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
        // Firestoreに更新を送信
        await docRef.update(updateData);
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
        const customerIndex = customers.findIndex(customerData => customerData.id === customerId);
        if (customerIndex === -1) throw new Error("Customer not found");

        customers[customerIndex][field] = value;

        await docRef.update({ customers: customers });
      } catch (error) {
        console.error(`Error updating ${field}:`, error);
        alert(`${field}の更新に失敗しました。`);
      }
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