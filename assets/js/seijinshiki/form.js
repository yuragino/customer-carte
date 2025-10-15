import { doc, getDoc, collection, addDoc, updateDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { db } from '../common/firebase-config.js';
import { SEIJINSHIKI_PRICES, OUTFIT_KEY_MAP } from '../common/constants.js';
import { getYearSettings } from "../common/year-selector.js";
import { uploadMediaArrayToCloudinary } from '../common/form-utils.js';
import { formatFullDateTime, formatYen } from "../common/utils.js";
document.addEventListener('alpine:init', () => {
  Alpine.data('app', () => ({
    ...getYearSettings(),
    formatFullDateTime,
    formatYen,
    // ===== 状態管理 =====
    currentCustomerId: null,
    isSubmitting: false,

    // --- フォーム全体のデータ ---
    formData: createInitialFormData(),

    // --- メディアファイル管理 ---
    newImageFiles: [],
    newVideoFiles: [],
    newImagePreviews: [],
    newVideoPreviews: [],

    // --- 打ち合わせモーダル用 ---
    meetingModalVisible: false,
    meetingForm: createInitialMeetingForm(),
    meetingEditId: null, // 編集中のmeetingのID

    get collectionName() {
      return `${this.selectedYear}_seijinshiki`;
    },
    get docRef() {
      return doc(db, this.collectionName, this.currentCustomerId);
    },
    get totalAmount() {
      const { kitsuke, hair, options } = this.formData.estimateItems;
      const base = this.calcPrice(kitsuke) + this.calcPrice(hair);
      const opt = options.reduce((s, o) => s + (o.price || 0), 0);
      return base + opt;
    },
    get sortedMeetings() {
      return [...this.formData.meetings].sort((a, b) => new Date(a.date) - new Date(b.date));
    },

    // ===== 初期化処理 =====
    async init() {
      const params = new URLSearchParams(window.location.search);
      this.initYearSelector();
      this.currentCustomerId = params.get('customer');
      if (this.currentCustomerId) await this.loadFormData();
    },

    // ===== データ読み込み・保存 =====
    async loadFormData() {
      try {
        const docSnap = await getDoc(this.docRef);
        if (docSnap.exists()) {
          this.formData = docSnap.data();
        } else {
          alert('指定されたデータが見つかりませんでした。');
          this.currentCustomerId = null;
        }
      } catch (error) {
        console.error("データ取得エラー:", error);
        alert('データの読み込みに失敗しました。');
      }
    },

    async submitForm() {
      this.isSubmitting = true;
      try {
        // Cloudinaryにメディアをアップロード
        const newImageUrls = await uploadMediaArrayToCloudinary(this.newImageFiles, this.collectionName);
        const newVideoUrls = await uploadMediaArrayToCloudinary(this.newVideoFiles, this.collectionName);
        // 保存するデータオブジェクトを作成
        const dataToSave = {
          ...this.formData,
          imageUrls: [...this.formData.imageUrls, ...newImageUrls],
          videoUrls: [...this.formData.videoUrls, ...newVideoUrls],
          updatedAt: serverTimestamp(),
        };
        const collectionRef = collection(db, this.collectionName);
        if (this.currentCustomerId) {
          // 更新
          await updateDoc(this.docRef, {
            ...dataToSave,
            updatedAt: serverTimestamp(),
          });
          alert('更新が完了しました。');
        } else {
          // 新規
          await addDoc(collectionRef, {
            ...dataToSave,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          alert('登録が完了しました。');
          window.location.href = `./index.html?year=${this.selectedYear}`;
        }
      } catch (error) {
        console.error("登録エラー: ", error);
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
        console.error("削除エラー:", error);
        alert(`削除中にエラーが発生しました。\n${error.message}`);
      }
    },

    // ===== 打ち合わせ・お預かり =====
    openMeetingModal(meeting = null) {
      // 編集時はデータをコピー、追加時は初期フォーム
      this.meetingForm = meeting ? { ...meeting } : createInitialMeetingForm();
      this.meetingEditId = meeting?.id || null;
      this.meetingModalVisible = true;
    },
    closeMeetingModal() {
      this.meetingModalVisible = false;
    },
    saveMeeting() {
      if (!this.meetingForm.date) {
        alert('日時を入力してください。');
        return;
      }
      const id = this.meetingEditId || Date.now();  // ← ここで生成または既存idを使う！
      const index = this.formData.meetings.findIndex(m => m.id === id);
      const meeting = { ...this.meetingForm, id };
      if (index >= 0) {
        this.formData.meetings.splice(index, 1, meeting);
      } else {
        this.formData.meetings.push(meeting);
      }
      this.closeMeetingModal();
    },
    deleteMeeting(meeting) {
      if (!confirm('この項目を削除しますか？')) return;
      this.formData.meetings = this.formData.meetings.filter(m => m.id !== meeting.id);
    },

    // ===== 見積もり =====
    addOption() {
      this.formData.estimateItems.options.push({
        name: '',
        fixed: false,
        toujitsu: false,
        maedori: false,
        price: 0,
      });
    },
    deleteOption(index) {
      if (confirm("このオプションを削除しますか？")) {
        this.formData.estimateItems.options.splice(index, 1);
      }
    },
    calcPrice(item) {
      const { outfit } = this.formData.basic;
      const outfitKey = OUTFIT_KEY_MAP[outfit];
      const priceTable = SEIJINSHIKI_PRICES[outfitKey];
      const hasToujitsu = item.toujitsu;
      const hasMaedori = item.maedori;
      const both = hasToujitsu && hasMaedori;
      if (item.name === "着付") {
        if (outfitKey === "FURISODE") {
          const kitsuke = priceTable.KITSUKE;
          if (both) return kitsuke.BOTH;
          if (hasToujitsu) return kitsuke.TOUJITSU;
          if (hasMaedori) return kitsuke.MAEDORI;
        } else if (outfitKey === "HAKAMA") {
          return hasToujitsu ? priceTable.KITSUKE : 0;
        }
      }
      if (item.name === "ヘア") {
        if (outfitKey !== "FURISODE") return 0;
        let price = 0;
        if (item.option === "ヘア＆メイク") price = priceTable.HAIR_MAKE;
        else if (item.option === "ヘアのみ") price = priceTable.HAIR_ONLY;
        return (hasToujitsu + hasMaedori) * price;
      }
      return 0;
    },

    // ===== メディア処理 =====
    handleImageUpload(event) {
      this.newImageFiles = [...event.target.files];
      this.newImagePreviews = this.newImageFiles.map(file => URL.createObjectURL(file));
      event.target.value = '';
    },
    handleVideoUpload(event) {
      this.newVideoFiles = [...event.target.files];
      this.newVideoPreviews = this.newVideoFiles.map(file => URL.createObjectURL(file));
      event.target.value = '';
    },
    removeMedia(type, index) {
      if (confirm('このメディアを削除しますか？')) {
        if (type === 'image') this.formData.imageUrls.splice(index, 1);
        if (type === 'video') this.formData.videoUrls.splice(index, 1);
      }
    },

    // ===== ユーティリティ =====
    swapSchedule() {
      // 当日スケジュール：ヘアメイクと着付の順序を入れ替える
      const schedule = this.formData.toujitsu.schedule;
      [schedule[0], schedule[1]] = [schedule[1], schedule[0]];
    },

  }));
});

function createInitialFormData() {
  return {
    basic: {
      reservationDate: '',
      name: '', kana: '', introducer: '', phone: '', address: '',
      lineType: '教室LINE', height: null, footSize: null, outfit: '振袖',
      rentalType: '自前', outfitMemo: '', hairMakeStaff: ''
    },
    toujitsu: {
      schedule: [
        { id: 1, type: 'hair', start: '', end: '' },
        { id: 2, type: 'kitsuke', start: '', end: '' }
      ],
      note: ''
    },
    meetings: [],
    maedoriStatus: 'あり',
    maedori: {
      type: 'スタジオ', camera: '', date: '', hairStart: '', hairEnd: '',
      kitsukeStart: '', kitsukeEnd: '', shootStart: '', shootEnd: '',
      place: '', note: ''
    },
    estimateItems: {
      kitsuke: { name: "着付", fixed: true, toujitsu: true, maedori: false },
      hair: { name: "ヘア", fixed: true, toujitsu: true, maedori: false, option: "ヘア＆メイク" },
      options: [],
    },
    estimate: { receiptDate: '' },
    imageUrls: [],
    videoUrls: [],
    isCanceled: false,
  };
}

// 打ち合わせモーダル
function createInitialMeetingForm() {
  return { id: null, type: '打ち合わせ', date: '', place: '', note: '' };
}
