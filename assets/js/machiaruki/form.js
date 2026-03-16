import { doc, getDoc, collection, addDoc, updateDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { db } from '../common/firebase-config.js';
import { formatYen } from "../common/utils/format-utils.js";
import { toggleRadioUtil } from "../common/utils/ui-utils.js";
import { uploadMediaArrayToCloudinary, prepareMediaPreviewUtil, removeMediaUtil } from "../common/utils/media-utils.js";
import { logFirestoreAction } from "../common/utils/firestore-utils.js";
import { setupAuth } from "../common/utils/auth-utils.js";

const COLLECTION_NAME = 'machiaruki';
const GAS_API = "https://script.google.com/macros/s/AKfycbwReYE9KmJ1TfsrvQ7LJQS2aiy5SSZMRKa9YJFwfcvANUesBdoRdOrtMji8gvBzKv7mBw/exec";

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

    // 個々の顧客の合計金額（着付＋追加レンタル）
    customerTotalPrepayment(customer) {
      if (!customer) return 0;
      const dressing = Number(customer.dressingPrice) || 0;
      const rentals = (customer.additionalRentals || []).reduce(
        (sum, item) => sum + (Number(item.price) || 0),
        0
      );
      return dressing + rentals;
    },

    // 顧客1人あたりの割引後合計
    customerTotalAdjusted(customer) {
      const base = this.customerTotalPrepayment(customer);
      const discount = Number(customer.discountAmount) || 0;
      return base - discount;
    },

    // グループ全体の合計（割引込み）
    get groupTotalPrepayment() {
      if (!this.formData?.customers?.length) return 0;
      return this.formData.customers.reduce(
        (total, customer) => total + this.customerTotalAdjusted(customer),
        0
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

      // 元の金額（割引前）
      this.discountModal.originalPrice = this.customerTotalPrepayment(customer);
      this.discountModal.input.amount = customer.discountAmount || 0;
      this.discountModal.input.memo = customer.discountMemo || "";
      this.discountModal.adjustedPrice =
        this.discountModal.originalPrice - this.discountModal.input.amount;

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
      try {
        this.isSubmitting = true;
        if (this.docId && !confirm(`${this.formData.representative.name}さんのデータを更新しますか？`)) return;

        const female = this.formData.femaleCount;
        const male = this.formData.maleCount;
        const parts = [];
        if (female) parts.push(`女${female}名`);
        if (male) parts.push(`男${male}名`);
        const genderSummary = parts.length ? `／${parts.join(' ')}` : '';
        const eventTitle = `${this.formData.representative.name || "お客様"}様（まち歩き${genderSummary}）`;

        const customers = await this.processCustomerData();
        const formDataToSave = { ...this.formData, customers, updatedAt: serverTimestamp() };
        const col = collection(db, COLLECTION_NAME);

        const visitDateTime = this.formData.representative.visitDateTime; // 例: "2026-03-16T05:31"
        const finishTime = this.formData.representative.finishTime;       // 例: "12:00"

        // 来店日時の「日付部分」だけ抽出
        const visitDate = visitDateTime ? visitDateTime.split("T")[0] : null;

        const startDateTime = visitDateTime ? `${visitDateTime}:00+09:00` : "";
        const endDateTime = (visitDate && finishTime)
          ? `${visitDate}T${finishTime}:00+09:00`
          : "";

        const calendarPayload = {
          name: this.formData.representative.name,
          title: eventTitle,
          startDateTime,
          endDateTime,
          location: this.formData.representative.address || "",
          phone: this.formData.representative.phone || "",
          contactMethod: this.formData.representative.contactMethod || "",
          notes: this.formData.representative.notes || "",
          paymentMethod: this.formData.representative.groupPaymentMethod || "",
          paymentTiming: this.formData.representative.paymentTiming || "",
          mapLink: this.formData.representative.mapLink || "",
          formUrl: this.docId
            ? `https://yuragino.github.io/customer-carte/machiaruki/form.html?docId=${this.docId}`
            : "",
        };

        if (this.docId) {
          // 更新
          await updateDoc(this.docRef, formDataToSave);
          await logFirestoreAction(COLLECTION_NAME, "update", this.docId, formDataToSave);

          await this.syncToCalendar({
            ...calendarPayload,
            action: "update",
            eventId: this.formData.representative.calendarEventId || "",
          });

          location.href = "./index.html";
        } else {
          // 新規登録
          const newDocRef = await addDoc(col, { ...formDataToSave, createdAt: serverTimestamp() });
          await logFirestoreAction(COLLECTION_NAME, "create", newDocRef.id, formDataToSave);

          const result = await this.syncToCalendar({
            ...calendarPayload,
            action: "create",
            formUrl: `https://yuragino.github.io/customer-carte/machiaruki/form.html?docId=${newDocRef.id}`,
          });

          if (result?.status === "ERROR") {
            alert(result.message);
            console.error("GAS Error:", result.message);
            this.isSubmitting = false;
            return;
          }

          // 登録成功時、eventIdをFirestoreに保存
          if (result?.eventId) {
            await updateDoc(newDocRef, {
              "representative.calendarEventId": result.eventId,
            });
          }

          console.log("✅ eventId 保存成功:", result.eventId);
          location.href = "./index.html";
        }
      } catch (error) {
        console.error("登録エラー", error);
        alert(`登録中にエラーが発生しました。\n${error.message}`);
      } finally {
        this.isSubmitting = false;
      }
    },

    async deleteForm() {
      if (!confirm("このカルテを削除しますか？")) return;
      try {
        await deleteDoc(this.docRef);

        await this.syncToCalendar({
          action: "delete",
          eventId: this.formData?.representative?.calendarEventId || "",
        });

        window.location.href = "./index.html";
      } catch (error) {
        console.error("削除エラー: ", error);
        alert(`削除中にエラーが発生しました。\n${error.message}`);
      }
    },

    async syncToCalendar(payload) {
      try {
        const res = await fetch(GAS_API, {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(`GAS API error: ${res.status}`);
        const text = await res.text();
        return JSON.parse(text);
      } catch (error) {
        console.error("GAS 同期エラー:", error);
        return null;
      }
    },

  }));
});

function createInitialFormData() {
  return {
    representative: {
      reservationMethod: null,
      eventName: null,
      name: '', kana: '',
      visitDateTime: '', finishTime: '', returnTime: '',
      address: '', phone: '',
      transportation: '',
      contactMethod: '',
      contactRemark: '',
      notes: '',
      checkpoints: { rentalPage: false, footwearBag: false, price: false, location: false, parking: false },
      paymentType: 'group', groupPaymentMethod: '',
      paymentTiming: '',
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
    dressingPrice: null,
    options: { footwear: false, obiBag: false },
    additionalRentals: [],
    imageUrls: [],          // ← DBに保存済みのURL群
    newImageFiles: [],      // ← Fileオブジェクト群
    newImagePreviews: [],   // ← プレビュー表示用 blob:URL 群
    paymentMethod: '',
    discountAmount: 0,
    discountMemo: '',
  };
}

