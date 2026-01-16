import { db } from "../common/firebase-config.js";
import { collection, addDoc, updateDoc, doc, getDoc, getDocs, query, where, serverTimestamp, deleteDoc } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { toggleRadioUtil, handleError } from "../common/utils/ui-utils.js";
import { setupAuth } from "../common/utils/auth-utils.js";
const COLLECTION_NAME = "generalReservations";
const CUSTOMERS_COLLECTION = "generalCustomers";
document.addEventListener('alpine:init', () => {
  Alpine.data('app', () => ({
    docId: null, // パラメータ
    form: {
      customerId: null,
      name: '',
      contactMethod: '',
      contactRemark: '',
      phone: '',
      date: '',
      location: '',
      startTime: '',
      endTime: '',
      feeItems: [
        { name: '出張料', fee: 0, isCore: true },
        { name: '', fee: 0 },
      ],
      notes: '',
    },
    isSaving: false,

    get docRef() {
      return doc(db, COLLECTION_NAME, this.docId);
    },

    get totalFee() {
      return this.form.feeItems.reduce((sum, item) => sum + (Number(item.fee) || 0), 0);
    },

    async init() {
      setupAuth(this);
      const params = new URLSearchParams(window.location.search);
      const id = params.get('id');      // ← 顧客ID
      this.docId = params.get('docId'); // ← 予約ID（更新時用）
      if (this.docId) {
        await this.loadReservation(this.docId);
      } else if (id) {
        // 顧客ID付きで遷移された場合、顧客情報を取得して自動入力
        await this.loadCustomerData(id);
      }
    },

    // 顧客データをロードしてフォームに反映
    async loadCustomerData(customerId) {
      try {
        const customerSnap = await getDoc(doc(db, CUSTOMERS_COLLECTION, customerId));
        if (customerSnap.exists()) {
          const customer = customerSnap.data();
          this.form.customerId = customerId;
          this.form.name = customer.name || '';
          this.form.contactMethod = customer.contactMethod || '';
          this.form.contactRemark = customer.contactRemark || '';
          this.form.phone = customer.phone || '';
          this.form.location = customer.address || '';
          this.form.notes = customer.notes || '';
        }
      } catch (error) {
        handleError('顧客情報の取得', error);
      }
    },

    // 予約を読み込み（更新モード）
    async loadReservation(docId) {
      try {
        const resSnap = await getDoc(this.docRef);
        if (resSnap.exists()) {
          this.form = { id: docId, ...resSnap.data() };
        }
      } catch (error) {
        handleError('予約データの取得', error);
      }
    },

    // 登録 or 更新
    async submitForm() {
      if (!this.form.date) {
        alert('着付け日を入力してください。');
        return;
      }
      if (!this.form.startTime) {
        alert('開始時間を入力してください。');
        return;
      }
      if (!this.form.endTime) {
        alert('終了時間を入力してください。');
        return;
      }
      this.isSaving = true;
      try {
        const { id, ...data } = this.form;
        data.updatedAt = serverTimestamp();

        if (id) {
          await updateDoc(this.docRef, data);
        } else {
          data.createdAt = serverTimestamp();
          await addDoc(collection(db, COLLECTION_NAME), data);
        }

        // 予約登録成功後にGAS APIを呼び出してカレンダーにも登録
        await fetch("https://script.google.com/macros/s/AKfycbxMmX73AHKAA8_Oi6ZtwOXrrnUDc0tuC_Ig7zETMhsZZJTgm6zQmttVtKBL6JbGn9Ly/exec", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: this.form.name,
            startDateTime: `${this.form.date}T${this.form.startTime}:00+09:00`,
            endDateTime: `${this.form.date}T${this.form.endTime}:00+09:00`,
            location: this.form.location,
            notes: this.form.notes,
            link: `https://yuragino.github.io/customer-carte/general/customer-form.html?id=${this.form.customerId}`, // ← これで完璧！！
          }),
        });

        window.location.href = './index.html';
      } catch (e) {
        handleError('予約の保存', e);
      } finally {
        this.isSaving = false;
      }
    },

    async deleteForm() {
      if (!confirm('この予約を削除しますか？')) return;
      try {
        await deleteDoc(this.docRef);
        window.location.href = './index.html';
      } catch (error) {
        handleError('データの削除', error);
      }
    },

    toggleRadio(event, modelName) {
      toggleRadioUtil(event, modelName, this.form);
    },

    addFeeItem() {
      this.form.feeItems.push({ name: '', fee: 0 });
    },

    removeFeeItem(index) {
      if (this.form.feeItems[index].isCore) return alert('出張料は削除できません。');
      if (confirm('この行を削除しますか？')) {
        this.form.feeItems.splice(index, 1);
      }
    },
  }));
});
