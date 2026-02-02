import { db } from "../common/firebase-config.js";
import { collection, addDoc, updateDoc, doc, getDoc, serverTimestamp, deleteDoc } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { toggleRadioUtil, handleError } from "../common/utils/ui-utils.js";
import { setupAuth } from "../common/utils/auth-utils.js";
import { createMediaModal, uploadMediaArrayToCloudinary, prepareMediaPreviewUtil, removeMediaUtil } from "../common/utils/media-utils.js";
const COLLECTION_NAME = "generalCustomers";
document.addEventListener("alpine:init", () => {
  Alpine.data("app", () => ({
    ...createMediaModal(),
    customerId: null,
    form: {
      name: "",
      kana: "",
      phone: "",
      address: "",
      mapLink: "",
      notes: "",
      imageUrls: []
    },
    isSaving: false,
    isLoading: false,

    newImageFiles: [],
    newImagePreviews: [],

    get customerRef() {
      return doc(db, COLLECTION_NAME, this.customerId);
    },

    async init() {
      setupAuth(this);
      const params = new URLSearchParams(window.location.search);
      this.customerId = params.get("customerId");
      if (this.customerId) {
        this.isLoading = true;
        await this.loadCustomer();
        this.isLoading = false;
      }
    },

    async loadCustomer() {
      try {
        const customerSnap = await getDoc(this.customerRef);
        if (customerSnap.exists()) {
          Object.assign(this.form, customerSnap.data());
        }
      } catch (e) {
        handleError("顧客情報の読込", e);
      }
    },

    // 通常の登録・更新ボタン
    async submitForm() {
      await this.saveCustomer();
      window.location.href = "./index.html";
    },

    // 新規登録＋すぐ予約フォームへ
    async submitAndGoReservation() {
      const newCustomerDocId = await this.saveCustomer();
      window.open(`./reservation-form.html?customerId=${newCustomerDocId}`, "_blank");
      window.location.href = "./index.html";
    },

    // ===== メディアアップロード + 保存処理 =====
    async uploadAllMedia() {
      return await uploadMediaArrayToCloudinary(this.newImageFiles, COLLECTION_NAME);
    },

    async saveCustomer() {
      this.isSaving = true;
      try {
        const newImageUrls = await this.uploadAllMedia();
        const mergedImageUrls = [...(this.form.imageUrls || []), ...newImageUrls];

        const dataToSave = {
          ...this.form,
          imageUrls: mergedImageUrls,
          updatedAt: serverTimestamp(),
        };

        if (this.customerId) {
          // 更新
          await updateDoc(this.customerRef, dataToSave);
        } else {
          // 新規登録
          dataToSave.createdAt = serverTimestamp();
          const customerRef = await addDoc(collection(db, COLLECTION_NAME), dataToSave);
          return customerRef.id;
        }
      } catch (e) {
        handleError("顧客の保存", e);
      } finally {
        this.isSaving = false;
      }
    },

    async deleteForm() {
      if (!confirm('この顧客情報を削除しますか？')) return;
      try {
        await deleteDoc(this.customerRef);
        window.location.href = './index.html';
      } catch (error) {
        handleError('データの削除', error);
      }
    },

    // ===== メディア処理 =====
    prepareMediaPreview(event, type) {
      prepareMediaPreviewUtil(event, type, this);
    },

    removeMedia(mediaType, index) {
      removeMediaUtil(mediaType, index, this);
    },

    toggleRadio(event, modelName) {
      toggleRadioUtil(event, modelName, this.form);
    }

  }));
});
