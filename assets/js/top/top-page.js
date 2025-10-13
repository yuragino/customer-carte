import { getYearSettings } from "../common/year-selector.js";
document.addEventListener('alpine:init', () => {
  Alpine.data('app', () => ({
    ...getYearSettings(),

    init() {
      this.initYearSelector();
    },

  }));
});
