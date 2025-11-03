import { doc, getDoc, collection, addDoc, updateDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { db } from '../common/firebase-config.js';
import { formatYen } from "../common/utils/format-utils.js";
import { toggleRadioUtil } from "../common/utils/ui-utils.js";
import { calculateCustomerPayment } from "../common/utils/calc-utils.js";
import { uploadMediaArrayToCloudinary, prepareMediaPreviewUtil, removeMediaUtil } from "../common/utils/media-utils.js";
import { logFirestoreAction } from "../common/utils/firestore-utils.js";
import { setupAuth } from "../common/utils/auth-utils.js";
const COLLECTION_NAME = 'machiaruki';

document.addEventListener('alpine:init', () => {
  Alpine.data('app', () => ({
    formatYen,
    activeCustomerIndex: null, // 一時的に操作中の顧客を指す共通インデックス
    docId: null,              // パラメータ
    isSubmitting: false,
    selectedImageUrl: null,
    formData: createInitialFormData(),
    rentalModal: {
      isOpen: false,
      input: { name: '', price: null },
    },
    discountModal: {
      isOpen: false,
      originalPrice: 0,
      input: { amount: 0, memo: '' },
      adjustedPrice: 0,
    },

    get docRef() {
      return doc(db, COLLECTION_NAME, this.docId);
    },
    // 各顧客の前払い金額を合計
    get totalPrepayment() {
      if (this.formData.representative.reservationMethod === null) return 0;
      return this.formData.customers.reduce(
        (total, customer) => total + this.calculateCustomerPrepayment(customer), 0
      );
    },
    // 値引きを考慮しない元の（合計）現地支払い金額
    get totalOnSitePayment() {
      return this.formData.customers.reduce(
        (total, customer) => total + this.calculateCustomerOnSitePayment(customer), 0
      );
    },
    // 値引き適用後の合計現地支払い金額
    get totalOnSitePaymentAdjusted() {
      return this.formData.customers.reduce(
        (total, customer) => total + this.calculateCustomerOnSitePaymentAdjusted(customer), 0
      );
    },

    async init() {
      setupAuth(this);
      const params = new URLSearchParams(window.location.search);
      this.docId = params.get('docId');
      if (this.docId) await this.load();
      else this.updateCustomerList();
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
        console.error('データ取得エラー:', error);
        alert('データの読み込みに失敗しました。');
      }
    },

    openImageModal(url) {
      this.selectedImageUrl = url;
    },

    toggleRadio(event, modelName) {
      toggleRadioUtil(event, modelName, this.formData.representative);
    },

    // 追加レンタル
    openRentalModal(customerIndex) {
      this.activeCustomerIndex = customerIndex
      this.rentalModal.input = { name: '', price: null }
      this.rentalModal.isOpen = true
    },
    addRentalItem() {
      const { name, price } = this.rentalModal.input
      if (name === '') return alert('項目名を入力してください');
      this.formData.customers[this.activeCustomerIndex].additionalRentals.push({ name, price })
      this.rentalModal.isOpen = false
    },
    removeRentalItem(customerIndex, itemIndex) {
      if (!confirm('この項目を削除しますか？')) return;
      this.formData.customers[customerIndex].additionalRentals.splice(itemIndex, 1);
    },

    // 値引き調整
    openDiscountModal(customerIndex) {
      const customer = this.formData.customers[customerIndex];
      this.activeCustomerIndex = customerIndex;
      this.discountModal.originalPrice = this.calculateCustomerOnSitePayment(customer);
      this.discountModal.input.amount = customer.discountAmount;
      this.discountModal.input.memo = customer.discountMemo;
      this.discountModal.adjustedPrice = this.discountModal.originalPrice - this.discountModal.input.amount;
      this.discountModal.isOpen = true;
    },
    applyDiscount() {
      const customer = this.formData.customers[this.activeCustomerIndex];
      customer.discountAmount = this.discountModal.input.amount;
      customer.discountMemo = this.discountModal.input.memo;
      this.discountModal.isOpen = false;
    },

    updateCustomerList() {
      const { femaleCount, maleCount, customers } = this.formData;
      const totalCount = femaleCount + maleCount;
      this.formData.customers = Array.from({ length: totalCount }, (_, i) => {
        const gender = i < femaleCount ? 'female' : 'male';
        const existingCustomer = customers[i];
        return existingCustomer ? { ...existingCustomer, gender } : createInitialCustomerData(gender, `${Date.now()}-${i}`);
      });
    },

    // ==== 画像処理 ====
    prepareMediaPreview(event, customerIndex) {
      prepareMediaPreviewUtil(event, 'image', this.formData.customers[customerIndex]);
    },

    removeMedia(customerIndex, mediaType, index) {
      removeMediaUtil(mediaType, index, this.formData.customers[customerIndex]);
    },

    async processCustomerData() {
      return Promise.all(this.formData.customers.map(async (customer) => {
        const { newImageFiles, newImagePreviews, ...customerForSave } = customer;
        const newImageUrls = await uploadMediaArrayToCloudinary(newImageFiles, COLLECTION_NAME);
        customerForSave.imageUrls = [...customer.imageUrls, ...newImageUrls];
        return customerForSave;
      }));
    },

    async submitForm() {
      if (this.docId && !confirm(`${this.formData.representative.name}さんのデータを更新しますか？`)) return;
      this.isSubmitting = true;
      try {
        const customers = await this.processCustomerData();
        const formDataToSave = { ...this.formData, customers, updatedAt: serverTimestamp() };
        const col = collection(db, COLLECTION_NAME);
        if (this.docId) {
          await updateDoc(this.docRef, formDataToSave);
          await logFirestoreAction(COLLECTION_NAME, 'update', this.docId, formDataToSave);
          alert('更新が完了しました。');
          location.href = './index.html';
        } else {
          const newDocRef = await addDoc(col, { ...formDataToSave, createdAt: serverTimestamp() });
          await logFirestoreAction(COLLECTION_NAME, 'create', newDocRef.id, formDataToSave);
          alert('登録が完了しました。');
          location.href = './index.html';
        }
      } catch (error) {
        console.error('登録エラー', error);
        alert(`登録中にエラーが発生しました。\n${error.message}`);
      } finally {
        this.isSubmitting = false;
      }
    },

    async deleteForm() {
      if (!confirm('このカルテを削除しますか？')) return;
      try {
        await deleteDoc(this.docRef);
        window.location.href = './index.html';
      } catch (error) {
        console.error("削除エラー: ", error);
        alert(`削除中にエラーが発生しました。\n${error.message}`);
      }
    },

    // ==== 料金関係 ====
    // 前払い
    calculateCustomerPrepayment(customer) {
      return calculateCustomerPayment(this, customer, 'prepayment');
    },
    // 現地払い（値引き前）
    calculateCustomerOnSitePayment(customer) {
      return calculateCustomerPayment(this, customer, 'onSite');
    },
    // 現地払い（値引き後）
    calculateCustomerOnSitePaymentAdjusted(customer) {
      return calculateCustomerPayment(this, customer, 'onSiteAdjusted', true);
    },

  }));
});

function createInitialFormData() {
  return {
    representative: {
      reservationMethod: null, name: '', kana: '',
      visitDateTime: '', finishTime: '', returnTime: '',
      address: '', phone: '',
      transportation: '', lineType: '',
      notes: '',
      checkpoints: { rentalPage: false, footwearBag: false, price: false, location: false, parking: false },
      paymentType: 'group', groupPaymentMethod: '',
      isCanceled: false,
    },
    femaleCount: 1, maleCount: 0,
    customers: []
  }
}
function createInitialCustomerData(gender, id) {
  return {
    id, gender, name: '', kana: '',
    bodyShape: null, weight: null, height: null, footSize: null,
    dressingType: 'レンタル&着付',
    options: { footwear: false, obiBag: false },
    additionalRentals: [],
    imageUrls: [],          // ← DBに保存済みのURL群
    newImageFiles: [],      // ← Fileオブジェクト群
    newImagePreviews: [],   // ← プレビュー表示用 blob:URL 群
    paymentMethod: '',
    discountAmount: 0,
    discountMemo: '',
    onSitePaymentAdjusted: 0,
  };
}

