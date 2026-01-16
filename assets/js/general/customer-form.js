import { db } from "../common/firebase-config.js";
import { collection, addDoc, updateDoc, doc, getDoc, serverTimestamp, deleteDoc } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { toggleRadioUtil, handleError } from "../common/utils/ui-utils.js";
import { setupAuth } from "../common/utils/auth-utils.js";
import { uploadMediaArrayToCloudinary, prepareMediaPreviewUtil, removeMediaUtil } from "../common/utils/media-utils.js";
import { createMediaModal } from "../common/utils/media-utils.js";
const COLLECTION_NAME = "generalCustomers";
document.addEventListener("alpine:init", () => {
  Alpine.data("app", () => ({
    ...createMediaModal(),
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

    get docRef() {
      return doc(db, COLLECTION_NAME, this.docId);
    },

    async init() {
      setupAuth(this);
      const params = new URLSearchParams(window.location.search);
      const id = params.get("id");
      if (id) {
        this.isLoading = true;
        await this.loadCustomer(id);
        this.isLoading = false;
      }
    },

    async loadCustomer(id) {
      try {
        const docRef = doc(db, COLLECTION_NAME, id);
        const snap = await getDoc(docRef);
        if (snap.exists()) this.form = { id, ...snap.data() };
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
      const newId = await this.saveCustomer();
      window.open(`./reservation-form.html?id=${newId}`, "_blank");
      window.location.href = "./index.html";
    },

    // ===== メディアアップロード + 保存処理 =====
    async uploadAllMedia() {
      const newImageUrls = await uploadMediaArrayToCloudinary(this.newImageFiles, COLLECTION_NAME);
      return { newImageUrls };
    },

    async saveCustomer() {
      this.isSaving = true;
      try {
        const { newImageUrls } = await this.uploadAllMedia();
        const mergedImageUrls = [...(this.form.imageUrls || []), ...newImageUrls];

        const dataToSave = {
          ...this.form,
          imageUrls: mergedImageUrls,
          updatedAt: serverTimestamp(),
        };

        if (this.form.id) {
          await updateDoc(doc(db, COLLECTION_NAME, this.form.id), dataToSave);
          return this.form.id;
        } else {
          dataToSave.createdAt = serverTimestamp();
          const docRef = await addDoc(collection(db, COLLECTION_NAME), dataToSave);
          return docRef.id;
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
        await deleteDoc(this.docRef);
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
