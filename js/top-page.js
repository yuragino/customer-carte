document.addEventListener('alpine:init', () => {
  Alpine.data('app', () => ({
    // --- ヘッダー関連 ---
    selectedYear: new Date().getFullYear(),
    get yearOptions() {
      const currentYear = new Date().getFullYear();
      return [currentYear + 1, currentYear, currentYear - 1, currentYear - 2, currentYear - 3];
    },

    init() {
      const params = new URLSearchParams(window.location.search);
      const yearFromUrl = params.get('year');
      this.selectedYear = yearFromUrl ? Number(yearFromUrl) : new Date().getFullYear();
    },

    changeYear() {
      const url = new URL(window.location.href);
      url.searchParams.set('year', this.selectedYear);
      window.history.pushState({}, '', url);
    },

  }));
});