import { doc, getDoc, collection, addDoc, updateDoc, deleteDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js';
import { db } from '../common/firebase-config.js';
import { SEIJINSHIKI_PRICES, OUTFIT_KEY_MAP } from '../common/constants.js';
import { getYearSettings } from '../common/year-selector.js';
import { toggleRadioUtil, handleError } from "../common/utils/ui-utils.js";
import { uploadMediaArrayToCloudinary, prepareMediaPreviewUtil, removeMediaUtil } from '../common/utils/media-utils.js';
import { formatFullDateTime, formatYen } from '../common/utils/format-utils.js';
const COLLECTION_NAME = 'seijinshiki';

document.addEventListener('alpine:init', () => {
  Alpine.data('app', () => ({
    ...getYearSettings("seijinshiki"),
    formatFullDateTime,
    formatYen,
    // ===== 状態管理 =====
    docId: null,
    isSubmitting: false,

    // --- フォーム全体のデータ ---
    formData: createInitialFormData(),

    // --- 打ち合わせモーダル用 ---
    isMeetingModalOpen: false,
    meetingForm: createInitialMeetingForm(),
    currentMeetingId: null,

    get docRef() {
      return doc(db, COLLECTION_NAME, this.docId);
    },
    get totalAmount() {
      const { kitsuke, hairMake, options } = this.formData.estimateInfo;
      const baseTotal = this.calcPrice(kitsuke) + this.calcPrice(hairMake);
      const optionsTotal = options.reduce((sum, option) => sum + option.price, 0);
      return baseTotal + optionsTotal;
    },
    get sortedMeetings() {
      return [...this.formData.meetings].sort((a, b) => new Date(a.date) - new Date(b.date));
    },

    async init() {
      const params = new URLSearchParams(window.location.search);
      this.initYearSelector();
      this.docId = params.get('docId');
      if (this.docId) await this.loadData();
    },

    async loadData() {
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

    toggleRadio(event, modelName) {
      toggleRadioUtil(event, modelName, this.formData.basicInfo);
    },

    async uploadAllMedia() {
      const newImageUrls = await uploadMediaArrayToCloudinary(this.newImageFiles, COLLECTION_NAME);
      const newVideoUrls = await uploadMediaArrayToCloudinary(this.newVideoFiles, COLLECTION_NAME);
      return { newImageUrls, newVideoUrls };
    },

    async submitForm() {
      this.isSubmitting = true;
      try {
        const { newImageUrls, newVideoUrls } = await this.uploadAllMedia();
        const { newImageFiles, newVideoFiles, newImagePreviews, newVideoPreviews, ...mediaToSave } = this.formData.media;
        const formDataToSave = {
          ...this.formData,
          media: {
            ...mediaToSave,
            imageUrls: [...mediaToSave.imageUrls, ...newImageUrls],
            videoUrls: [...mediaToSave.videoUrls, ...newVideoUrls],
          },
          eventYear: this.selectedYear,
          updatedAt: serverTimestamp(),
        };
        const collectionRef = collection(db, COLLECTION_NAME);
        if (this.docId) {
          await updateDoc(this.docRef, formDataToSave);
          alert('更新が完了しました。');
        } else {
          await addDoc(collectionRef, { ...formDataToSave, createdAt: serverTimestamp() });
          alert('登録が完了しました。');
          window.location.href = `./index.html?year=${this.selectedYear}`;
        }
      } catch (error) {
        console.error('登録エラー: ', error);
        alert(`登録中にエラーが発生しました。\n${error.message}`);
      } finally {
        this.isSubmitting = false;
      }
    },

    async deleteForm() {
      if (!confirm('このカルテを削除しますか？')) return;
      if (!this.docRef) return alert('削除対象が見つかりません。');
      try {
        await deleteDoc(this.docRef);
        window.location.href = `./index.html?year=${this.selectedYear}`;
      } catch (error) {
        console.error('削除エラー:', error);
        alert(`削除中にエラーが発生しました。\n${error.message}`);
      }
    },

    // ===== 打ち合わせ・お預かり =====
    openMeetingModal(meetingId = null) {
      const selectedMeeting = this.formData.meetings.find(m => m.id === meetingId);
      this.meetingForm = selectedMeeting ? { ...selectedMeeting } : createInitialMeetingForm();
      this.currentMeetingId = selectedMeeting ? selectedMeeting.id : Date.now();
      this.isMeetingModalOpen = true;
    },
    closeMeetingModal() {
      this.isMeetingModalOpen = false;
    },
    saveMeetingData() {
      const targetIndex = this.formData.meetings.findIndex(m => m.id === this.currentMeetingId);
      const updatedMeetingData = { ...this.meetingForm, id: this.currentMeetingId };
      if (targetIndex === -1) this.formData.meetings.push(updatedMeetingData);
      else this.formData.meetings.splice(targetIndex, 1, updatedMeetingData);
      this.closeMeetingModal();
    },
    deleteMeeting(meetingId) {
      if (!confirm('この項目を削除しますか？')) return;
      this.formData.meetings = this.formData.meetings.filter(m => m.id !== meetingId);
    },

    // ===== 見積もり =====
    addOption() {
      this.formData.estimateInfo.options.push({ name: '', fixed: false, hasToujitsu: false, hasMaedori: false, price: 0 });
    },
    deleteOption(index) {
      if (!confirm('このオプションを削除しますか？')) return;
      this.formData.estimateInfo.options.splice(index, 1);
    },
    calcPrice(item) {
      const outfitKey = OUTFIT_KEY_MAP[this.formData.basicInfo.outfit];
      const priceTable = SEIJINSHIKI_PRICES[outfitKey];
      const { hasToujitsu, hasMaedori } = item;
      const both = hasToujitsu && hasMaedori;
      if (item.name === '着付') {
        if (both) return priceTable.KITSUKE.BOTH;
        if (hasToujitsu) return priceTable.KITSUKE.TOUJITSU;
        if (hasMaedori) return priceTable.KITSUKE.MAEDORI;
      }
      if (item.name === 'ヘアメイク') {
        if (outfitKey !== 'FURISODE') return 0;
        let unitPrice = 0;
        if (item.type === 'ヘア＆メイク') unitPrice = priceTable.HAIR_MAKE;
        else if (item.type === 'ヘアのみ') unitPrice = priceTable.HAIR_ONLY;
        return (hasToujitsu + hasMaedori) * unitPrice;
      }
      return 0;
    },
    // ===== メディア処理 =====
    prepareMediaPreview(event, type) {
      prepareMediaPreviewUtil(event, type, this.formData.media);
    },

    removeMedia(mediaType, index) {
      removeMediaUtil(mediaType, index, this.formData.media);
    },

    // ===== ユーティリティ =====
    swapSchedule() {
      // 当日スケジュール：ヘアメイクと着付の順序を入れ替える
      const schedule = this.formData.toujitsuInfo.schedule;
      [schedule[0], schedule[1]] = [schedule[1], schedule[0]];
    },

  }));
});

function createInitialFormData() {
  return {
    basicInfo: {
      reservationDate: '',
      name: '', kana: '', introducer: '', phone: '', address: '',
      lineType: '', height: null, footSize: null, outfit: '振袖',
      rentalType: '自前', outfitMemo: '', hairMakeStaff: ''
    },
    toujitsuInfo: {
      schedule: [
        { id: 1, type: 'hair', start: '', end: '' },
        { id: 2, type: 'kitsuke', start: '', end: '' }
      ],
      note: ''
    },
    meetings: [],
    maedoriInfo: {
      status: 'あり', type: 'スタジオ', camera: '', date: '', hairStart: '', hairEnd: '',
      kitsukeStart: '', kitsukeEnd: '', shootStart: '', shootEnd: '',
      place: '', note: ''
    },
    estimateInfo: {
      kitsuke: { name: '着付', fixed: true, hasToujitsu: true, hasMaedori: false },
      hairMake: { name: 'ヘアメイク', fixed: true, hasToujitsu: true, hasMaedori: false, type: 'ヘア＆メイク' },
      options: [],
      receiptDate: ''
    },
    media: {
      imageUrls: [],
      videoUrls: [],
      newImageFiles: [],
      newVideoFiles: [],
      newImagePreviews: [],
      newVideoPreviews: [],
    },
    isCanceled: false,
  };
}

// 打ち合わせモーダル
function createInitialMeetingForm() {
  return { id: null, type: '打ち合わせ', date: '', place: '', note: '' };
}
