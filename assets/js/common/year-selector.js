export const getYearSettings = (eventType = "") => ({
  selectedYear: new Date().getFullYear(),

  initYearSelector() {
    const params = new URLSearchParams(window.location.search);
    const yearFromUrl = params.get('year');

    // === URLに指定がない場合のデフォルト ===
    if (yearFromUrl) {
      this.selectedYear = parseInt(yearFromUrl);
    } else {
      // 成人式だけ来年をデフォルトに
      if (eventType === "seijinshiki") {
        this.selectedYear = new Date().getFullYear() + 1;
      } else {
        this.selectedYear = new Date().getFullYear();
      }
    }
  },

  changeYear() {
    const url = new URL(window.location.href);
    url.searchParams.set("year", this.selectedYear);
    window.history.pushState({}, "", url);
    this.init();
  },
});
