import { firestore } from "./firebase.js";
document.addEventListener('alpine:init', () => {
  Alpine.data('customerForm', () => ({
    // --- 定数 (Constants) ---
    PRICES: {
      RENTAL_DRESSING: 6800,
      DRESSING_ONLY: 3800,
      FOOTWEAR: 500,
      BAG: 500,
    },

    CLOUDINARY_CONFIG: {
      CLOUD_NAME: 'dxq1xqypx',
      UPLOAD_PRESET: 'unsigned_preset',
    },

    // --- ヘッダー関連 ---
    selectedYear: new Date().getFullYear(),
    get yearOptions() {
      const currentYear = new Date().getFullYear();
      return [currentYear, currentYear + 1, currentYear - 1, currentYear - 2, currentYear - 3];
    },
    get repeaterYears() {
      const currentYear = new Date().getFullYear();
      return [currentYear - 1, currentYear - 2, currentYear - 3];
    },

    // --- UIの状態 ---
    isRepresentativeInfoOpen: true,
    isRentalModalOpen: false,

    // --- フォームデータ ---
    representative: {
      reservationMethod: null,
      lastName: '',
      firstName: '',
      lastNameFurigana: '',
      firstNameFurigana: '',
      visitTime: '',
      address: '',
      phone: '',
      transportation: 'car',
      lineType: '椿LINE',
      selectedRepeaterYears: [],
      notes: '',
      checkpoints: {
        yukataRental: false,
        footwearBag: false,
        price: false,
        location: false,
        parking: false
      },
    },
    femaleCount: 1,
    maleCount: 1,
    customers: [], // 顧客詳細データ（人数に応じて動的に生成）

    // --- レンタルモーダル用の一時データ ---
    newRentalItem: { name: '', price: null },
    currentTargetCustomerIndex: null,

    // --- 初期化 ---
    init() {
      this.updateCustomerList();
      this.$watch('femaleCount', () => this.updateCustomerList());
      this.$watch('maleCount', () => this.updateCustomerList());
    },

    // --- 算出プロパティ ---
    get prepayment() {
      // 予約方法が選択されていない場合は前払いなし
      if (!this.representative.reservationMethod) {
        return 0;
      }
      // 各顧客の前払い金額を合計
      return this.customers.reduce((total, customer) => {
        return total + this.calculateCustomerPrepayment(customer);
      }, 0);
    },
    get onSitePayment() {
      // 各顧客の現地払い金額を合計
      return this.customers.reduce((total, customer) => {
        return total + this.calculateCustomerOnSitePayment(customer);
      }, 0);
    },

    // --- メソッド (Methods) ---

    /**
     * 個別顧客の前払い金額を計算
     * @param {object} customer - 顧客オブジェクト
     * @returns {number} 前払い金額
     */
    calculateCustomerPrepayment(customer) {
      if (!this.representative.reservationMethod) return 0;

      if (customer.dressingType === 'rentalAndDressing') {
        return this.PRICES.RENTAL_DRESSING;
      }
      if (customer.dressingType === 'dressingOnly') {
        return this.PRICES.DRESSING_ONLY;
      }
      return 0;
    },

    /**
     * 個別顧客の現地払い金額を計算
     * @param {object} customer - 顧客オブジェクト
     * @returns {number} 現地払い金額
     */
    calculateCustomerOnSitePayment(customer) {
      let total = 0;

      // 予約方法が選択されていない場合、着付け種別料金を現地払いに加算
      if (!this.representative.reservationMethod) {
        if (customer.dressingType === 'rentalAndDressing') {
          total += this.PRICES.RENTAL_DRESSING;
        } else if (customer.dressingType === 'dressingOnly') {
          total += this.PRICES.DRESSING_ONLY;
        }
      }

      // オプション料金を加算
      if (customer.options.footwear) {
        total += this.PRICES.FOOTWEAR;
      }
      if (customer.gender === 'female' && customer.options.obiBag) {
        total += this.PRICES.BAG;
      }

      // 追加レンタル料金を加算
      total += customer.additionalRentals.reduce((sum, item) => sum + (item.price || 0), 0);

      return total;
    },

    toggleRadio(event, modelName) {
      const clickedValue = event.target.value;
      if (this.representative[modelName] === clickedValue) {
        setTimeout(() => {
          this.representative[modelName] = null;
        }, 0);
      } else {
        this.representative[modelName] = clickedValue;
      }
    },

    // 顧客データオブジェクトのテンプレートを作成する
    createCustomerTemplate(gender, id) {
      return {
        id: id,
        gender: gender,
        lastName: '',
        firstName: '',
        bodyShape: null,
        weight: null,
        height: null,
        footSize: null,
        dressingType: 'rentalAndDressing',
        options: {
          footwear: false,
          obiBag: false,
        },
        additionalRentals: [],
        imagePreviews: [], // 画面表示用のプレビューURL
        imageFiles: [],    // アップロード用のFileオブジェクト
      };
    },

    updateCustomerList() {
      const newCustomerList = [];
      const totalCount = this.femaleCount + this.maleCount;

      for (let i = 0; i < totalCount; i++) {
        const gender = i < this.femaleCount ? 'female' : 'male';
        const existingCustomer = this.customers[i];
        if (existingCustomer) {
          existingCustomer.gender = gender;
          newCustomerList.push(existingCustomer);
        } else {
          newCustomerList.push(this.createCustomerTemplate(gender, Date.now() + i));
        }
      }
      this.customers = newCustomerList;
    },

    openRentalModal(customerIndex) {
      this.currentTargetCustomerIndex = customerIndex;
      this.newRentalItem = { name: '', price: null };
      this.isRentalModalOpen = true;
    },

    addRentalItem() {
      if (this.newRentalItem.name && this.newRentalItem.price > 0 && this.currentTargetCustomerIndex !== null) {
        this.customers[this.currentTargetCustomerIndex].additionalRentals.push({ ...this.newRentalItem });
        this.isRentalModalOpen = false;
      }
    },

    removeRentalItem(customerIndex, itemIndex) {
      this.customers[customerIndex].additionalRentals.splice(itemIndex, 1);
    },

    /**
         * 画像選択時の処理。プレビューURLとFileオブジェクトの両方を保存する
         */
    handleImageUpload(event, customerIndex) {
      const files = event.target.files;
      if (!files) return;

      // 既存のプレビューURLを解放
      this.customers[customerIndex].imagePreviews.forEach(url => URL.revokeObjectURL(url));

      const newPreviews = [];
      const newFiles = []; // Fileオブジェクトを格納する配列
      for (const file of files) {
        newPreviews.push(URL.createObjectURL(file));
        newFiles.push(file); // Fileオブジェクトを保存
      }
      this.customers[customerIndex].imagePreviews = newPreviews;
      this.customers[customerIndex].imageFiles = newFiles; // Fileオブジェクトをstateに保存
    },

    /**
        * Cloudinaryに画像をアップロードする
        * @param {File} file - アップロードするファイル
        * @param {string} folderName - 保存先のフォルダ名
        * @returns {Promise<string>} アップロードされた画像のURL
        */
    async uploadImageToCloudinary(file, folderName) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', this.CLOUDINARY_CONFIG.UPLOAD_PRESET);
      formData.append('folder', folderName);

      const url = `https://api.cloudinary.com/v1_1/${this.CLOUDINARY_CONFIG.CLOUD_NAME}/image/upload`;

      const response = await fetch(url, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Cloudinaryへの画像アップロードに失敗しました。');
      }

      const data = await response.json();
      return data.secure_url;
    },

    /**
     * フォーム全体のデータを送信する
     */
    async submitForm() {
      try {
        // 1. 動的な名前を決定
        const folderName = `${this.selectedYear}_fireworks`;
        const collectionName = `${this.selectedYear}_fireworks`;

        // 2. 顧客データ内の画像URLを準備
        const processedCustomers = await Promise.all(this.customers.map(async (customer) => {
          const imageUrls = await Promise.all(
            customer.imageFiles.map(file => this.uploadImageToCloudinary(file, folderName))
          );

          // Firestoreに保存する用の新しい顧客オブジェクトを作成
          const customerData = { ...customer };
          delete customerData.imageFiles; // Fileオブジェクトは不要なので削除
          delete customerData.imagePreviews; // プレビューURLも不要なので削除
          customerData.imageUrls = imageUrls; // CloudinaryのURLを追加

          return customerData;
        }));

        // 3. Firestoreに保存する最終的なデータを作成
        const dataToSave = {
          isCanceled: this.isCanceled,
          representative: this.representative,
          customers: processedCustomers,
          femaleCount: this.femaleCount,
          maleCount: this.maleCount,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        };

        // 4. Firestoreにデータを追加 (ドキュメントIDは自動生成)
        await firestore.collection(collectionName).add(dataToSave);

        // 5. 成功アラートを表示
        alert('登録が完了しました。');

        // 必要であればフォームをリセットする処理をここに追加
        // window.location.reload(); 

      } catch (error) {
        console.error("登録エラー: ", error);
        alert(`登録中にエラーが発生しました。\n${error.message}`);
      }
    }
  }));
});

// cspell:ignore Furigana Firestore