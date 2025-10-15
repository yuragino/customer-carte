import { doc, getDoc, collection, addDoc, updateDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { db } from '../common/firebase-config.js';
import { CASUAL_PRICES } from '../common/constants.js';
import { formatYen } from "../common/utils.js";
import { uploadMediaToCloudinary } from "../common/form-utils.js";
const COLLECTION_NAME = 'machiaruki';

document.addEventListener('alpine:init', () => {
  Alpine.data('App', () => ({
    formatYen,
    // --- UIの状態 ---
    isRepresentativeInfoOpen: true,
    isRentalModalOpen: false,
    isDiscountModalOpen: false,
    isSubmitting: false,  // フォーム送信中フラグ

    // --- フォームデータ ---
    representative: {
      reservationMethod: null,
      name: '',
      kana: '',
      visitDateTime: '',
      finishTime: '',
      returnTime: '',
      address: '',
      phone: '',
      transportation: '車',
      lineType: '椿LINE',
      notes: '',
      checkpoints: {
        rentalPage: false,
        footwearBag: false,
        price: false,
        location: false,
        parking: false
      },
      paymentType: 'group',
      groupPaymentMethod: '',
      isCanceled: false,
    },
    femaleCount: 1,
    maleCount: 1,
    customers: [], // 顧客詳細データ（人数に応じて動的に生成）

    // --- 編集モードのためのプロパティ ---
    currentGroupId: null,

    // --- レンタルモーダル用の一時データ ---
    newRentalItem: { name: '', price: null },
    currentTargetCustomerIndex: null,

    // 金額修正モーダル用
    discountTargetIndex: null,
    modalOriginalPrice: 0,
    discountInput: 0,
    discountMemoInput: '',
    modalAdjustedPrice: 0,

    openDiscountModal(index) {
      const customer = this.customers[index];
      this.discountTargetIndex = index;
      this.modalOriginalPrice = this.calculateCustomerOnSitePayment(customer);
      this.discountInput = customer.discountAmount || 0;
      this.discountMemoInput = customer.discountMemo || '';
      this.modalAdjustedPrice = this.modalOriginalPrice - this.discountInput;
      this.isDiscountModalOpen = true;
    },

    // 入力した値引き金額を適用
    applyDiscount() {
      const customer = this.customers[this.discountTargetIndex];
      customer.discountAmount = this.discountInput;
      customer.discountMemo = this.discountMemoInput;
      this.isDiscountModalOpen = false;
    },

    // --- 初期化 ---
    async init() {
      const params = new URLSearchParams(window.location.search);
      const groupId = params.get('group');
      this.currentGroupId = groupId;

      if (groupId) {
        // 編集モード：既存データを読み込む
        await this.loadData(groupId);
      } else {
        // 新規登録モード：初期データを設定
        this.updateCustomerList();
      }
      this.$watch('femaleCount', () => this.updateCustomerList());
      this.$watch('maleCount', () => this.updateCustomerList());
    },

    // --- Firestoreからデータを取得し、フォームに反映させるメソッド ---
    async loadData(groupId) {
      try {
        const docRef = doc(db, COLLECTION_NAME, groupId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();

          // 代表者情報を反映
          this.representative = {
            ...this.representative,
            ...data.representative,
            finishTime: data.representative?.finishTime || '',
            returnTime: data.representative?.returnTime || ''
          };
          this.femaleCount = data.femaleCount;
          this.maleCount = data.maleCount;

          // 顧客情報を反映
          // 画像URLをプレビュー用に変換する
          const customersWithPreviews = data.customers.map(customer => ({
            ...customer,
            // 既存の画像はプレビューURLとして設定
            imagePreviews: customer.imageUrls || [],
            imageFiles: [] // 編集時に新しい画像がアップロードされるまで空
          }));

          this.customers = customersWithPreviews;
          // UI状態を更新（代表者情報を開いておく）
          this.isRepresentativeInfoOpen = true;

        } else {
          alert('指定されたドキュメントが見つかりませんでした。');
          console.error("No such document!");
        }

      } catch (error) {
        console.error("データ取得エラー: ", error);
        alert('データの読み込みに失敗しました。');
      }
    },

    // --- 算出プロパティ ---
    get totalPrepayment() {
      // 予約方法が選択されていない場合は前払いなし
      if (!this.representative.reservationMethod) {
        return 0;
      }
      // 各顧客の前払い金額を合計
      return this.customers.reduce((total, customer) => {
        return total + this.calculateCustomerPrepayment(customer);
      }, 0);
    },
    get totalOnSitePayment() {
      // 値引きを考慮しない元の（合計）現地支払い金額
      return this.customers.reduce((total, customer) => {
        return total + this.calculateCustomerOnSitePayment(customer);
      }, 0);
    },
    get totalOnSitePaymentAdjusted() {
      // 値引き適用後の合計現地支払い金額を、新しいヘルパーメソッドで計算し合計
      return this.customers.reduce((total, customer) => {
        return total + this.calculateCustomerOnSitePaymentAdjusted(customer);
      }, 0);
    },

    // 個人の前払い金額
    calculateCustomerPrepayment(customer) {
      if (!this.representative.reservationMethod) return 0;
      if (customer.dressingType === 'レンタル&着付') {
        return CASUAL_PRICES.RENTAL_DRESSING;
      }
      if (customer.dressingType === '着付のみ') {
        return CASUAL_PRICES.DRESSING_ONLY;
      }
      return 0;
    },

    // 個人の現地払い金額
    calculateCustomerOnSitePayment(customer) {
      let total = 0;
      // 予約方法が選択されていない場合、着付け種別料金を現地払いに加算
      if (!this.representative.reservationMethod) {
        if (customer.dressingType === 'レンタル&着付') {
          total += CASUAL_PRICES.RENTAL_DRESSING;
        } else if (customer.dressingType === '着付のみ') {
          total += CASUAL_PRICES.DRESSING_ONLY;
        }
      }
      // オプション料金を加算
      if (customer.options.footwear) {
        total += CASUAL_PRICES.FOOTWEAR;
      }
      if (customer.gender === 'female' && customer.options.obiBag) {
        total += CASUAL_PRICES.BAG;
      }
      // 追加レンタル料金を加算
      total += customer.additionalRentals.reduce((sum, item) => sum + (item.price || 0), 0);
      return total;
    },

    // 個人の現地払い金額（値引き後）
    calculateCustomerOnSitePaymentAdjusted(customer) {
      const discount = customer.discountAmount || 0;
      const original = this.calculateCustomerOnSitePayment(customer);
      if (discount === 0) return original;
      return original - discount;
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
        name: '',
        bodyShape: null,
        weight: null,
        height: null,
        footSize: null,
        dressingType: 'レンタル&着付',
        options: {
          footwear: false,
          obiBag: false,
        },
        additionalRentals: [],
        imagePreviews: [], // 画面表示用のプレビューURL
        imageFiles: [],    // アップロード用のFileオブジェクト
        paymentMethod: '',
        discountAmount: 0,
        onSitePaymentAdjusted: 0,
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
      const confirmed = window.confirm('この項目を削除しますか？');
      if (!confirmed) return;
      this.customers[customerIndex].additionalRentals.splice(itemIndex, 1);
    },

    // 画像選択時の処理。プレビューURLとFileオブジェクトの両方を保存する
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
     * フォーム全体のデータを送信する
     */
    async submitForm() {
      this.isSubmitting = true;
      try {
        const folderName = COLLECTION_NAME;
        // 顧客データ内の画像URLを準備
        const processedCustomers = await Promise.all(this.customers.map(async (customer) => {
          // 新しい画像ファイルがある場合のみ、アップロード処理を実行
          if (customer.imageFiles && customer.imageFiles.length > 0) {
            const newImageUrls = await Promise.all(
              customer.imageFiles.map(file => uploadMediaToCloudinary(file, folderName))
            );

            // Firestoreに保存する用の新しい顧客オブジェクトを作成
            const customerData = { ...customer };
            delete customerData.imageFiles;
            delete customerData.imagePreviews;
            // 既存のURLを新しいURLで完全に置き換える
            customerData.imageUrls = newImageUrls;
            customerData.prepayment = this.calculateCustomerPrepayment(customer);
            customerData.onSitePayment = this.calculateCustomerOnSitePayment(customer);
            return customerData;
          } else {
            // 新しい画像ファイルがない場合は、既存のデータをそのまま返す
            const customerData = { ...customer };
            delete customerData.imageFiles;
            delete customerData.imagePreviews;
            customerData.prepayment = this.calculateCustomerPrepayment(customer);
            customerData.onSitePayment = this.calculateCustomerOnSitePayment(customer);
            return customerData;
          }
        }));

        // 3. Firestoreに保存する最終的なデータを作成
        const dataToSave = {
          representative: this.representative,
          customers: processedCustomers,
          femaleCount: this.femaleCount,
          maleCount: this.maleCount,
          updatedAt: serverTimestamp(),
          totalPrepayment: this.totalPrepayment,
          totalOnSitePayment: this.totalOnSitePayment,
          totalOnSitePaymentAdjusted: this.totalOnSitePaymentAdjusted,
        };

        // 4. 新規か更新かを判断して、Firestoreにデータを保存
        if (this.currentGroupId) {
          // 既存のドキュメントを更新
          const docRef = doc(db, COLLECTION_NAME, this.currentGroupId);
          await updateDoc(docRef, dataToSave);
          alert('更新が完了しました。');
        } else {
          // 新規ドキュメントを追加
          dataToSave.createdAt = serverTimestamp();
          const colRef = collection(db, COLLECTION_NAME);
          await addDoc(colRef, dataToSave);
          window.location.href = './index.html';
        }
      } catch (error) {
        console.error("登録エラー: ", error);
        alert(`登録中にエラーが発生しました。\n${error.message}`);
      } finally {
        this.isSubmitting = false;
      }
    },

    async deleteForm() {
      if (!confirm('本当にこのカルテを削除しますか？')) {
        return; // ユーザーがキャンセルした場合
      }
      this.isSubmitting = true;
      try {
        const docRef = doc(db, COLLECTION_NAME, this.currentGroupId);
        await deleteDoc(docRef);
        window.location.href = './index.html'; // 削除後、予約一覧ページへ遷移
      } catch (error) {
        console.error("削除エラー: ", error);
        alert(`削除中にエラーが発生しました。\n${error.message}`);
      } finally {
        this.isSubmitting = false;
      }
    }

  }));
});
