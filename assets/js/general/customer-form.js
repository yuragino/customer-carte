import { db } from "../common/firebase-config.js";
import { collection, addDoc, updateDoc, doc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { handleError } from "../common/utils/ui-utils.js";
import { setupAuth } from "../common/utils/auth-utils.js";
const COLLECTION_NAME = "generalCustomers";
document.addEventListener("alpine:init", () => {
  Alpine.data("app", () => ({
    form: {
      id: null,
      name: "",
      kana: "",
      phone: "",
      address: "",
      notes: "",
    },
    isSaving: false,

    async init() {
      setupAuth(this);
      const params = new URLSearchParams(window.location.search);
      const id = params.get("id");
      if (id) await this.loadCustomer(id);
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

    // async submitForm() {
    //   this.isSaving = true;
    //   try {
    //     const { id, ...data } = this.form;
    //     data.updatedAt = serverTimestamp();

    //     if (id) {
    //       await updateDoc(doc(db, COLLECTION_NAME, id), data);
    //       alert("顧客情報を更新しました。");
    //     } else {
    //       data.createdAt = serverTimestamp();
    //       await addDoc(collection(db, COLLECTION_NAME), data);
    //       alert("顧客を登録しました。");
    //     }
    //     window.location.href = "./index.html";
    //   } catch (e) {
    //     handleError("顧客の保存", e);
    //   } finally {
    //     this.isSaving = false;
    //   }
    // },

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

    // 共通の保存処理
    async saveCustomer() {
      this.isSaving = true;
      try {
        const { id, ...data } = this.form;
        data.updatedAt = serverTimestamp();
        if (id) {
          await updateDoc(doc(db, COLLECTION_NAME, id), data);
          return id;
        } else {
          data.createdAt = serverTimestamp();
          const docRef = await addDoc(collection(db, COLLECTION_NAME), data);
          return docRef.id; // 新しく作成したIDを返す
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

  }));
});
