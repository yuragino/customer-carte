import { firestore } from "/js/firebase.js";
// --- 設定（必要なら変更） ---
const FIRESTORE_COLLECTION_REGISTRATION = 'reservations'; // 登録保存先
const FIRESTORE_COLLECTION_PRICING = 'pricing'; // 料金マスタ（doc: 'yukata' を期待）
const FIRESTORE_COLLECTION_EVENTS = 'eventDates'; // 年度ごとのイベント日（例: docId: '2025', field: 'fireworksDate'）
const STORAGE_BASE_PATH = 'reservations_images';

document.addEventListener('alpine:init', () => {
  Alpine.data('app', () => ({
    // --- フォームデータ ---
    formData: {
      isJalan: false,
      leaderName: '',
      leaderNameKana: '',
      femaleNum: 1,
      maleNum: 1,
      visitDate: '',
      visitTime: '',
      visitMethod: '',
      address: '',
      tel: '',
      lineType: '',
      selectedRepeaterYears: [],
      notes: '',
    },

    people: [],  // 個人情報配列
    pricing: {
      rentalKitsuke: 0,
      kitsukeOnly: 0,
      bag: 0,
      geta: 0,
    },

    // --- 初期化 ---
    async init() {
      await this.loadPricing();
      await this.loadFireworksDate();
      this.generatePeopleRows();
    },

    // --- リピーター年度を現在年の前年から3年分生成 ---
    get RepeaterYears() {
      const currentYear = new Date().getFullYear();
      return [currentYear - 1, currentYear - 2, currentYear - 3];
    },

    // --- 花火大会日付をFirestoreから取得してvisitDateにセット ---
    async loadFireworksDate() {
      const currentYearStr = new Date().getFullYear().toString();
      const docRef = firestore.collection("eventDates").doc(currentYearStr);
      const doc = await docRef.get();
      this.formData.visitDate = doc.data().fireworksDate;
    },

    // --- 料金設定コレクションを全件取得しpricingDataに格納 ---
    async loadPricing() {
      const docRef = firestore.collection('pricing').doc('yukata');
      const doc = await docRef.get();
      this.pricing = {
        rentalKitsuke: doc.data().rentalKitsuke,
        kitsukeOnly: doc.data().kitsukeOnly,
        bag: doc.data().bag,
        geta: doc.data().geta,
      };
    },

    // --- femaleNum, maleNumからpeople配列を生成 ---
    generatePeopleRows() {
      const totalPeopleCount = Number(this.formData.femaleNum) + Number(this.formData.maleNum);
      const newPeople = [];
      for (let index = 0; index < totalPeopleCount; index++) {
        const gender = index < this.formData.femaleNum ? '女' : '男';
        const existingPerson = this.people[index] || {};
        newPeople.push({
          name: existingPerson.name || '',
          gender: existingPerson.gender || gender,
          type: existingPerson.type || '',
          options: Array.isArray(existingPerson.options) ? [...existingPerson.options] : [],
          imageFile: existingPerson.imageFile || null,
        });
      }
      this.people = newPeople;
    },

    // --- 個人の着付け種別料金（じゃらんの人は前払い）合計 ---
    calcPersonKitsukeTotal(person) {
      return this.pricing[person.type] || 0;
    },

    // --- 個人のオプション料金（じゃらんの人は現地払い）合計 ---
    calcPersonOptionTotal(person) {
      let optionTotal = 0;
      if (Array.isArray(person.options)) {
        person.options.forEach(optionName => {
          optionTotal += this.pricing[optionName] || 0;
        });
      }
      return optionTotal;
    },

    // --- グループ合計---
    calcGroupTotal() {
      let total = 0;
      this.people.forEach((person) => {
        total += this.calcPersonKitsukeTotal(person);
        total += this.calcPersonOptionTotal(person);
      });
      return total;
    },

    // --- グループの前払い料金合計（じゃらん用） ---
    calcGroupJalanPrepaid() {
      let total = 0;
      this.people.forEach(person => {
        total += this.calcPersonKitsukeTotal(person);
      });
      return total;
    },

    // --- グループの現地払い料金合計（じゃらん用） ---
    calcGroupJalanOnSite() {
      let total = 0;
      this.people.forEach(person => {
        total += this.calcPersonOptionTotal(person);
      });
      return total;
    },

    // --- ファイル選択イベント ---
    handleFileUpload(event, index) {
      const selectedFile = event.target.files[0];
      if (selectedFile) {
        this.people[index].imageFile = selectedFile;
      }
    },

    // --- 登録処理 ---
    async submitForm() {
      try {
        // 登録データを構築
        const dataToSave = {
          ...this.formData,
          people: this.people.map(person => ({
            name: person.name,
            gender: person.gender,
            type: person.type,
            options: person.options,
            imageFileName: person.imageFile ? person.imageFile.name : null,
          })),
          groupTotal: this.calcGroupTotal(),
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        };
        await firestore.collection("reservations").add(dataToSave);
        alert("登録が完了しました！");
        this.resetForm();
      } catch (error) {
        console.error("登録エラー:", error);
        alert("登録中にエラーが発生しました。");
      }
    },

    // --- 登録後フォームリセット ---
    resetForm() {
      this.formData.isJalan = false;
      this.formData.leaderName = '';
      this.formData.leaderNameKana = '';
      this.formData.femaleNum = 1;
      this.formData.maleNum = 1;
      this.formData.visitDate = '';
      this.formData.visitTime = '';
      this.formData.visitMethod = '';
      this.formData.address = '';
      this.formData.tel = '';
      this.formData.lineType = '';
      this.formData.selectedRepeaterYears = [];
      this.formData.notes = '';
      this.people = [];
      this.generatePeopleRows();
    },

  }));
});

// cSpell:ignore jalan kitsuke firestore geta yukata