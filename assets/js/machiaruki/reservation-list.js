import { collection, getDocs, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { db } from '../common/firebase-config.js';
const COLLECTION_NAME = 'machiaruki';

document.addEventListener('alpine:init', () => {
  Alpine.data('app', () => ({
    groups: [],
    searchQuery: '',

    init() {
      this.fetchSchedule();
    },

    async fetchSchedule() {
      this.groups = [];
      try {
        const colRef = collection(db, COLLECTION_NAME);
        const querySnapshot = await getDocs(colRef);
        const fetchedGroups = [];
        querySnapshot.forEach((doc) => {
          fetchedGroups.push({
            groupId: doc.id,
            ...doc.data()
          });
        });
        fetchedGroups.sort((a, b) => {
          // キャンセル済みかどうかでソート
          if (a.representative.isCanceled && !b.representative.isCanceled) {
            return 1; // aがキャンセル済みで、bが未キャンセルなら、aを後ろに
          }
          if (!a.representative.isCanceled && b.representative.isCanceled) {
            return -1; // aが未キャンセルで、bがキャンセル済みなら、aを前に
          }
          // キャンセル状態が同じ場合は、来店予定時間でソート
          if (a.representative.visitDateTime < b.representative.visitDateTime) return -1;
          if (a.representative.visitDateTime > b.representative.visitDateTime) return 1;
          return 0;
        });
        this.groups = fetchedGroups;
      } catch (error) {
        console.error("Error fetching schedule: ", error);
        alert("データの取得に失敗しました。");
      }
    },

    // updateCustomerField 関数のシグネチャを変更
    async updateCustomerField(groupId, customerId, field, value, checked) {
      try {
        const docRef = doc(db, COLLECTION_NAME, groupId);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) throw new Error("Document not found");

        const customers = docSnap.data().customers;
        const customerIndex = customers.findIndex(customerData => customerData.id === customerId);
        if (customerIndex === -1) throw new Error("Customer not found");

        if (field === 'staff') {
          let currentStaff = customers[customerIndex].staff || [];
          // checked引数を使って、追加するか削除するかを判断
          if (checked) {
            // チェックが入った場合、配列に追加（重複は避ける）
            if (!currentStaff.includes(value)) {
              currentStaff.push(value);
            }
          } else {
            // チェックが外れた場合、配列から削除
            const valueIndex = currentStaff.indexOf(value);
            if (valueIndex > -1) {
              currentStaff.splice(valueIndex, 1);
            }
          }
          customers[customerIndex].staff = currentStaff;
        } else {
          customers[customerIndex][field] = value;
        }

        await updateDoc(docRef, { customers: customers });
        console.log("Updated successfully!");
      } catch (error) {
        console.error(`Error updating ${field}:`, error);
        alert(`${field}の更新に失敗しました。`);
      }
    },

    formatDate(value) {
      if (!value) return '';
      try {
        const date = new Date(value);
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        const hh = String(date.getHours()).padStart(2, '0');
        const mi = String(date.getMinutes()).padStart(2, '0');
        return `${yyyy}年${mm}月${dd}日 ${hh}:${mi}`;
      } catch (e) {
        console.warn('Invalid date:', value);
        return value;
      }
    },

    // 随時絞り込み（ひらがな/漢字両対応・スペース無視）
    get filteredGroups() {
      const keyword = this.searchQuery.trim();
      if (!keyword) return this.groups;
      const normalizedKeyword = keyword.replace(/\s+/g, "");
      return this.groups.filter(group =>
        (group.customers || []).some(customer => {
          // 入力側にも登録側にも空白が入っても大丈夫なようにする
          const normalizedName = (customer.name || "").replace(/\s+/g, "");
          return normalizedName.includes(normalizedKeyword);
        })
      );
    }

  }));
});
