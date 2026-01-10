import { doc, updateDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { db } from '../common/firebase-config.js';
import { signInWithGoogle } from "../common/firebase-auth.js";
import { setupAuth } from "../common/utils/auth-utils.js";
import { getYearSettings } from "../common/year-selector.js";
import { getDocsByYear, getAllDocs } from "../common/utils/firestore-utils.js";
import { formatTimestamp } from '../common/utils/format-utils.js';
import { handleError } from "../common/utils/ui-utils.js";
import { STATUS_MAP } from "../common/constants.js";
const COLLECTION_NAME = 'seijinshiki';                 // 予約関連
const CONFIG_COLLECTION_NAME = 'seijinshiki_config';   // 年次設定関連
document.addEventListener('alpine:init', () => {
  Alpine.data('app', () => ({
    ...getYearSettings("seijinshiki"),
    formatTimestamp,
    customers: [],
    boothOptionsFemale: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
    boothOptionsMale: ['B1', 'B2', 'C1', 'C2'],
    staffOptions: [],
    ...STATUS_MAP,

    openSettings: false,
    settings: {
      staff: '',
    },

    async init() {
      setupAuth(this);
      this.initYearSelector();
      await this.loadConfig();  // ← 設定読み込み
      await this.load();        // ← 顧客データ読み込み
    },

    login() {
      signInWithGoogle();
    },

    async load() {
      this.customers = [];
      try {
        this.customers = (await getDocsByYear(COLLECTION_NAME, this.selectedYear))
          .sort((a, b) => {
            // キャンセルの有無 → 時間の順
            const cancelOrder = Number(a.isCanceled) - Number(b.isCanceled);
            if (cancelOrder !== 0) return cancelOrder;
            return a.toujitsuInfo?.schedule[0]?.start.localeCompare(b.toujitsuInfo?.schedule[0]?.start);
          });
      } catch (error) {
        handleError('データの取得', error);
      }
    },

    async loadConfig() {
      try {
        const configs = await getDocsByYear(CONFIG_COLLECTION_NAME, this.selectedYear);
        if (configs.length > 0) {
          const config = configs[0];
          this.staffOptions = config.staffOptions ?? [];
          // 表示用テキストに「スペース区切り」で結合
          this.settings.staff = this.staffOptions.join(' ');
        } else {
          this.staffOptions = ['小林', '矢口', '大矢'];
          this.settings.staff = this.staffOptions.join(' ');
        }
      } catch (err) {
        console.error('スタッフ設定の読み込みエラー:', err);
      }
    },

    async saveStaffConfig() {
      try {
        const year = this.selectedYear;
        // 入力文字列をスペースで分割
        const staffOptions = this.settings.staff
          .split(/\s+/)            // ← スペース区切り（全角・半角対応）
          .map(s => s.trim())
          .filter(Boolean);

        const docRef = doc(db, CONFIG_COLLECTION_NAME, String(year));
        await setDoc(docRef, {
          eventYear: year,
          staffOptions,
          updatedAt: new Date()
        }, { merge: true });

        this.staffOptions = staffOptions;
        alert('スタッフ設定を保存しました。');
        this.openSettings = false;
      } catch (err) {
        console.error('スタッフ設定の保存に失敗しました:', err);
        alert('スタッフ設定を保存できませんでした。');
      }
    },

    async updateCustomerField(customerId, field, value) {
      try {
        const docRef = doc(db, COLLECTION_NAME, customerId);
        await updateDoc(docRef, { [field]: value });
      } catch (error) {
        handleError(`${field}の更新`, error);
      }
    },

    async updateStatus(customer) {
      try {
        const docRef = doc(db, COLLECTION_NAME, customer.id);
        const currentStatus = customer.status ?? '受付完了';
        if (!confirm(`${currentStatus}で間違いないですか？`)) return;

        const nextStatus = this.nextStatusMap[currentStatus];
        if (!nextStatus) return;

        customer.status = nextStatus;
        const timestampKey = this.statusToTimestampKey[currentStatus];
        (customer.statusTimestamps ??= {})[timestampKey] = new Date();

        await updateDoc(docRef, { ...customer });
      } catch (error) {
        handleError('ステータスの更新', error);
        this.load();
      }
    },

  }));
});

