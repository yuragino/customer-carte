import { doc, getDoc, collection, addDoc, updateDoc, deleteDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js';
import { db } from '../common/firebase-config.js';
import { getYearSettings } from '../common/year-selector.js';
import { toggleRadioUtil, handleError } from "../common/utils/ui-utils.js";
import { uploadMediaArrayToCloudinary, prepareMediaPreviewUtil, removeMediaUtil, createMediaModal } from '../common/utils/media-utils.js';
import { formatFullDateTime, formatYen } from '../common/utils/format-utils.js';
import { logFirestoreAction } from "../common/utils/firestore-utils.js";
import { setupAuth } from '../common/utils/auth-utils.js';
const COLLECTION_NAME = 'seijinshiki';
document.addEventListener('alpine:init', () => {
  Alpine.data('app', () => ({
    ...getYearSettings("seijinshiki"),
    ...createMediaModal(),
    formatFullDateTime,
    formatYen,
    // ===== 状態管理 =====
    docId: null,
    isSubmitting: false,
    newYoutubeLink: '', // 新規入力用

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
      const optionsTotal = options.reduce((sum, o) => sum + (o.price || 0), 0);
      return (kitsuke.price || 0) + (hairMake.price || 0) + optionsTotal;
    },
    get sortedMeetings() {
      return [...this.formData.meetings].sort((a, b) => new Date(a.date) - new Date(b.date));
    },

    async init() {
      setupAuth(this);
      const params = new URLSearchParams(window.location.search);
      this.initYearSelector();
      this.docId = params.get('docId');
      if (this.docId) await this.load();
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
        handleError('データの取得', error);
      }
    },

    toggleRadio(event, modelName) {
      toggleRadioUtil(event, modelName, this.formData.basicInfo);
    },

    async uploadAllMedia() {
      const newImageUrls = await uploadMediaArrayToCloudinary(this.formData.media.newImageFiles, COLLECTION_NAME);
      const newVideoUrls = await uploadMediaArrayToCloudinary(this.formData.media.newVideoFiles, COLLECTION_NAME);
      return { newImageUrls, newVideoUrls };
    },

    async submitForm() {
      const hair = this.formData.toujitsuInfo.schedule.find(t => t.type === "hair");
      const kitsuke = this.formData.toujitsuInfo.schedule.find(t => t.type === "kitsuke");
      if (hair?.start && hair?.end && kitsuke?.start && kitsuke?.end) {
        // 日付オブジェクトとして比較
        const hairStart = new Date(`2000-01-01T${hair.start}`);
        const hairEnd = new Date(`2000-01-01T${hair.end}`);
        const kitsukeStart = new Date(`2000-01-01T${kitsuke.start}`);
        const kitsukeEnd = new Date(`2000-01-01T${kitsuke.end}`);
        // 時間が逆転している（終了が開始より前）
        if (hairEnd < hairStart || kitsukeEnd < kitsukeStart) {
          alert("エラー：ヘアメイクまたは着付けの終了時刻が開始時刻より早くなっています。");
          return;
        }
        // 完全に同時刻または重なっている
        if (!(hairEnd <= kitsukeStart || kitsukeEnd <= hairStart)) {
          alert("エラー：ヘアメイクと着付けの時間が重なっています。");
          return;
        }
      }
      try {
        this.isSubmitting = true;
        if (this.docId && !confirm(`${this.formData.basicInfo.name}さんのデータを更新しますか？`)) return;
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
          await logFirestoreAction(COLLECTION_NAME, 'update', this.docId, formDataToSave);
          window.location.href = `./index.html?year=${this.selectedYear}`;
        } else {
          const newDocRef = await addDoc(collectionRef, { ...formDataToSave, createdAt: serverTimestamp() });
          await logFirestoreAction(COLLECTION_NAME, 'create', newDocRef.id, formDataToSave);
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
      this.formData.estimateInfo.options.push({ name: '', hasToujitsu: false, hasMaedori: false, price: 0 });
    },
    deleteOption(index) {
      if (!confirm('このオプションを削除しますか？')) return;
      this.formData.estimateInfo.options.splice(index, 1);
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
      rentalType: '', outfitMemo: '', hairMakeStaff: '',
    },
    toujitsuInfo: {
      schedule: [
        { type: 'kitsuke', start: '', end: '' },
        { type: 'hair', start: '', end: '' }
      ],
      note: ''
    },
    meetings: [],
    maedoriInfo: {
      status: 'なし', type: 'スタジオ', camera: '', date: '', hairStart: '', hairEnd: '',
      kitsukeStart: '', kitsukeEnd: '', shootStart: '', shootEnd: '',
      place: '', note: ''
    },
    estimateInfo: {
      kitsuke: { name: '着付', hasToujitsu: false, hasMaedori: false, price: 0 },
      hairMake: { name: 'ヘアメイク', hasToujitsu: false, hasMaedori: false, type: 'ヘア＆メイク', price: 0 },
      options: [],
      receiptDate: '',
      isMiyuki: false,
    },
    media: {
      imageUrls: [],
      videoUrls: [],
      newImageFiles: [],
      newVideoFiles: [],
      newImagePreviews: [],
      newVideoPreviews: [],
      youtubeLinks: [],
    },
    isCanceled: false,
  };
}

// 打ち合わせモーダル
function createInitialMeetingForm() {
  return { id: null, type: '着物打ち合わせ', date: '', place: '', note: '' };
}
