import { firestore } from "./firebase.js";
const FIRESTORE_COLLECTION_REGISTRATION = 'reservations';
const FIRESTORE_COLLECTION_PRICING = 'pricing';
const FIRESTORE_COLLECTION_EVENTS = 'eventDates';
document.addEventListener('alpine:init', () => {
  Alpine.data('app', () => ({
    isEdit: false,
    editDocId: null,
    // --- フォームデータ ---
    formData: {
      isPrepaid: false,
      reservationMethod: [],
      leaderName: '',
      leaderNameKana: '',
      femaleNum: 1,
      maleNum: 1,
      visitDate: '',
      visitTime: '',
      transportMethod: '',
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

    cloudinary: {
      cloudName: 'dxq1xqypx',
      uploadPreset: 'unsigned_preset',
      apiUrl: '',
    },

    updateIsPrepaid() {
      this.formData.isPrepaid = this.formData.reservationMethod.some(method =>
        method.startsWith('じゃらん') || method === 'アソビュー'
      );
    },

    // --- 初期化 ---
    async init() {
      this.cloudinary.apiUrl = `https://api.cloudinary.com/v1_1/${this.cloudinary.cloudName}/upload`;
      await this.loadPricing();
      await this.loadFireworksDate();
      const params = new URLSearchParams(window.location.search);
      const groupId = params.get('group');
      if (groupId) {
        this.isEdit = true;
        this.editDocId = groupId;
        await this.loadReservationData(groupId);
      }
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

    // 編集モード：既存データ読み込み
    async loadReservationData(docId) {
      const docRef = firestore.collection(FIRESTORE_COLLECTION_REGISTRATION).doc(docId);
      const doc = await docRef.get();
      if (doc.exists) {
        const data = doc.data();
        this.formData = { ...this.formData, ...data };
        this.people = data.people || [];
      }
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
          weight: existingPerson.weight || null,
          clothingSize: existingPerson.clothingSize || '',
          height: existingPerson.height || '',
          footSize: existingPerson.footSize || '',
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

    // ファイル選択時はファイルオブジェクトを保持するだけにする
    handleFileUpload(event, index) {
      const file = event.target.files[0];
      if (!file) return;
      this.people[index].imageFile = file;
      this.people[index].imageUrl = ''; // 初期化
    },

    // 登録ボタン押した時の処理（submitForm）をasyncにして画像アップロードを待つ
    async submitForm() {
      try {
        // 画像アップロード処理を並列実行し、結果をpeopleのimageUrlにセット
        await Promise.all(this.people.map(async (person, index) => {
          if (person.imageFile) {
            const formData = new FormData();
            formData.append('file', person.imageFile);
            formData.append('upload_preset', this.cloudinary.uploadPreset);

            const res = await fetch(this.cloudinary.apiUrl, {
              method: 'POST',
              body: formData,
            });
            const data = await res.json();
            if (data.error) {
              throw new Error(`画像アップロード失敗: ${data.error.message}`);
            }
            this.people[index].imageUrl = data.secure_url;
          }
        }));

        // 画像アップロードが完了した後Firestoreに保存
        const dataToSave = {
          ...this.formData,
          people: this.people.map(person => ({
            name: person.name,
            gender: person.gender,
            weight: person.weight,
            clothingSize: person.clothingSize,
            height: person.height,
            footSize: person.footSize,
            type: person.type,
            options: person.options,
            imageFileName: person.imageFile ? person.imageFile.name : null,
            imageUrl: person.imageUrl || null,
          })),
          groupTotal: this.calcGroupTotal(),
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        };
        if (this.formData.isPrepaid) {
          dataToSave.jalanPrepaidTotal = this.calcGroupJalanPrepaid();
          dataToSave.jalanOnSiteTotal = this.calcGroupJalanOnSite();
        }

        if (this.isEdit && this.editDocId) {
          await firestore.collection("reservations").doc(this.editDocId).update(dataToSave);
          alert("更新が完了しました！");
        } else {
          dataToSave.createdAt = firebase.firestore.FieldValue.serverTimestamp();
          await firestore.collection("reservations").add(dataToSave);
          alert("登録が完了しました！");
          this.resetForm();
        }
      } catch (error) {
        console.error("登録エラー:", error);
        alert(error.message || "登録中にエラーが発生しました。");
      }
    },


    // --- 登録後フォームリセット ---
    resetForm() {
      this.formData = {
        isPrepaid: false,
        leaderName: '',
        leaderNameKana: '',
        femaleNum: 1,
        maleNum: 1,
        visitDate: '',
        visitTime: '',
        transportMethod: '',
        address: '',
        tel: '',
        lineType: '',
        selectedRepeaterYears: [],
        notes: '',
      };
      this.people = [];
      this.generatePeopleRows();
    },

  }));
});

// cSpell:ignore jalan kitsuke firestore geta yukata