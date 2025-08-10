import { firestore } from "/js/firebase.js";
// --- 設定（必要なら変更） ---
const FIRESTORE_COLLECTION_REGISTRATION = 'reservations'; // 登録保存先
const FIRESTORE_COLLECTION_PRICING = 'pricing'; // 料金マスタ（doc: 'default' を期待）
const FIRESTORE_COLLECTION_EVENTS = 'eventDates'; // 年度ごとのイベント日（例: docId: '2025', field: 'fireworksDate'）
const STORAGE_BASE_PATH = 'reservations_images';

document.addEventListener('alpine:init', () => {
  Alpine.data('app', () => ({
    // --- フォームデータ ---
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
    repeaterYears: [],
    selectedRepeaterYears: [],
    notes: '',
    people: [],  // 個人情報配列
    pricingData: {},

    // --- 初期化 ---
    async init() {
      await this.loadPricingSettings();
      await this.loadFireworksDate();
      this.generatePeopleRows();

      // 変更監視
      this.$watch('femaleNum', () => this.generatePeopleRows());
      this.$watch('maleNum', () => this.generatePeopleRows());
      this.$watch('leaderName', (newValue) => {
        this.leaderNameKana = this.convertToKana(newValue);
      });
    },

    // --- リピーター年度を現在年の前年から3年分生成 ---
    get RepeaterYears() {
      const currentYear = new Date().getFullYear();
      return [currentYear - 1, currentYear - 2, currentYear - 3];
    },

    // --- 花火大会日付をFirestoreから取得してvisitDateにセット ---
    async loadFireworksDate() {
      try {
        const currentYearStr = String(new Date().getFullYear());
        const docRef = firestore.collection("fireworks_events").doc(currentYearStr);
        const docSnapshot = await docRef.get();
        if (docSnapshot.exists) {
          const data = docSnapshot.data();
          if (data && data.date) {
            this.visitDate = data.date;
          }
        }
      } catch (error) {
        console.error("花火大会日付取得エラー:", error);
      }
    },

    // --- 料金設定コレクションを全件取得しpricingDataに格納 ---
    async loadPricingSettings() {
      try {
        const pricingCollectionRef = firestore.collection("pricing_settings");
        const querySnapshot = await pricingCollectionRef.get();
        querySnapshot.forEach((docSnapshot) => {
          const pricingId = docSnapshot.id;
          const pricingDocData = docSnapshot.data();
          this.pricingData[pricingId] = pricingDocData;
        });
      } catch (error) {
        console.error("料金設定取得エラー:", error);
      }
    },

    // --- femaleNum, maleNumからpeople配列を生成 ---
    generatePeopleRows() {
      const totalCount = Number(this.femaleNum) + Number(this.maleNum);
      const newPeople = [];
      for (let index = 0; index < totalCount; index++) {
        const gender = index < this.femaleNum ? '女' : '男';
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

    // --- 個人の合計金額計算 ---
    calcPersonTotal(person) {
      let totalPrice = 0;
      if (person.type && this.pricingData[person.type]) {
        totalPrice += this.pricingData[person.type].price || 0;
      }
      if (Array.isArray(person.options)) {
        person.options.forEach((optionName) => {
          if (this.pricingData[optionName]) {
            totalPrice += this.pricingData[optionName].price || 0;
          }
        });
      }
      if (this.isJalan) {
        totalPrice = 0; // Jalan予約は前払い扱いのため0円
      }
      return totalPrice;
    },

    // --- グループ合計 ---
    calcGroupTotal() {
      let totalGroupPrice = 0;
      this.people.forEach((person) => {
        totalGroupPrice += this.calcPersonTotal(person);
      });
      return totalGroupPrice;
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
          isJalan: this.isJalan,
          leaderName: this.leaderName,
          leaderNameKana: this.leaderNameKana || this.convertToKana(this.leaderName),
          femaleNum: this.femaleNum,
          maleNum: this.maleNum,
          visitDate: this.visitDate,
          visitTime: this.visitTime,
          visitMethod: this.visitMethod,
          address: this.address,
          tel: this.tel,
          lineType: this.lineType,
          selectedRepeaterYears: this.selectedRepeaterYears,
          notes: this.notes,
          people: this.people.map((person) => ({
            name: person.name,
            gender: person.gender,
            type: person.type,
            options: person.options,
            imageFileName: person.imageFile ? person.imageFile.name : null,
          })),
          groupTotal: this.calcGroupTotal(),
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        // Firestoreに登録
        const reservationsCollectionRef = firestore.collection("reservations");
        await reservationsCollectionRef.add(dataToSave);

        alert("登録が完了しました！");
        this.resetForm();
      } catch (error) {
        console.error("登録エラー:", error);
        alert("登録中にエラーが発生しました。");
      }
    },

    // --- 登録後フォームリセット ---
    resetForm() {
      this.isJalan = false;
      this.leaderName = '';
      this.leaderNameKana = '';
      this.femaleNum = 1;
      this.maleNum = 1;
      this.visitDate = '';
      this.visitTime = '';
      this.visitMethod = '';
      this.address = '';
      this.tel = '';
      this.lineType = '';
      this.selectedRepeaterYears = [];
      this.notes = '';
      this.people = [];
      this.generatePeopleRows();
    }
  }));
});

// cSpell:ignore jalan kitsuke firestore