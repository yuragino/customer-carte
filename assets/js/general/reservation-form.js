import { db } from "../common/firebase-config.js";
import { collection, addDoc, updateDoc, doc, getDoc, getDocs, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { toggleRadioUtil, handleError } from "../common/utils/ui-utils.js";
import { setupAuth } from "../common/utils/auth-utils.js";
const COLLECTION_NAME = "generalReservations";
const CUSTOMERS_COLLECTION = "generalCustomers";
document.addEventListener('alpine:init', () => {
  Alpine.data('app', () => ({
    docId: null, // パラメータ
    form: {
      id: null,
      customerId: null,
      name: '',
      lineType: '',
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
    useHomeAddress: false,

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
          this.form.phone = customer.phone || '';
          this.form.address = customer.address || '';
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
      if (!this.form.name || !this.form.date) {
        alert('お名前と着付け日を入力してください。');
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
    applyHomeAddress() {
      if (this.useHomeAddress) {
        this.form.location = this.form.address || '';
      } else {
        this.form.location = '';
      }
    },
  }));
});
