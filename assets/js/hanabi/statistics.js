import { getYearSettings } from "../common/year-selector.js";
import { getDocsByYear } from "../common/utils/firestore-utils.js";
import { formatDuration, formatTimestamp } from '../common/utils/format-utils.js';
import { averageDuration, findMaxBy, findMinBy, calcMinutesBetween } from '../common/utils/statistics-utils.js';
const COLLECTION_NAME = 'fireworks';
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
      this.customers = snapshot.flatMap(doc =>
        doc.customers.map(customer => {
          const { receptionCompletedAt, guidanceCompletedAt, dressingCompletedAt, sendOffCompletedAt } = customer.statusTimestamps || {};
          const dressingMinutes = calcMinutesBetween(guidanceCompletedAt, dressingCompletedAt);
          const totalTime = calcMinutesBetween(receptionCompletedAt, sendOffCompletedAt, true);
          return {
            representative:doc.representative.name,
            name:customer.name,
            gender:customer.gender,
            staff:customer.staff,
            receptionCompletedAt,
            guidanceCompletedAt,
            dressingCompletedAt,
            sendOffCompletedAt,
            dressingMinutes,
            dressingTime: formatDuration(dressingMinutes),
            totalTime,
          };
        })
      );

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
