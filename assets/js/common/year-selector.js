export const getYearSettings = (eventType = "") => ({
  selectedYear: new Date().getFullYear(),

  initYearSelector() {
    const params = new URLSearchParams(window.location.search);
    const yearFromUrl = params.get('year');
    if (yearFromUrl) {
      this.selectedYear = parseInt(yearFromUrl);
      return;
    }

    // === URLに指定がない場合のデフォルト ===
    if (eventType === "seijinshiki") {
      const now = new Date();
      const currentYear = now.getFullYear();

      // 1月の第2月曜日を求める
      const jan1 = new Date(currentYear, 0, 1);
      const firstMondayOffset = (8 - jan1.getDay()) % 7; // 1月最初の月曜
      const secondMondayDate = 1 + firstMondayOffset + 7; // 第2月曜の日付
      const seijinDay = new Date(currentYear, 0, secondMondayDate); // 成人の日
      const dayAfterSeijin = new Date(seijinDay);
      dayAfterSeijin.setDate(seijinDay.getDate() + 1); // 成人の日の翌日(火曜)

      // 今日が成人の日翌日以降なら来年をデフォルトに
      if (now >= dayAfterSeijin) {
        this.selectedYear = currentYear + 1;
      } else {
        this.selectedYear = currentYear;
      }
    } else {
      this.selectedYear = new Date().getFullYear();
    }
  },

  changeYear() {
    const url = new URL(window.location.href);
    url.searchParams.set("year", this.selectedYear);
    window.history.pushState({}, "", url);
    this.init();
  },
});
