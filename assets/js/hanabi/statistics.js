import { collection, getDocs } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { db } from '../common/firebase-config.js';
import { formatTime, formatTimestamp, avg, minBy, maxBy } from '../common/utils.js';
import { getYearSettings } from "../common/year-selector.js";

document.addEventListener('alpine:init', () => {
  Alpine.data('App', () => ({
    ...getYearSettings(),

    customerStats: [],
    femaleAvg: null, maleAvg: null,
    femaleMin: null, femaleMax: null,
    maleMin: null, maleMax: null,

    async init() {
      this.initYearSelector();
      await this.loadStatistics();
    },

    async loadStatistics() {
      this.customerStats = [];
      this.femaleAvg = this.maleAvg = null;
      this.femaleMin = this.femaleMax = null;
      this.maleMin = this.maleMax = null;

      const colRef = collection(db, `${this.selectedYear}_fireworks`);
      const snapshot = await getDocs(colRef);

      const stats = [];
      const femaleRecords = [];
      const maleRecords = [];

      if (snapshot.empty) {
        this.customerStats = [];
        return;
      }

      snapshot.forEach(doc => {
        const group = doc.data();
        if (!group.customers) return;
        // キャンセル済みグループは除外
        if (group.representative?.isCanceled) return;
        group.customers.forEach(cust => {
          const ts = cust.statusTimestamps || {};
          const reception = ts.receptionCompletedAt;
          const guidance = ts.guidanceCompletedAt;
          const dressing = ts.dressingCompletedAt;
          const sendoff = ts.sendOffCompletedAt;

          const guideToDress = (guidance && dressing) ? (dressing.toDate() - guidance.toDate()) / 60000 : null;
          const total = (reception && sendoff) ? (sendoff.toDate() - reception.toDate()) / 60000 : null;

          const record = {
            id: `${doc.id}_${cust.id}`,
            representative: (group.representative?.lastName || '') + (group.representative?.firstName || ''),
            name: (cust.lastName || '') + (cust.firstName || ''),
            gender: cust.gender || '--',
            staff: cust.staff || [],
            reception: reception ? formatTimestamp(reception) : null,
            guidance: guidance ? formatTimestamp(guidance) : null,
            dressing: dressing ? formatTimestamp(dressing) : null,
            sendoff: sendoff ? formatTimestamp(sendoff) : null,
            guideToDress: guideToDress ? formatTime(guideToDress) : null,
            total: total ? formatTime(total) : null,
            guideRaw: guideToDress,
            receptionDate: reception ? reception.toDate() : null
          };

          stats.push(record);

          // 男女別配列に積む（案内→着付け時間がある人のみ）
          if (record.guideRaw != null) {
            if (record.gender === 'female') femaleRecords.push(record);
            if (record.gender === 'male') maleRecords.push(record);
          }
        });
      });

      // 受付完了時刻順にソート
      this.customerStats = stats.sort((a, b) => {
        if (!a.receptionDate) return 1;
        if (!b.receptionDate) return -1;
        return a.receptionDate - b.receptionDate;
      });

      // 平均時間 (案内 -> 着付)
      this.femaleAvg = avg(femaleRecords);
      this.maleAvg = avg(maleRecords);

      if (femaleRecords.length) {
        const minR = minBy(femaleRecords), maxR = maxBy(femaleRecords);
        this.femaleMin = { time: formatTime(minR.guideRaw), name: minR.name, staff: minR.staff.join(', ') };
        this.femaleMax = { time: formatTime(maxR.guideRaw), name: maxR.name, staff: maxR.staff.join(', ') };
      }
      if (maleRecords.length) {
        const minR = minBy(maleRecords), maxR = maxBy(maleRecords);
        this.maleMin = { time: formatTime(minR.guideRaw), name: minR.name, staff: minR.staff.join(', ') };
        this.maleMax = { time: formatTime(maxR.guideRaw), name: maxR.name, staff: maxR.staff.join(', ') };
      }
    }
  }));
});
