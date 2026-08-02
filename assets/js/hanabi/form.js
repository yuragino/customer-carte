import { doc, getDoc, collection, addDoc, updateDoc, deleteDoc, serverTimestamp, query, where, getDocs } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { db } from '../common/firebase-config.js';
import { getYearSettings } from "../common/year-selector.js";
import { formatYen } from "../common/utils/format-utils.js";
import { toggleRadioUtil, handleError } from "../common/utils/ui-utils.js";
import { calculateCustomerPayment } from "../common/utils/calc-utils.js";
import { loadPriceConfig, DEFAULT_PRICES } from "../common/utils/price-config-utils.js";
import { uploadMediaArrayToCloudinary, prepareMediaPreviewUtil, removeMediaUtil } from "../common/utils/media-utils.js";
import { logFirestoreAction } from "../common/utils/firestore-utils.js";
import { setupAuth } from "../common/utils/auth-utils.js";
const COLLECTION_NAME = 'fireworks';
const CONFIG_COLLECTION_NAME = 'fireworks_config';
document.addEventListener('alpine:init', () => {
  Alpine.data('app', () => ({
    ...getYearSettings(),
    formatYen,
    activeCustomerIndex: null, // 一時的に操作中の顧客を指す共通インデックス
    docId: null,              // パラメータ
    isSubmitting: false,
    isDirty: false,           // 保存前の未反映の変更があるかどうか
    selectedImageUrl: null,
    formData: createInitialFormData(),
    prices: { ...DEFAULT_PRICES },
    rentalModal: {
      isOpen: false,
      input: { name: '', price: null },
    },
    discountModal: {
      isOpen: false,
      originalPrice: 0,
      input: { amount: 0, memo: '', type: 'discount' }, // type: 'discount'（値引き） | 'surcharge'（追加請求）
    },
    receiptModal: {
      isOpen: false,
    },

    get docRef() {
      return doc(db, COLLECTION_NAME, this.docId);
    },
    // 2027年以降は氏名・ふりがなを姓/名で分けて入力する
    get isNameSplit() {
      const year = this.docId ? this.formData.eventYear : this.selectedYear;
      return year >= 2027;
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
    // 値引き・追加請求の合計
    get totalDiscount() {
      return this.formData.customers.reduce((total, customer) => total + (customer.discountAmount || 0), 0);
    },
    // 会計画面用：現地払い分のみ、同じ項目・単価をまとめた内訳リスト
    get receiptItems() {
      const isOnSitePaymentMethod = this.formData.representative.reservationMethod === null || this.formData.representative.reservationMethod === 'ホームページ';
      const items = {};
      const addItem = (label, price, variant = null) => {
        if (!price) return;
        const key = `${label}|${price}|${variant}`;
        (items[key] ??= { label, price, variant, qty: 0 }).qty += 1;
      };

      // 基本料金（現地払い対象の予約方法の時だけ）→ オプション → 追加レンタルの順にまとめる
      if (isOnSitePaymentMethod) {
        this.formData.customers.forEach(customer => {
          if (customer.dressingType === 'レンタル&着付') {
            addItem('レンタル＆着付', customer.isChild ? this.prices.childRentalDressing : this.prices.rentalDressing, customer.isChild ? 'child' : 'adult');
          } else if (customer.dressingType === '着付のみ') {
            addItem('着付のみ（持込）', this.prices.dressingOnly);
          }
        });
      }
      // オプション・追加レンタルは予約方法によらず常に現地払い
      this.formData.customers.forEach(customer => {
        if (customer.options.footwear) addItem('レンタル履き物', this.prices.footwear);
        if (customer.gender === 'female' && customer.options.obiBag) addItem('レンタルバッグ', this.prices.bag);
      });
      this.formData.customers.forEach(customer => {
        customer.additionalRentals.forEach(item => addItem(item.name, item.price));
      });

      return Object.values(items);
    },

    async init() {
      setupAuth(this);
      const params = new URLSearchParams(window.location.search);
      this.initYearSelector();
      this.docId = params.get('docId');
      if (this.docId) await this.load();
      else this.updateCustomerList();
      this.prices = await loadPriceConfig(CONFIG_COLLECTION_NAME, this.docId ? this.formData.eventYear : this.selectedYear);

      // formData内のあらゆる変更（配列の追加削除やモーダル内の入力含む）を検知し、未保存状態を表す
      let isFirstRun = true;
      Alpine.effect(() => {
        JSON.stringify(this.formData);
        if (isFirstRun) { isFirstRun = false; return; }
        this.isDirty = true;
      });

      // 未保存のまま画面遷移・タブを閉じようとした時にブラウザ標準の確認ダイアログを出す
      window.addEventListener('beforeunload', (event) => {
        if (!this.isDirty) return;
        event.preventDefault();
        event.returnValue = '';
      });
    },

    async load() {
      try {
        const docSnap = await getDoc(this.docRef);
        if (docSnap.exists()) {
          this.formData = docSnap.data();
        } else {
          alert('データが見つかりませんでした。');
          this.docId = null;
        }
      } catch (error) {
        handleError('データの取得', error);
      }
    },

    openImageModal(url) {
      this.selectedImageUrl = url;
    },

    toggleRadio(event, modelName) {
      toggleRadioUtil(event, modelName, this.formData.representative);
    },

    toggleCustomerRadio(event, modelName, customerIndex) {
      toggleRadioUtil(event, modelName, this.formData.customers[customerIndex]);
    },

    // 名前欄からふりがな欄へAutoKanaで自動反映する
    bindAutoKana(nameId, kanaId, targetObj, field) {
      if (!window.AutoKana) return;
      const nameEl = document.getElementById(nameId);
      const kanaEl = document.getElementById(kanaId);
      if (!nameEl || !kanaEl) return;
      AutoKana.bind(nameId, kanaId, { katakana: false });

      let syncTimer = null;
      const sync = () => { targetObj[field] = kanaEl.value; };
      nameEl.addEventListener('focus', () => { syncTimer = setInterval(sync, 100); });
      nameEl.addEventListener('blur', () => { clearInterval(syncTimer); sync(); });
    },

    // 交通手段：選択し直したら追加選択肢（高速あり/なし、JR/東武）をリセット
    toggleTransportation(event) {
      toggleRadioUtil(event, 'transportation', this.formData.representative);
      this.formData.representative.transportationDetail = null;
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

    // 値引き・追加請求の調整
    openDiscountModal(customerIndex) {
      const customer = this.formData.customers[customerIndex];
      this.activeCustomerIndex = customerIndex;
      this.discountModal.originalPrice = this.calculateCustomerOnSitePayment(customer);
      this.discountModal.input.type = customer.discountAmount < 0 ? 'surcharge' : 'discount';
      this.discountModal.input.amount = Math.abs(customer.discountAmount || 0);
      this.discountModal.input.memo = customer.discountMemo;
      this.discountModal.isOpen = true;
    },
    applyDiscount() {
      const customer = this.formData.customers[this.activeCustomerIndex];
      const { type, amount, memo } = this.discountModal.input;
      customer.discountAmount = (type === 'surcharge' ? -1 : 1) * (amount || 0);
      customer.discountMemo = memo;
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

    // 姓/名で入力された氏名・ふりがなを結合してname/kanaに反映する
    syncSplitNames() {
      if (!this.isNameSplit) return;
      const rep = this.formData.representative;
      rep.name = `${rep.lastName} ${rep.firstName}`.trim();
      rep.kana = `${rep.lastNameKana} ${rep.firstNameKana}`.trim();
      this.formData.customers.forEach(customer => {
        customer.name = `${customer.lastName} ${customer.firstName}`.trim();
        customer.kana = `${customer.lastNameKana} ${customer.firstNameKana}`.trim();
      });
    },

    async submitForm() {
      try {
        this.isSubmitting = true;
        this.syncSplitNames();
        if (this.docId && !confirm(`${this.formData.representative.name}さんのデータを更新しますか？`)) return;
        const customersToSave = await this.uploadCustomerImages();
        const formDataToSave = { ...this.formData, customers: customersToSave, eventYear: this.selectedYear, updatedAt: serverTimestamp() };
        const collectionRef = collection(db, COLLECTION_NAME);
        if (this.docId) {
          await updateDoc(this.docRef, formDataToSave);
          await logFirestoreAction(COLLECTION_NAME, 'update', this.docId, formDataToSave);
          this.isDirty = false;
          window.location.href = `./index.html?year=${this.selectedYear}`;
        } else {
          const newDocRef = await addDoc(collectionRef, { ...formDataToSave, createdAt: serverTimestamp() });
          await logFirestoreAction(COLLECTION_NAME, 'create', newDocRef.id, formDataToSave);
          this.isDirty = false;
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
        const matchedDocs = snapshot.docs
          .filter(doc => doc.id !== this.docId)
          .sort((a, b) => a.data().eventYear - b.data().eventYear);
        if (matchedDocs.length === 0) return this.formData.representative.repeaterYears = [0];
        this.formData.representative.repeaterYears = matchedDocs.map(doc => doc.data().eventYear);
        const latestNote = matchedDocs[matchedDocs.length - 1].data().representative.repeaterNote;
        if (latestNote) this.formData.representative.repeaterNote = latestNote;
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
      lastName: '', firstName: '', lastNameKana: '', firstNameKana: '',
      visitTime: '', finishTime: '', returnTime: '',
      address: '', phone: '',
      transportation: '', transportationDetail: null, lineType: '',
      repeaterYears: [], repeaterNote: '', notes: '',
      checkpoints: { rentalPage: false, footwearBag: false, price: false, location: false, parking: false },
      paymentType: 'group', groupPaymentMethod: '', groupPaymentNote: '',
      isCanceled: false, isPaid: false,
    },
    femaleCount: 1, maleCount: 1,
    customers: []
  }
}
function createInitialCustomerData(gender, id) {
  return {
    id, gender, isChild: false, name: '', kana: '',
    lastName: '', firstName: '', lastNameKana: '', firstNameKana: '',
    bodyShape: null, bodyShapeMemo: '', weight: null, height: null, footSize: null,
    dressingType: 'レンタル&着付',
    options: { footwear: false, obiBag: false },
    additionalRentals: [],
    imageUrls: [],          // ← DBに保存済みのURL群
    newImageFiles: [],      // ← Fileオブジェクト群
    newImagePreviews: [],   // ← プレビュー表示用 blob:URL 群
    paymentMethod: '', paymentNote: '',
    discountAmount: 0,
    discountMemo: '',
    onSitePaymentAdjusted: 0,
  };
}
