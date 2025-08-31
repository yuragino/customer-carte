import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getFirestore, collection, getDocs, doc, getDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBOMtAoCObyoalTk6_nVpGlsnLcGSw4Jzc",
  authDomain: "kimono-coordinate.firebaseapp.com",
  databaseURL: "https://kimono-coordinate-default-rtdb.firebaseio.com",
  projectId: "kimono-coordinate",
  storageBucket: "kimono-coordinate.firebasestorage.app",
  messagingSenderId: "399031825104",
  appId: "1:399031825104:web:639225192503ab895724d5",
  measurementId: "G-MCBZVD9D22"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

document.addEventListener('alpine:init', () => {
  Alpine.data('schedulePage', () => ({
    groups: [],
    boothOptions: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
    staffOptions: ['佐藤', '鈴木', '松本'],

    statusCycle: {
      '受付完了': '案内完了',
      '案内完了': '着付完了',
      '着付完了': '見送り完了',
      '見送り完了': '対応完了',
      '対応完了': '対応完了',
    },

    statusTimestampKeys: {
      '受付完了': 'receptionCompletedAt',
      '案内完了': 'guidanceCompletedAt',
      '着付完了': 'dressingCompletedAt',
      '見送り完了': 'sendOffCompletedAt',
      '対応完了': 'serviceCompletedAt',
    },

    selectedYear: new Date().getFullYear(),
    get yearOptions() {
      const currentYear = new Date().getFullYear();
      return [currentYear, currentYear + 1, currentYear - 1, currentYear - 2, currentYear - 3];
    },

    init() {
      this.$watch('selectedYear', () => this.fetchSchedule());
      this.fetchSchedule();
    },

    async fetchSchedule() {
      this.groups = [];
      const collectionName = `${this.selectedYear}_fireworks`;
      try {
        const colRef = collection(db, collectionName);
        const querySnapshot = await getDocs(colRef);
        const fetchedGroups = [];
        querySnapshot.forEach((doc) => {
          fetchedGroups.push({
            groupId: doc.id,
            ...doc.data()
          });
        });
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

    async updateCustomerField(groupId, customerId, field, value) {
      try {
        const collectionName = `${this.selectedYear}_fireworks`;
        const docRef = doc(db, collectionName, groupId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) throw new Error("Document not found");

        const customers = docSnap.data().customers;
        const customerIndex = customers.findIndex(customerData => customerData.id === customerId);
        if (customerIndex === -1) throw new Error("Customer not found");

        // customers配列全体を更新する
        customers[customerIndex][field] = value;
        await updateDoc(docRef, { customers: customers });

      } catch (error) {
        console.error(`Error updating ${field}:`, error);
        alert(`${field}の更新に失敗しました。`);
      }
    },
    
    async updateStatus(groupId, customerId) {
      try {
        const collectionName = `${this.selectedYear}_fireworks`;
        const docRef = doc(db, collectionName, groupId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) throw new Error("Document not found");

        const data = docSnap.data();
        const customers = data.customers;
        const customerIndex = customers.findIndex(c => c.id === customerId);
        const customer = customers[customerIndex];

        const currentStatus = customer.status || '受付完了';
        const nextStatus = this.statusCycle[currentStatus];

        if (nextStatus === currentStatus) {
          // 最終ステータスに達した場合は何もしない
          return;
        }

        // ステータスとタイムスタンプを更新
        customer.status = nextStatus;
        if (!customer.statusTimestamps) {
          customer.statusTimestamps = {};
        }
        const timestampKey = this.statusTimestampKeys[nextStatus];
        customer.statusTimestamps[timestampKey] = new Date();

        // Firestoreにデータを更新
        await updateDoc(docRef, { customers: customers });

      } catch (error) {
        console.error("Error updating status:", error);
        alert("ステータス更新に失敗しました。");
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
    },

    formatTimestamp(timestamp) {
      if (!timestamp) return '';
      const date = timestamp instanceof Date ? timestamp : timestamp.toDate();
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${hours}:${minutes}`;
    },
  }));
});
// cspell:ignore Firestore