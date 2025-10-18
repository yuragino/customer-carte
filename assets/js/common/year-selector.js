export const getYearSettings = () => ({
    selectedYear: new Date().getFullYear(),
    initYearSelector() {
        const params = new URLSearchParams(window.location.search);
        const yearFromUrl = params.get('year');
        this.selectedYear = yearFromUrl ? parseInt(yearFromUrl) : new Date().getFullYear();
    },

    changeYear() {
        const url = new URL(window.location.href);
        url.searchParams.set("year", this.selectedYear);
        window.history.pushState({}, "", url);
        this.init();
    },
});
