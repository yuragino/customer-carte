import { doc, getDoc, collection, addDoc, updateDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { db } from '../common/firebase-config.js';
import { CASUAL_PRICES } from '../common/constants.js';
import { formatYen } from "../common/utils.js";
import { uploadMediaToCloudinary } from "../common/form-utils.js";
const COLLECTION_NAME = 'machiaruki';

document.addEventListener('alpine:init', () => {
  Alpine.data('App', () => ({
    formatYen,
    activeCustomerIndex: null,    // 一時的に操作中の顧客を指す共通インデックス
    docId: null, // パラメータ
    isRepresentativeInfoOpen: true,
    isSubmitting: false,

    formData: {
      representative: {
        reservationMethod: null, name: '', kana: '',
        visitDateTime: '', finishTime: '', returnTime: '',
        address: '', phone: '',
        transportation: '車', lineType: '椿LINE',
        notes: '',
        checkpoints: { rentalPage: false, footwearBag: false, price: false, location: false, parking: false },
        paymentType: 'group', groupPaymentMethod: '',
        isCanceled: false,
      },
      femaleCount: 1, maleCount: 1,
      customers: []
    },
    rentalModal: {
      isOpen: false,
      input: {
        name: '',
        price: null,
      },
    },
    discountModal: {
      isOpen: false,
      originalPrice: 0,
      input: {
        amount: 0,
        memo: '',
      },
      adjustedPrice: 0,
    },

    get docRef() {
      return doc(db, COLLECTION_NAME, this.docId);
    },
    // 各顧客の前払い金額を合計
    get totalPrepayment() {
      const { representative, customers } = this.formData;
      if (representative.reservationMethod === null) return 0;
      return customers.reduce((total, customer) => {
        return total + this.calculateCustomerPrepayment(customer);
      }, 0);
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
      this.docId = params.get('docId');
      if (this.docId) await this.loadData();
      else this.updateCustomerList();
      this.$watch('formData.femaleCount', () => this.updateCustomerList());
      this.$watch('formData.maleCount', () => this.updateCustomerList());
    },

    async loadData() {
      try {
        const docSnap = await getDoc(this.docRef);
        if (docSnap.exists()) {
          this.formData = docSnap.data();
          this.isRepresentativeInfoOpen = true;
        } else {
          alert('指定されたデータが見つかりませんでした。');
          this.docId = null;
        }
      } catch (error) {
        console.error('データ取得エラー:', error);
        alert('データの読み込みに失敗しました。');
      }
    },

    toggleRadio(event, modelName) {
      const clickedValue = event.target.value;
      if (this.formData.representative[modelName] === clickedValue) {
        setTimeout(() => {
          this.formData.representative[modelName] = null;
        }, 0);
      } else {
        this.formData.representative[modelName] = clickedValue;
      }
    },

    // ==== 顧客データ関連 ====
    createInitialCustomerData(gender, id) {
      return {
        id, gender, name: '',
        bodyShape: null, weight: null, height: null, footSize: null,
        dressingType: 'レンタル&着付',
        options: { footwear: false, obiBag: false },
        additionalRentals: [],
        imagePreviews: [], imageFiles: [],
        paymentMethod: '',
        discountAmount: 0,
        discountMemo: '',
        onSitePaymentAdjusted: 0,
      };
    },

    updateCustomerList() {
      const { femaleCount, maleCount, customers } = this.formData;
      const totalCount = femaleCount + maleCount;
      this.formData.customers = Array.from({ length: totalCount }, (_, i) => {
        const gender = i < femaleCount ? 'female' : 'male';
        const existingCustomer = customers[i];
        return existingCustomer ? { ...existingCustomer, gender } : this.createInitialCustomerData(gender, `${Date.now()}-${i}`);
      });
    },

    // ==== 画像処理 ====
    handleImageUpload(event, customerIndex) {
      const files = [...(event.target.files || [])];
      const customer = this.formData.customers[customerIndex];
      customer.imagePreviews.forEach(URL.revokeObjectURL);
      customer.imagePreviews = files.map(f => URL.createObjectURL(f));
      customer.imageFiles = files;
    },

    async processCustomerData() {
      return Promise.all(this.formData.customers.map(async (c) => {
        const { imageFiles, imagePreviews, ...data } = c;
        data.imageUrls = await uploadMediaToCloudinary(imageFiles, COLLECTION_NAME);
        return data;
      }));
    },

    async submitForm() {
      this.isSubmitting = true;
      try {
        const customers = await this.processCustomerData();
        const data = { ...this.formData, customers, updatedAt: serverTimestamp() };
        const col = collection(db, COLLECTION_NAME);
        if (this.docId) {
          await updateDoc(this.docRef, data);
          alert('更新が完了しました。');
        } else {
          await addDoc(col, { ...data, createdAt: serverTimestamp() });
          alert('登録が完了しました。');
          location.href = './index.html';
        }
      } catch (err) {
        console.error('登録エラー', err);
        alert(`登録中にエラーが発生しました。\n${err.message}`);
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

    // ==== 料金関係 ====
    calculateCustomerPrepayment(customer) {
      if (this.formData.representative.reservationMethod === null) return 0;
      if (customer.dressingType === 'レンタル&着付') return CASUAL_PRICES.RENTAL_DRESSING;
      if (customer.dressingType === '着付のみ') return CASUAL_PRICES.DRESSING_ONLY;
      return 0;
    },
    calculateCustomerOnSitePayment(customer) {
      let total = 0;
      if (this.formData.representative.reservationMethod === null) {
        if (customer.dressingType === 'レンタル&着付') total += CASUAL_PRICES.RENTAL_DRESSING;
        else if (customer.dressingType === '着付のみ') total += CASUAL_PRICES.DRESSING_ONLY;
      }
      // オプション料金
      if (customer.options.footwear) total += CASUAL_PRICES.FOOTWEAR;
      if (customer.gender === 'female' && customer.options.obiBag) total += CASUAL_PRICES.BAG;
      // 追加レンタル料金
      total += customer.additionalRentals.reduce((sum, item) => sum + (item.price || 0), 0);
      return total;
    },
    calculateCustomerOnSitePaymentAdjusted(customer) {
      const discount = customer.discountAmount || 0;
      const original = this.calculateCustomerOnSitePayment(customer);
      return discount > 0 ? original - discount : original;
    },

  }));
});
