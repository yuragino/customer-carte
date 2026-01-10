import { getYearSettings } from "../common/year-selector.js";
import { getDocsByYear } from "../common/utils/firestore-utils.js";
import { formatDuration, formatTimestamp } from '../common/utils/format-utils.js';
import { averageDuration, findMaxBy, findMinBy, calcMinutesBetween } from '../common/utils/statistics-utils.js';
const COLLECTION_NAME = 'seijinshiki';
document.addEventListener('alpine:init', () => {
  Alpine.data('app', () => ({
    ...getYearSettings(),
    formatTimestamp,
    dressingStats: createDressingStats(),
    customers: [],

    init() {
      this.initYearSelector();
      this.load();
    },

    async load() {
      this.dressingStats = createDressingStats();
      const snapshot = await getDocsByYear(COLLECTION_NAME, this.selectedYear);
      this.customers = snapshot
        .filter(customer => customer.isCanceled !== true)
        .map(customer => {
          const { receptionStartedAt, dressingStartedAt, dressingCompletedAt, sendOffCompletedAt } = customer.statusTimestamps || {};
          const dressingMinutes = calcMinutesBetween(dressingStartedAt, dressingCompletedAt);
          const totalTime = calcMinutesBetween(receptionStartedAt, sendOffCompletedAt, true);
          return {
            name: customer.basicInfo.name,
            gender: customer.gender,
            underGarmentStaff: customer.underGarmentStaff,
            sendoffStaff: customer.sendoffStaff,
            receptionStartedAt,
            dressingStartedAt,
            dressingCompletedAt,
            sendOffCompletedAt,
            dressingMinutes,
            dressingTime: formatDuration(dressingMinutes),
            totalTime,
            scheduleStart: customer.toujitsuInfo?.schedule?.[0]?.start || '',
          };
        })
        .sort((a, b) => a.scheduleStart.localeCompare(b.scheduleStart));

      this.dressingStats.forEach(stat => {
        const records = this.customers.filter(
          customer => customer.gender === stat.gender && customer.dressingMinutes !== null
        );
        if (records.length === 0) return;
        stat.avg = averageDuration(records, 'dressingMinutes');
        const shortest = findMinBy(records, 'dressingMinutes');
        const longest = findMaxBy(records, 'dressingMinutes');
        stat.min = {
          time: formatDuration(shortest.dressingMinutes),
          name: shortest.name,
          staff: shortest.staff.join(', ')
        };
        stat.max = {
          time: formatDuration(longest.dressingMinutes),
          name: longest.name,
          staff: longest.staff.join(', ')
        };

      });
    }

  }));
});

function createDressingStats() {
  return [
    { gender: 'female', label: '女性', avg: null, min: null, max: null },
    { gender: 'male', label: '男性', avg: null, min: null, max: null },
  ]
}
