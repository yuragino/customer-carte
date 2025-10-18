// form-base.js
import { doc, getDoc, collection, addDoc, updateDoc, deleteDoc, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { db } from './firebase-config.js';
import { CASUAL_PRICES } from './constants.js';
import { formatYen } from './utils/format-utils.js';
import { toggleRadioUtil } from './utils/ui-utils.js';
import { uploadMediaArrayToCloudinary, prepareMediaPreviewUtil, removeMediaUtil } from './utils/media-utils.js';

// -------------------------------------
// 共通フォームを生成する関数
// -------------------------------------
export function createFormBase({ collectionName, extraMethods = {} }) {
  return {
    formatYen,
    db,
    CASUAL_PRICES,
    collectionName,
    ...extraMethods,      // ページ側で追加したい独自メソッドを差し込めるようにする

    activeCustomerIndex: null,
    docId: null,
    isSubmitting: false,
    formData: createInitialFormData(),
    rentalModal: { isOpen: false, input: { name: '', price: null } },
    discountModal: { isOpen: false, originalPrice: 0, input: { amount: 0, memo: '' }, adjustedPrice: 0 },

    // -------------------------------------
    // 算出プロパティ (getter)
    // -------------------------------------
    get totalPrepayment() {
      if (!this.formData || !this.formData.customers) return 0;
      return this.formData.customers.reduce((sum, customer) => {
        return sum + this.calculateCustomerPrepayment(customer);
      }, 0);
    },

    get totalOnSitePayment() {
      if (!this.formData || !this.formData.customers) return 0;
      return this.formData.customers.reduce((sum, customer) => {
        return sum + this.calculateCustomerOnSitePayment(customer);
      }, 0);
    },

    get totalOnSitePaymentAdjusted() {
      if (!this.formData || !this.formData.customers) return 0;
      return this.formData.customers.reduce((sum, customer) => {
        return sum + this.calculateCustomerOnSitePaymentAdjusted(customer);
      }, 0);
    },

    // -------------------------------------
    // Firestore関連
    // -------------------------------------
    get docRef() {
      return this.docId ? doc(db, COLLECTION_NAME, this.docId) : null;
    },

    async init() {
      const params = new URLSearchParams(window.location.search);
      this.docId = params.get('docId');
      if (this.docId) {
        // 編集モード: docId がある場合はデータをロードする
        await this.load();
      } else {
        // 新規登録モード: docId がない場合は初期リストを作成する
        this.updateCustomerList();
      }
    },

    async load() {
      try {
        const docSnap = await getDoc(this.docRef);
        if (docSnap.exists()) {
          this.formData = docSnap.data();
        } else {
          alert('指定されたデータが見つかりませんでした。');
        }
      } catch (error) {
        console.error('データ取得エラー:', error);
        alert('データの読み込みに失敗しました。');
      }
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

    // -------------------------------------
    // UI操作（モーダルなど）
    // -------------------------------------
    toggleRadio(event, modelName) {
      toggleRadioUtil(event, modelName, this.formData.representative);
    },

    openRentalModal(customerIndex) {
      this.activeCustomerIndex = customerIndex;
      this.rentalModal.input = { name: '', price: null };
      this.rentalModal.isOpen = true;
    },
    addRentalItem() {
      const { name, price } = this.rentalModal.input;
      if (name === '') return alert('項目名を入力してください');
      this.formData.customers[this.activeCustomerIndex].additionalRentals.push({ name, price });
      this.rentalModal.isOpen = false;
    },
    removeRentalItem(customerIndex, itemIndex) {
      if (!confirm('この項目を削除しますか？')) return;
      this.formData.customers[customerIndex].additionalRentals.splice(itemIndex, 1);
    },

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

    // -------------------------------------
    // 画像処理
    // -------------------------------------
    prepareMediaPreview(event, customerIndex) {
      prepareMediaPreviewUtil(event, 'image', this.formData.customers[customerIndex]);
    },
    removeMedia(customerIndex, mediaType, index) {
      removeMediaUtil(mediaType, index, this.formData.customers[customerIndex]);
    },
    async processCustomerData() {
      return Promise.all(
        this.formData.customers.map(async (customer) => {
          const { newImageFiles, newImagePreviews, ...customerForSave } = customer;
          const newImageUrls = await uploadMediaArrayToCloudinary(newImageFiles, COLLECTION_NAME);
          customerForSave.imageUrls = [...customer.imageUrls, ...newImageUrls];
          return customerForSave;
        })
      );
    },

    // -------------------------------------
    // 顧客リスト／料金計算
    // -------------------------------------
    updateCustomerList() {
      const { femaleCount, maleCount, customers } = this.formData;
      const totalCount = femaleCount + maleCount;
      this.formData.customers = Array.from({ length: totalCount }, (_, i) => {
        const gender = i < femaleCount ? 'female' : 'male';
        const existing = customers[i];
        return existing ? { ...existing, gender } : createInitialCustomerData(gender, `${Date.now()}-${i}`);
      });
    },

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
      if (customer.options.footwear) total += CASUAL_PRICES.FOOTWEAR;
      if (customer.gender === 'female' && customer.options.obiBag) total += CASUAL_PRICES.BAG;
      total += customer.additionalRentals.reduce((sum, item) => sum + (item.price || 0), 0);
      return total;
    },

    calculateCustomerOnSitePaymentAdjusted(customer) {
      const discount = customer.discountAmount || 0;
      const original = this.calculateCustomerOnSitePayment(customer);
      return discount > 0 ? original - discount : original;
    },
  };
}

// -------------------------------------
// 共通初期化関数
// -------------------------------------
export function createInitialFormData() {
  return {
    representative: {
      reservationMethod: null, name: '', kana: '',
      visitDateTime: '', finishTime: '', returnTime: '',
      address: '', phone: '', transportation: '車', lineType: '椿LINE',
      notes: '',
      checkpoints: { rentalPage: false, footwearBag: false, price: false, location: false, parking: false },
      paymentType: 'group', groupPaymentMethod: '', isCanceled: false,
    },
    femaleCount: 1, maleCount: 1,
    customers: []
  };
}

export function createInitialCustomerData(gender, id) {
  return {
    id, gender, name: '',
    bodyShape: null, weight: null, height: null, footSize: null,
    dressingType: 'レンタル&着付',
    options: { footwear: false, obiBag: false },
    additionalRentals: [], imageUrls: [],
    newImageFiles: [], newImagePreviews: [],
    paymentMethod: '', discountAmount: 0, discountMemo: '', onSitePaymentAdjusted: 0,
  };
}
