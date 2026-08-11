import { doc, updateDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { db } from '../common/firebase-config.js';
import { signInWithGoogle } from "../common/firebase-auth.js";
import { setupAuth } from "../common/utils/auth-utils.js";
import { getYearSettings } from "../common/year-selector.js";
import { getDocsByYear } from "../common/utils/firestore-utils.js";
import { formatTimestamp } from '../common/utils/format-utils.js';
import { handleError } from "../common/utils/ui-utils.js";
import { STATUS_MAP } from "../common/constants.js";
import { saveStaffConfig } from "../common/utils/staff-config-utils.js";
import { saveBoothConfig } from "../common/utils/booth-config-utils.js";
const COLLECTION_NAME = 'seijinshiki';                 // 予約関連
const CONFIG_COLLECTION_NAME = 'seijinshiki_config';   // 年次設定関連
document.addEventListener('alpine:init', () => {
  Alpine.data('app', () => ({
    ...getYearSettings("seijinshiki"),
    formatTimestamp,
    customers: [],
    boothOptions: { female: [], male: [] },
    staffOptions: [],
    ...STATUS_MAP,

    openSettings: false,
    settings: {
      staff: '',
      boothFemale: '',
      boothMale: '',
    },

    async init() {
      setupAuth(this);
      this.initYearSelector();
      await this.loadConfig();  // ← 設定読み込み
      await this.load();        // ← 顧客データ読み込み
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

    // 設定はデフォルト値を持たせず、今年まだ編集されていなければ前年度の設定を踏襲する
    async loadConfig() {
      const currentConfigs = await getDocsByYear(CONFIG_COLLECTION_NAME, this.selectedYear);
      const currentConfig = currentConfigs[0];

      let staffOptions = currentConfig?.staffOptions;
      let boothOptions = currentConfig?.boothOptions;

      if (!staffOptions || !boothOptions) {
        const prevConfigs = await getDocsByYear(CONFIG_COLLECTION_NAME, this.selectedYear - 1);
        const prevConfig = prevConfigs[0];
        if (!staffOptions) staffOptions = prevConfig?.staffOptions ?? [];
        if (!boothOptions) boothOptions = prevConfig?.boothOptions ?? { female: [], male: [] };
      }

      this.staffOptions = staffOptions;
      this.settings.staff = staffOptions.join(' ');
      this.boothOptions = boothOptions;
      this.settings.boothFemale = (boothOptions.female ?? []).join(' ');
      this.settings.boothMale = (boothOptions.male ?? []).join(' ');
    },

    async saveSettings() {
      const staffOptions = this.settings.staff
        .split(/\s+/)
        .map(s => s.trim())
        .filter(Boolean);
      const boothOptions = {
        female: this.settings.boothFemale.split(/\s+/).map(s => s.trim()).filter(Boolean),
        male: this.settings.boothMale.split(/\s+/).map(s => s.trim()).filter(Boolean),
      };

      await saveStaffConfig(CONFIG_COLLECTION_NAME, this.selectedYear, staffOptions);
      await saveBoothConfig(CONFIG_COLLECTION_NAME, this.selectedYear, boothOptions);
      this.staffOptions = staffOptions;
      this.boothOptions = boothOptions;
      this.openSettings = false;
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
        const currentStatus = customer.status ?? '受付開始';
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

    getSchedulePattern(customer) {
      const scheduleList = customer.toujitsuInfo?.schedule;
      if (!scheduleList) return '';

      const hasHairSchedule = scheduleList.some(schedule => schedule.type === 'hair' && schedule.start);
      const hasKitsukeSchedule = scheduleList.some(schedule => schedule.type === 'kitsuke' && schedule.start);

      if (hasHairSchedule && hasKitsukeSchedule) {
        return scheduleList[0].type === 'hair' ? 'ヘア→着付' : '着付→ヘア';
      } else if (hasKitsukeSchedule && !hasHairSchedule) {
        return '着付のみ';
      }
      return '';
    },

  }));
});

