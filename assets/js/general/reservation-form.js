import { db } from "../common/firebase-config.js";
import { collection, addDoc, updateDoc, doc, getDoc, serverTimestamp, deleteDoc } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { toggleRadioUtil, handleError } from "../common/utils/ui-utils.js";
import { setupAuth } from "../common/utils/auth-utils.js";
import { createMediaModal, removeMediaUtil, uploadMediaArrayToCloudinary, prepareMediaPreviewUtil } from "../common/utils/media-utils.js";

const RESERVE_COLLECTION = "generalReservations";
const CUSTOMERS_COLLECTION = "generalCustomers";
const GAS_API = "https://script.google.com/macros/s/AKfycbxF167IRD6y4ffSV-J1u-dyf5t6EoQfoiGton4CoH8nwfc4ZmmEb3icaC3ynhBoZ9iu/exec";

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
      isProvisional: false,
      date: '',
      startTime: '',
      endTime: '',
      // 自宅住所
      address: '',
      mapLinkHome: '',
      //その他住所
      location: '',
      mapLinkOther: '',
      locationLabel: '自宅',
      familyMembers: [],
      fittingTargets: [],
      // 着物をお預かりする日
      hasPickup: false,
      pickupDate: '',
      pickupStartTime: '',
      pickupEndTime: '',
      notes: '',
      imageUrls: [],
      // 連携情報（Googleカレンダー）
      calendarEventId: '',   // 着付けイベントID
      pickupEventId: '',     // お預かりイベントID
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
            familyMembers: customer.familyMembers || [],
            notes: customer.notes || '',
            imageUrls: customer.imageUrls || [],
            calendarEventId: customer.calendarEventId || '',
          });
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

          // 顧客情報も合わせてチェックする（存在する場合のみ）
          const customerId = this.form.customerId;
          if (customerId) {
            const customerSnap = await getDoc(doc(db, CUSTOMERS_COLLECTION, customerId));
            if (customerSnap.exists()) {
              const customer = customerSnap.data();

              const mergedFields = [];
              // name, imageUrls, contactRemark は除外
              const fieldsToMerge = [
                "phone",
                "contactMethod",
                "address",
                "mapLinkHome", // 顧客側では mapLink
                "familyMembers",
                "notes",
              ];

              for (const field of fieldsToMerge) {
                const reservationValue = this.form[field];
                // mapLinkHome は顧客データでは mapLink なので差し替え
                const customerField = field === "mapLinkHome" ? "mapLink" : field;
                const customerValue = customer[customerField];

                const reservationEmpty =
                  reservationValue === "" ||
                  reservationValue === null ||
                  (Array.isArray(reservationValue) && reservationValue.length === 0);
                const customerEmpty =
                  customerValue === "" ||
                  customerValue === null ||
                  (Array.isArray(customerValue) && customerValue.length === 0);

                // 両方空なら何もしない
                if (reservationEmpty && customerEmpty) continue;

                // 予約が空 & 顧客に値がある → 補完
                if (reservationEmpty && !customerEmpty) {
                  this.form[field] = customerValue;
                  mergedFields.push(field);
                }
              }

              // 表示名変換
              const fieldLabels = {
                phone: "電話番号",
                contactMethod: "受付方法",
                address: "住所",
                mapLinkHome: "GoogleマップURL",
                familyMembers: "家族構成",
                notes: "備考",
              };

              const mergedDisplayLabels = mergedFields.map(f => fieldLabels[f] || f);

              if (mergedDisplayLabels.length > 0) {
                const message =
                  `以下の項目を顧客情報から取得しました：\n` +
                  `・${mergedDisplayLabels.join("\n・")}\n\n` +
                  `内容を確認し、問題がなければ「更新」ボタンを押してください。`;
                alert(message);
              }
            }
          }
        }
      } catch (error) {
        handleError("予約データの取得", error);
      }
    },

    // ===== メディアアップロード + 保存処理 =====
    async uploadAllMedia() {
      return await uploadMediaArrayToCloudinary(this.newImageFiles, RESERVE_COLLECTION);
    },

    // ===== 登録 or 更新 =====
    async submitForm() {
      this.isSaving = true;
      try {
        const reserveFormUrl = this.reservationId
          ? `https://yuragino.github.io/customer-carte/general/reservation-form.html?reservationId=${this.reservationId}`
          : '';

        const newImageUrls = await this.uploadAllMedia();
        const mergedImageUrls = [...(this.form.imageUrls || []), ...newImageUrls];
        const dataToSave = {
          ...this.form,
          imageUrls: mergedImageUrls,
          updatedAt: serverTimestamp(),
        };

        // ——— Googleカレンダー同期用ペイロード ———
        const calendarPayload = {
          name: this.form.name,
          date: this.form.date,
          startDateTime: `${this.form.date}T${this.form.startTime}:00+09:00`,
          endDateTime: `${this.form.date}T${this.form.endTime}:00+09:00`,
          pickupStartDateTime: this.form.pickupDate
            ? `${this.form.pickupDate}T${this.form.pickupStartTime}:00+09:00`
            : '',
          pickupEndDateTime: this.form.pickupDate
            ? `${this.form.pickupDate}T${this.form.pickupEndTime}:00+09:00`
            : '',
          location:
            this.form.locationLabel === '自宅'
              ? this.form.address
              : this.form.location,
          phone: this.form.phone,
          contactMethod: this.form.contactMethod,
          contactRemark: this.form.contactRemark,
          notes: this.form.notes,
          reserveFormUrl,
          mapLink:
            this.form.locationLabel === '自宅'
              ? this.form.mapLinkHome
              : this.form.mapLinkOther,
        };

        // ——— 新規 or 更新 ———
        if (this.reservationId) {
          // 更新モード
          await updateDoc(this.reservationRef, dataToSave);

          await this.syncToCalendar({
            ...calendarPayload,
            action: 'update',
            eventId: this.form.calendarEventId,
            pickupEventId: this.form.pickupEventId,
          });
        } else {
          // 新規登録モード
          this.form.createdAt = serverTimestamp();
          const reservationRef = await addDoc(collection(db, RESERVE_COLLECTION), dataToSave);

          const result = await this.syncToCalendar({
            ...calendarPayload,
            reserveFormUrl: `https://yuragino.github.io/customer-carte/general/reservation-form.html?reservationId=${reservationRef.id}`,
            action: 'create',
          });

          if (result?.eventId || result?.pickupEventId) {
            await updateDoc(reservationRef, {
              calendarEventId: result.eventId || '',
              pickupEventId: result.pickupEventId || '',
            });
          }
        }

        this.redirectToList();
      } catch (e) {
        handleError('予約の保存', e);
      } finally {
        this.isSaving = false;
      }
    },

    // ===== GoogleカレンダーAPI 連携 =====
    async syncToCalendar(payload) {
      try {
        const res = await fetch(GAS_API, {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(`GAS API error: ${res.status}`);
        const text = await res.text();
        const parsed = JSON.parse(text);
        return parsed;
      } catch (error) {
        handleError('GAS 同期', error);
        return null;
      }
    },

    // ===== 予約削除 + カレンダー削除 =====
    async deleteForm() {
      if (!confirm('この予約を削除しますか？')) return;
      try {
        await deleteDoc(this.reservationRef);
        await this.syncToCalendar({
          action: 'delete',
          eventId: this.form.calendarEventId,
          pickupEventId: this.form.pickupEventId,
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
      const targetObj = mediaType === 'saved-image' ? this.form : this;
      removeMediaUtil(mediaType, index, targetObj);
    },
  }));
});
