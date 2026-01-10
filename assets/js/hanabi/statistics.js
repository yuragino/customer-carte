import { getYearSettings } from "../common/year-selector.js";
import { getDocsByYear } from "../common/utils/firestore-utils.js";
import { formatDuration, formatTimestamp } from '../common/utils/format-utils.js';
import { averageValue, findMaxBy, findMinBy, calcMinutesBetween } from '../common/utils/statistics-utils.js';
import { setupAuth } from "../common/utils/auth-utils.js";
const COLLECTION_NAME = 'fireworks';
document.addEventListener('alpine:init', () => {
  Alpine.data('app', () => ({
    ...getYearSettings(),
    formatTimestamp,
    customers: [],

    init() {
      setupAuth(this);
      this.initYearSelector();
      this.load();
    },

    async load() {
      const snapshot = await getDocsByYear(COLLECTION_NAME, this.selectedYear);
      this.customers = snapshot.flatMap(doc =>
        doc.customers.map(customer => {
          const { receptionStartedAt, dressingStartedAt, dressingCompletedAt, sendOffCompletedAt } = customer.statusTimestamps || {};
          const dressingMinutes = calcMinutesBetween(dressingStartedAt, dressingCompletedAt);
          const totalTime = calcMinutesBetween(receptionStartedAt, sendOffCompletedAt, true);
          return {
            representative: doc.representative.name,
            name: customer.name,
            gender: customer.gender,
            staff: customer.staff,
            receptionStartedAt,
            dressingStartedAt,
            dressingCompletedAt,
            sendOffCompletedAt,
            dressingMinutes,
            dressingTime: formatDuration(dressingMinutes),
            totalTime,
          };
        })
      );
    },


    get dressingStats() {
      const genders = [
        { key: 'female', label: '女性' },
        { key: 'male', label: '男性' },
      ];

      return genders.map(({ key, label }) => {
        const customersForGender = this.customers.filter(
          customer => customer.gender === key && customer.dressingMinutes > 0
        );

        if (customersForGender.length === 0) {
          return { gender: key, label, avg: '該当無し', min: '該当無し', max: '該当無し' };
        }

        const avgMinutes = averageValue(customersForGender, 'dressingMinutes');
        const fastest = findMinBy(customersForGender, 'dressingMinutes');
        const slowest = findMaxBy(customersForGender, 'dressingMinutes');

        return {
          gender: key,
          label,
          avg: formatDuration(avgMinutes),
          min: `${fastest.name}（${formatDuration(fastest.dressingMinutes)}）`,
          max: `${slowest.name}（${formatDuration(slowest.dressingMinutes)}）`,
        };
      });
    }

  }));
});
