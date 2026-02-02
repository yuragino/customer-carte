import { db } from "../common/firebase-config.js";
import { collection, addDoc, updateDoc, doc, getDoc, serverTimestamp, deleteDoc } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { toggleRadioUtil, handleError } from "../common/utils/ui-utils.js";
import { setupAuth } from "../common/utils/auth-utils.js";
import { createMediaModal, removeMediaUtil, uploadMediaArrayToCloudinary, prepareMediaPreviewUtil } from "../common/utils/media-utils.js";
const RESERVE_COLLECTION = "generalReservations";
const CUSTOMERS_COLLECTION = "generalCustomers";
const GAS_API = "https://script.google.com/macros/s/AKfycbyz95Zx55WXr7UzDiCgLY8PApHP7ddRQ7RWxty9mixDq2jsOHeY5FgVbhPZYxYUgBjp/exec";
document.addEventListener('alpine:init', () => {
  Alpine.data('app', () => ({
    ...createMediaModal(),
    reservationId: null,
    form: {
      // 顧客情報
      customerId: null,
      name: '',
      phone: '',
      contactMethod: '',
      contactRemark: '',
      // 予約情報
      date: '',
      startTime: '',
      endTime: '',
      // 自宅住所・マップ
      address: '',
      mapLinkHome: '',
      // その他住所・マップ
      location: '',
      mapLinkOther: '',
      // 選択状態
      locationLabel: '自宅',
      notes: '',
      imageUrls: [],
      // 連携情報
      calendarEventId: '',
    },
    isSaving: false,
    newImageFiles: [],
    newImagePreviews: [],

    get reservationRef() {
      return doc(db, RESERVE_COLLECTION, this.reservationId);
    },

    async init() {
      setupAuth(this);
      const params = new URLSearchParams(window.location.search);
      const customerId = params.get('customerId');
      this.reservationId = params.get('reservationId');
      if (this.reservationId) {
        await this.loadReservation();
      } else if (customerId) {
        await this.loadCustomerData(customerId);
      }
    },

    // 顧客データをロードしてフォームに反映
    async loadCustomerData(customerId) {
      try {
        const customerSnap = await getDoc(doc(db, CUSTOMERS_COLLECTION, customerId));
        if (customerSnap.exists()) {
          const customer = customerSnap.data();
          Object.assign(this.form, {
            customerId,
            name: customer.name,
            phone: customer.phone || '',
            contactMethod: customer.contactMethod || '',
            contactRemark: customer.contactRemark || '',
            address: customer.address || '',
            mapLinkHome: customer.mapLink || '',
            notes: customer.notes || '',
            imageUrls: customer.imageUrls || [],
            calendarEventId: customer.calendarEventId || ''
          })
        }
      } catch (error) {
        handleError('顧客情報の取得', error);
      }
    },

    // 予約を読み込み（更新モード）
    async loadReservation() {
      try {
        const resSnap = await getDoc(this.reservationRef);
        if (resSnap.exists()) {
          Object.assign(this.form, resSnap.data());
        }
      } catch (error) {
        handleError('予約データの取得', error);
      }
    },

    // ===== メディアアップロード + 保存処理 =====
    async uploadAllMedia() {
      return await uploadMediaArrayToCloudinary(this.newImageFiles, RESERVE_COLLECTION);
    },

    // 登録 or 更新
    async submitForm() {
      this.isSaving = true;
      try {
        const reserveFormUrl = this.reservationId ? `https://yuragino.github.io/customer-carte/general/reservation-form.html?reservationId=${this.reservationId}` : '';
        const newImageUrls = await this.uploadAllMedia();
        const mergedImageUrls = [...(this.form.imageUrls || []), ...newImageUrls];
        const dataToSave = {
          ...this.form,
          imageUrls: mergedImageUrls,
          updatedAt: serverTimestamp(),
        };
        const calendarPayload = {
          name: this.form.name,
          startDateTime: `${this.form.date}T${this.form.startTime}:00+09:00`,
          endDateTime: `${this.form.date}T${this.form.endTime}:00+09:00`,
          location: this.form.locationLabel === '自宅' ? this.form.address : this.form.location,
          phone: this.form.phone,
          contactMethod: this.form.contactMethod,
          contactRemark: this.form.contactRemark,
          notes: this.form.notes,
          link: reserveFormUrl,
          mapLink: this.form.locationLabel === '自宅' ? this.form.mapLinkHome : this.form.mapLinkOther,
        };

        if (this.reservationId) {
          // 更新
          await updateDoc(this.reservationRef, dataToSave);
          await this.syncToCalendar({
            ...calendarPayload,
            action: "update",
            eventId: this.form.calendarEventId,
          });
        } else {
          // 新規登録
          this.form.createdAt = serverTimestamp();
          const reservationRef = await addDoc(collection(db, RESERVE_COLLECTION), dataToSave);
          const result = await this.syncToCalendar({
            ...calendarPayload,
            link: `https://yuragino.github.io/customer-carte/general/reservation-form.html?reservationId=${reservationRef.id}`,
            action: "create",
          });
          if (result?.eventId) {
            await updateDoc(reservationRef, { calendarEventId: result.eventId });
          }
        }
        this.redirectToList();
      } catch (e) {
        handleError('予約の保存', e);
      } finally {
        this.isSaving = false;
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
        return text;
      } catch (error) {
        handleError('GAS 同期', error);
        return null;
      }
    },

    async deleteForm() {
      if (!confirm('この予約を削除しますか？')) return;
      try {
        await deleteDoc(this.reservationRef);
        await this.syncToCalendar({
          action: "delete",
          eventId: this.form.calendarEventId,
        });
        this.redirectToList();
      } catch (error) {
        handleError('データの削除', error);
      }
    },

    toggleRadio(event, modelName) {
      toggleRadioUtil(event, modelName, this.form);
    },

    redirectToList() {
      window.location.href = './reservation-list.html';
    },

    // ===== メディア処理 =====
    prepareMediaPreview(event, type) {
      prepareMediaPreviewUtil(event, type, this);
    },

    removeMedia(mediaType, index) {
      removeMediaUtil(mediaType, index, this);
    },


  }));
});
