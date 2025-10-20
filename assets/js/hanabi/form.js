import { doc, getDoc, collection, addDoc, updateDoc, deleteDoc, serverTimestamp, query, where, getDocs } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { db } from '../common/firebase-config.js';
import { getYearSettings } from "../common/year-selector.js";
import { formatYen } from "../common/utils/format-utils.js";
import { toggleRadioUtil, handleError } from "../common/utils/ui-utils.js";
import { calculateCustomerPayment } from "../common/utils/calc-utils.js";
import { uploadMediaArrayToCloudinary, prepareMediaPreviewUtil, removeMediaUtil } from "../common/utils/media-utils.js";
import { logFirestoreAction } from "../common/utils/firestore-utils.js";
const COLLECTION_NAME = 'fireworks';
document.addEventListener('alpine:init', () => {
  Alpine.data('app', () => ({
    ...getYearSettings(),
    formatYen,
    activeCustomerIndex: null, // 一時的に操作中の顧客を指す共通インデックス
    docId: null,              // パラメータ
    isSubmitting: false,
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
      const params = new URLSearchParams(window.location.search);
      this.initYearSelector();
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
          handleError('データの読み込み', error);
          this.docId = null;
        }
      } catch (error) {
        handleError('データの取得', error);
      }
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

    async uploadCustomerImages() {
      return Promise.all(this.formData.customers.map(async (customer) => {
        const { newImageFiles, newImagePreviews, ...customerToSave } = customer;
        const newImageUrls = await uploadMediaArrayToCloudinary(newImageFiles, COLLECTION_NAME);
        customerToSave.imageUrls = [...customer.imageUrls, ...newImageUrls];
        return customerToSave;
      }));
    },

    async submitForm() {
      this.isSubmitting = true;
      try {
        const customersToSave = await this.uploadCustomerImages();
        const formDataToSave = { ...this.formData, customers: customersToSave, eventYear: this.selectedYear, updatedAt: serverTimestamp() };
        const collectionRef = collection(db, COLLECTION_NAME);
        if (this.docId) {
          if (!confirm(`${this.formData.representative.name}さんのデータを更新しますか？`)) return;
          await updateDoc(this.docRef, formDataToSave);
          await logFirestoreAction(COLLECTION_NAME, 'update', this.docId, formDataToSave);
          alert('更新が完了しました。');
          window.location.href = `./index.html?year=${this.selectedYear}`;
        } else {
          const newDocRef = await addDoc(collectionRef, { ...formDataToSave, createdAt: serverTimestamp() });
          await logFirestoreAction(COLLECTION_NAME, 'create', newDocRef.id, formDataToSave);
          alert('登録が完了しました。');
          window.location.href = `./index.html?year=${this.selectedYear}`;
        }
      } catch (error) {
        handleError('データの登録', error);
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
        handleError('データの削除', error);
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

    async checkRepeaterStatus() {
      const phone = this.formData.representative.phone;
      if (phone === '') return alert('リピーターチェックを行うには電話番号を入力してください。');
      try {
        const repeaterQuery = query(collection(db, COLLECTION_NAME), where('representative.phone', '==', phone));
        const snapshot = await getDocs(repeaterQuery);
        if (snapshot.empty) return this.formData.representative.repeaterYears = [0];
        const foundYears = snapshot.docs
          .map(doc => doc.data().eventYear)
          .sort((a, b) => a - b);
        this.formData.representative.repeaterYears = foundYears;
      } catch (error) {
        handleError('リピーターチェック', error);
      }
    }

  }));
});
function createInitialFormData() {
  return {
    representative: {
      reservationMethod: null, name: '', kana: '',
      visitDateTime: '', finishTime: '', returnTime: '',
      address: '', phone: '',
      transportation: '', lineType: '',
      repeaterYears: [], notes: '',
      checkpoints: { rentalPage: false, footwearBag: false, price: false, location: false, parking: false },
      paymentType: 'group', groupPaymentMethod: '',
      isCanceled: false,
    },
    femaleCount: 1, maleCount: 1,
    customers: []
  }
}
function createInitialCustomerData(gender, id) {
  return {
    id, gender, name: '',
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
