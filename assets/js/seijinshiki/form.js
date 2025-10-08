import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getFirestore, doc, getDoc, collection, addDoc, updateDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

// ----- FirebaseとCloudinaryの設定 -----
const firebaseConfig = {
  apiKey: "AIzaSyBOMtAoCObyoalTk6_nVpGlsnLcGSw4Jzc",
  authDomain: "kimono-coordinate.firebaseapp.com",
  databaseURL: "https://kimono-coordinate-default-rtdb.firebaseio.com",
  projectId: "kimono-coordinate",
  storageBucket: "kimono-coordinate.firebasestorage.app",
  messagingSenderId: "399031825104",
  appId: "1:399031825104:web:5ea4da3fb129cf935724d5",
  measurementId: "G-VVTT0QVXQQ"
};

const CLOUDINARY_CONFIG = {
  CLOUD_NAME: 'dxq1xqypx', // あなたのCloudinaryクラウド名
  UPLOAD_PRESET: 'unsigned_preset', // あなたのアップロードプリセット名
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ----- 定数定義 -----
const PRICE = {
  FURISODE: {
    KITSUKE: { MAEDORI: 13200, TOUJITSU: 16500, BOTH: 25300 },
    HAIR_MAKE: 10000,
    HAIR_ONLY: 6000,
  },
  HAKAMA: { KITSUKE: 8500 }
};

// ----- Alpine.jsコンポーネント -----
document.addEventListener('alpine:init', () => {
  Alpine.data('app', () => ({
    // ===== 状態管理 =====
    selectedYear: new Date().getFullYear(),
    currentCustomerId: null, // 編集中のドキュメントID
    isSubmitting: false,  // フォーム送信中フラグ

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

    // ===== 初期化処理 =====
    async init() {
      const params = new URLSearchParams(window.location.search);
      this.selectedYear = parseInt(params.get('year')) || new Date().getFullYear();
      this.currentCustomerId = params.get('customer');

      if (this.currentCustomerId) {
        await this.loadFormData(this.currentCustomerId);
      }
    },

    // ===== ヘッダー =====
    get yearOptions() {
      const currentYear = new Date().getFullYear();
      return [currentYear + 1, currentYear, currentYear - 1, currentYear - 2];
    },

    // ===== データ読み込み・保存 =====
    async loadFormData(customerId) {
      try {
        const collectionName = `${this.selectedYear}_seijinshiki`;
        const docRef = doc(db, collectionName, customerId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const loadedData = docSnap.data();
          // 読み込んだデータでformDataを更新。デフォルト値とマージして項目不足を防ぐ
          this.formData = deepMerge(createInitialFormData(), loadedData);
        } else {
          alert('指定されたデータが見つかりませんでした。');
          this.currentCustomerId = null;
        }
      } catch (error) {
        console.error("データ取得エラー: ", error);
        alert('データの読み込みに失敗しました。');
      }
    },

    async submitForm() {
      if (!this.formData.basic.name) {
        alert('お客様の名前は必須です。');
        return;
      }
      this.isSubmitting = true;

      try {
        this.formData.estimateItems.forEach(item => {
          if (item.name === "着付") {
            item.price = this.calcPrice(item);
          }
          if (item.name === "ヘア") {
            item.price = this.calcPrice(item);
            if (item.option === "hairMake") {
              item.name = "ヘア&メイク";
            } else if (item.option === "hairOnly") {
              item.name = "ヘアのみ";
            } else {
              item.name = "ヘア&メイクなし"; // オプションがない場合
              item.price = 0; // 金額も0に
            }
          }
        });
        const folderName = `${this.selectedYear}_seijinshiki`;
        const tags = [this.formData.basic.name]; // タグとしてお客様の名前を使用

        // 1. 新しい画像をCloudinaryにアップロード
        const newImageUrls = await Promise.all(
          this.newImageFiles.map(file => this.uploadMediaToCloudinary(file, folderName, tags))
        );
        // 2. 新しい動画をCloudinaryにアップロード
        const newVideoUrls = await Promise.all(
          this.newVideoFiles.map(file => this.uploadMediaToCloudinary(file, folderName, tags))
        );

        // 3. 保存するデータオブジェクトを作成
        const dataToSave = JSON.parse(JSON.stringify(this.formData)); // ディープコピー
        dataToSave.imageUrls.push(...newImageUrls);
        dataToSave.videoUrls.push(...newVideoUrls);
        dataToSave.updatedAt = serverTimestamp();

        const collectionName = `${this.selectedYear}_seijinshiki`;

        if (this.currentCustomerId) {
          // 更新処理
          const docRef = doc(db, collectionName, this.currentCustomerId);
          await updateDoc(docRef, dataToSave);
          alert('カルテを更新しました。');
        } else {
          // 新規作成処理
          dataToSave.createdAt = serverTimestamp();
          await addDoc(collection(db, collectionName), dataToSave);
          window.location.href = `./index.html?year=${this.selectedYear}`;
        }
      } catch (error) {
        console.error("保存エラー: ", error);
        alert(`保存中にエラーが発生しました。\n${error.message}`);
      } finally {
        this.isSubmitting = false;
      }
    },

    async deleteForm() {
      if (!confirm('本当にこのカルテを削除しますか？\nこの操作は元に戻せません。')) return;

      this.isSubmitting = true;
      try {
        const collectionName = `${this.selectedYear}_seijinshiki`;
        await deleteDoc(doc(db, collectionName, this.currentCustomerId));
        alert('カルテを削除しました。');
        window.location.href = `./index.html?year=${this.selectedYear}`;
      } catch (error) {
        console.error("削除エラー: ", error);
        alert(`削除中にエラーが発生しました。\n${error.message}`);
      } finally {
        this.isSubmitting = false;
      }
    },

    // ===== 打ち合わせ・お預かり =====
    get sortedMeetings() {
      return [...this.formData.meetings].sort((a, b) => new Date(a.date) - new Date(b.date));
    },
    openMeetingModal() {
      this.meetingForm = createInitialMeetingForm();
      this.meetingEditId = null;
      this.meetingModalVisible = true;
    },
    closeMeetingModal() {
      this.meetingModalVisible = false;
    },
    editMeeting(meeting) {
      this.meetingForm = { ...meeting };
      this.meetingEditId = meeting.id;
      this.meetingModalVisible = true;
    },
    saveMeeting() {
      if (!this.meetingForm.date) {
        alert('日時を入力してください。');
        return;
      }
      if (this.meetingEditId) {
        const index = this.formData.meetings.findIndex(m => m.id === this.meetingEditId);
        if (index !== -1) {
          this.formData.meetings[index] = { ...this.meetingForm };
        }
      } else {
        this.formData.meetings.push({ ...this.meetingForm, id: Date.now() });
      }
      this.closeMeetingModal();
    },
    deleteMeeting(meetingToDelete) {
      if (confirm('この項目を削除しますか？')) {
        this.formData.meetings = this.formData.meetings.filter(m => m.id !== meetingToDelete.id);
      }
    },

    // ===== 見積もり =====
    addOption() {
      this.formData.estimateItems.push({ name: "", fixed: false, toujitsu: false, maedori: false, price: 0 });
    },
    calcPrice(item) {
      const outfit = this.formData.basic.outfit;
      if (item.name === "着付") {
        if (outfit === "振袖") {
          if (item.toujitsu && item.maedori) return PRICE.FURISODE.KITSUKE.BOTH;
          if (item.toujitsu) return PRICE.FURISODE.KITSUKE.TOUJITSU;
          if (item.maedori) return PRICE.FURISODE.KITSUKE.MAEDORI;
        } else if (outfit === "袴") {
          return item.toujitsu ? PRICE.HAKAMA.KITSUKE : 0;
        }
      }
      if (item.name === "ヘア" && outfit === "振袖") {
        if (item.option === "hairMake") {
          if (item.toujitsu && item.maedori) return PRICE.FURISODE.HAIR_MAKE * 2;
          if (item.toujitsu) return PRICE.FURISODE.HAIR_MAKE;
          if (item.maedori) return PRICE.FURISODE.HAIR_MAKE;
        } else if (item.option === "hairOnly") {
          if (item.toujitsu && item.maedori) return PRICE.FURISODE.HAIR_ONLY * 2;
          if (item.toujitsu) return PRICE.FURISODE.HAIR_ONLY;
          if (item.maedori) return PRICE.FURISODE.HAIR_ONLY;
        }
      }
      return (item.toujitsu || item.maedori) ? (item.price || 0) : 0;
    },
    get totalAmount() {
      if (!this.formData.estimateItems) return 0;
      return this.formData.estimateItems.reduce((sum, item) => sum + this.calcPrice(item), 0);
    },

    // ===== メディア処理 =====
    handleImageUpload(event) {
      this.newImageFiles = [...event.target.files];
      this.newImagePreviews = this.newImageFiles.map(file => URL.createObjectURL(file));
      event.target.value = ''; // 同じファイルを選択できるようにリセット
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
    async uploadMediaToCloudinary(file, folderName, tags = []) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', CLOUDINARY_CONFIG.UPLOAD_PRESET);
      formData.append('folder', folderName);
      formData.append('tags', tags.join(','));

      const resourceType = file.type.startsWith('image/') ? 'image' : 'video';
      const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.CLOUD_NAME}/${resourceType}/upload`;

      const response = await fetch(url, { method: 'POST', body: formData });
      if (!response.ok) throw new Error('Cloudinaryへのアップロードに失敗しました。');

      const data = await response.json();
      return data.secure_url;
    },

    // ===== ユーティリティ =====
    swapSchedule() {
      const schedule = this.formData.toujitsu.schedule;
      if (schedule.length === 2) {
        // 配列の要素を入れ替える
        [schedule[0], schedule[1]] = [schedule[1], schedule[0]];
      }
    },
    formatDisplayDate(dateStr) {
      if (!dateStr) return '';
      const dt = new Date(dateStr);
      const day = ["日", "月", "火", "水", "木", "金", "土"][dt.getDay()];
      return `${dt.getFullYear()}/${String(dt.getMonth() + 1).padStart(2, "0")}/${String(dt.getDate()).padStart(2, "0")}(${day}) ${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
    },
    formatYen(value) {
      if (typeof value !== 'number' || isNaN(value)) return "—";
      return value.toLocaleString('ja-JP') + "円";
    },
  }));
});

// ===== ヘルパー関数 =====

/**
 * フォームの初期データ構造を生成する関数
 */
function createInitialFormData() {
  return {
    // 基本情報
    basic: {
      reservationDate: new Date().toISOString().slice(0, 10),
      name: '', kana: '', introducer: '', phone: '', address: '',
      lineType: '教室LINE', height: null, footSize: null, outfit: '振袖',
      rentalType: '自前', outfitMemo: '', hairMakeStaff: ''
    },
    // 当日スケジュール
    toujitsu: {
      schedule: [
        { id: 1, type: 'hair', start: '', end: '' },
        { id: 2, type: 'kitsuke', start: '', end: '' }
      ],
      note: ''
    },
    // 打ち合わせ・お預かり
    meetings: [],
    // 前撮り情報
    maedoriStatus: 'あり',
    maedori: {
      type: 'スタジオ', camera: '', date: '', hairStart: '', hairEnd: '',
      kitsukeStart: '', kitsukeEnd: '', shootStart: '', shootEnd: '',
      place: '', note: ''
    },
    // 見積もり情報
    estimateItems: [
      { name: "着付", fixed: true, toujitsu: true, maedori: false },
      { name: "ヘア", fixed: true, toujitsu: true, maedori: false, option: "hairMake" }
    ],
    estimate: { receiptDate: '' },
    // メディアURL
    imageUrls: [],
    videoUrls: [],
    // その他
    isCanceled: false,
    createdAt: null,
    updatedAt: null,
  };
}

/**
 * 打ち合わせモーダルの初期データ
 */
function createInitialMeetingForm() {
  return { id: null, type: '打ち合わせ', date: '', place: '', note: '' };
}

/**
 * オブジェクトを再帰的にマージするヘルパー関数
 * @param {object} target マージ先のオブジェクト
 * @param {object} source マージ元のオブジェクト
 * @returns {object} マージ後のオブジェクト
 */
function deepMerge(target, source) {
  const output = { ...target };
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key])) {
        if (!(key in target))
          Object.assign(output, { [key]: source[key] });
        else
          output[key] = deepMerge(target[key], source[key]);
      } else {
        Object.assign(output, { [key]: source[key] });
      }
    });
  }
  return output;
}
function isObject(item) {
  return (item && typeof item === 'object' && !Array.isArray(item));
}
